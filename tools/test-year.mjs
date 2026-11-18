/**
 * The year sweep: every day of the coming year, through every reader.
 *
 * Most bugs in a daily-learning app hide on rare days: the Tanya's opening
 * pages once a year, a Rambam day that crosses from one book to the next,
 * Tehillim on a 29-day month, Simchas Torah. Ordinary tests only see ordinary
 * days. This one opens the real index.html in Chromium and, for each day from
 * today through a year ahead, loads Chumash, Tehillim, Tanya and both Rambam
 * tracks with the app's own code and real Sefaria and Hebcal answers, draws
 * each text, and checks it. Then it checks the days against each other:
 *   - Tanya: each day starts right where the day before ended (nothing
 *     skipped, nothing read twice), and the server's portion (what the guide
 *     and the quiz are made for) is exactly the app's
 *   - Tehillim: each Hebrew month says all 150 psalms
 *   - Rambam: 3 chapters a day (or 1) on its track
 *   - the day bar never says a date twice
 *
 * Sefaria's and Hebcal's answers are saved in tools/.cache/year, so only the
 * first run is slow (a few minutes); later runs take about a minute. Delete
 * that folder to fetch everything fresh.
 *
 * Run:  cd tools && npm run test:year
 *       YEAR_FROM=2026-11-25 YEAR_DAYS=20 npm run test:year   (a shorter stretch)
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, 'tools/.cache/year');
await mkdir(CACHE, { recursive: true });

const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const FROM = process.env.YEAR_FROM || nyToday();
const DAYS = +(process.env.YEAR_DAYS || 400);
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dates = Array.from({ length: DAYS }, (_, i) => addDays(FROM, i));

// ── Sefaria and Hebcal, saved on disk ─────────────────────────────────────────
// Used by the browser (every request to them is answered from here) and by the
// server code this test runs (/api/tanya-boundary, the guide's portion).
const realFetch = globalThis.fetch;
const inFlight = new Map();
let fetched = 0, fromDisk = 0;
async function saved(url) {
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
  if (existsSync(file)) { fromDisk++; return JSON.parse(await readFile(file, 'utf8')); }
  if (inFlight.has(url)) return inFlight.get(url);
  const p = (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await realFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily-test/1.0)' } });
        const entry = { status: r.status, type: r.headers.get('content-type') || 'application/json', body: await r.text() };
        if (r.status >= 500 || r.status === 429) throw new Error('HTTP ' + r.status);
        fetched++;
        if (r.ok) await writeFile(file, JSON.stringify(entry));
        return entry;
      } catch (e) {
        if (attempt >= 3) return { status: 502, type: 'application/json', body: '{"error":"' + e.message + '"}' };
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  })();
  inFlight.set(url, p);
  try { return await p; } finally { inFlight.delete(url); }
}
const savedHost = u => /(^|\.)(sefaria\.org|hebcal\.com)$/.test(new URL(u).hostname);
globalThis.fetch = async (input, init) => {
  const u = typeof input === 'string' ? input : input.url;
  if (!savedHost(u)) return realFetch(input, init);
  const e = await saved(u);
  return new Response(e.body, { status: e.status, headers: { 'content-type': e.type } });
};

// The server's own code, with the fetch above
const { default: tanyaBoundary } = await import('../api/tanya-boundary.js');
const { tanyaPortion } = await import('../api/_lib/tanya-portion.js');

// ── The app, served from the repo, with /api/tanya-boundary really answered ──
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const path = decodeURIComponent(u.pathname);
  if (path === '/api/tanya-boundary') {
    const r = { status(c) { res.statusCode = c; return r; }, json(o) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); }, setHeader: (k, v) => res.setHeader(k, v) };
    return tanyaBoundary({ method: 'GET', query: Object.fromEntries(u.searchParams) }, r);
  }
  if (path.startsWith('/api/')) return res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not in this test"}');
  try {
    const body = await readFile(join(ROOT, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
// The service worker is off, so every request goes through the route below
const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'America/New_York' });
await context.route(u => savedHost(u.href), async route => {
  const e = await saved(route.request().url());
  await route.fulfill({ status: e.status, contentType: e.type, body: e.body, headers: { 'Access-Control-Allow-Origin': '*' } });
});

// ── One day, in the page: every reader, its text drawn and summed up ─────────
function readDay(iso) {
  return (async () => {
    const out = { iso };
    dayOffset = Math.round((Date.parse(iso + 'T12:00:00') - Date.parse(dateISO(appNow()) + 'T12:00:00')) / 864e5);
    if (_viewedISO() !== iso) return { iso, error: 'could not move to the day' };
    // In the text: code leaking onto the page. In headings and labels (where the
    // app writes the words, not Sefaria) also "undefined" and "null"; the text
    // itself can say "undefined" (the Rambam does, Kings 12)
    const BAD = /\bNaN\b|\[object |<\/?(?:span|b|i|br|sup|small|big)\b/;
    const BAD_LABEL = /\bundefined\b|\bnull\b|\bNaN\b/;
    const LABELS = '.tz-part, .tz-ch, .tz-en-label, .tz-h, .tz-gl, h1, h2, h3, h4';
    const drawn = sid => {
      const el = document.getElementById('native-reader-content');
      try {
        _rv.sid = sid; el.innerHTML = '';   // each drawing only draws for the reader on screen
        window[_TEXT_SLOT[sid]] = _dayTexts.get(sid + '|' + iso);
        _TEXT_DRAW[sid]();
        const text = el.textContent.replace(/\s+/g, ' ');
        const label = [...el.querySelectorAll(LABELS)].map(x => x.textContent.trim()).find(t => BAD_LABEL.test(t));
        if (label) return { textLen: text.length, bad: 'a heading reads "' + label + '"' };
        const m = text.match(BAD);   // what's wrong, and a few words around it
        return { textLen: text.length, bad: m ? m[0] + '" in "…' + text.slice(Math.max(0, m.index - 60), m.index + 40) + '…' : null };
      } catch (e) { return { textLen: 0, bad: 'drawing failed: ' + e.message }; }
    };
    const sub = sid => _textSubtitle(sid, _dayTexts.get(sid + '|' + iso)) || '';

    // Chumash: the day's aliyah comes from the date itself
    const aliyah = getChumashAliyaRef(new Date(iso + 'T12:00:00'));
    if (!aliyah) out.chumash = { ok: false, why: 'no aliyah for the date' };
    else {
      const ok = await _loadChumashNative('chumash', true);
      const d = _dayTexts.get('chumash|' + iso);
      out.chumash = { ok: ok && !!d, ref: aliyah, sub: sub('chumash'), missing: d?.missing, ...(d ? drawn('chumash') : {}) };
    }

    // Tehillim
    {
      const ok = await _loadTehillimNative('tehillim', true);
      const d = _dayTexts.get('tehillim|' + iso);
      out.tehillim = { ok: ok && !!d, dayNum: d?.dayNum, psalms: (d?.chapters || []).filter(c => c.he.length || c.en.length).map(c => c.psalmNum),
        empty: (d?.chapters || []).filter(c => !c.he.length && !c.en.length).map(c => c.psalmNum), sub: sub('tehillim'), ...(d ? drawn('tehillim') : {}) };
    }

    // Tanya (with the guide's words on, as most people read it)
    {
      const ok = await _loadTanyaNative('tanya', true);
      const d = _dayTexts.get('tanya|' + iso);
      out.tanya = { ok: ok && !!d, sub: sub('tanya'), quizRef: d?.quizRef ?? null, opening: !!d?.heHead, approx: !!d?.isApproximate,
        blocks: d?.blocks?.length || 0, emptyBlocks: (d?.blocks || []).filter(b => !b.he && !b.en).length, ...(d ? drawn('tanya') : {}) };
    }

    // Rambam: 3 chapters a day, then 1 a day
    const keepTrack = user.rambamTrack;
    for (const [key, track] of [['rambam3', '3'], ['rambam1', '1']]) {
      user.rambamTrack = track;
      _dayTexts.delete('rambam|' + iso);
      const ok = await _loadRambamNative('rambam', true);
      const d = _dayTexts.get('rambam|' + iso);
      out[key] = { ok: ok && !!d, sub: sub('rambam'), titles: (d?.chapters || []).map(c => c.title || c.ref || '?'),
        parts: (d?.chapters || []).map(c => ({ title: c.title, chapter: c.chapter, opening: c.opening ? { from: c.opening.from, to: c.opening.to, sections: c.opening.sections, sectionCount: c.opening.sectionCount } : null,
          en: c.en.filter(Boolean).length, he: c.he.filter(Boolean).length, heads: (c.opening?.heads || []).filter(Boolean).length })),
        emptyChapters: (d?.chapters || []).filter(c => !c.en.length || !c.he.length).map(c => c.title || c.ref || '?'), ...(d ? drawn('rambam') : {}) };
    }
    user.rambamTrack = keepTrack;

    // Sefer HaMitzvos (its texts are the app's own; this checks the day's list)
    try {
      const r = shmReading(new Date(iso + 'T12:00:00'));
      out.shm = { items: r.items.length, sub: shmSubtitle(new Date(iso + 'T12:00:00')) };
    } catch (e) { out.shm = { items: 0, sub: 'failed: ' + e.message }; }

    // The day bar's label for this day
    _updateReaderDayBar('chumash');
    out.dayBar = document.getElementById('rd-label').textContent;
    return out;
  })();
}

// A few pages side by side, each with its share of the days
const PAGES = 4;
const results = [];
const started = Date.now();
await Promise.all(Array.from({ length: PAGES }, async (_, p) => {
  const page = await context.newPage();
  page.on('pageerror', e => results.push({ iso: '(page ' + p + ')', error: e.message }));
  await page.clock.install({ time: new Date(FROM + 'T12:00:00-05:00') });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof _loadTanyaNative === 'function' && typeof getChumashAliyaRef === 'function', null, { timeout: 30000 });
  await page.evaluate(() => window._dayReady).catch(() => {});
  for (let i = p; i < dates.length; i += PAGES) {
    results.push(await page.evaluate(`(${readDay})(${JSON.stringify(dates[i])})`).catch(e => ({ iso: dates[i], error: e.message.split('\n')[0] })));
    if (i % 40 === p) process.stdout.write('.');
  }
  await page.close();
}));
process.stdout.write('\n');

// ── The checks ────────────────────────────────────────────────────────────────
let fails = 0, passes = 0;
const problems = [];
const check = (cond, msg) => { if (cond) passes++; else { fails++; problems.push(msg); } };
const days = results.filter(r => /^\d{4}/.test(r.iso)).sort((a, b) => a.iso.localeCompare(b.iso));
const byIso = Object.fromEntries(days.map(d => [d.iso, d]));
results.filter(r => !/^\d{4}/.test(r.iso)).forEach(r => check(false, r.iso + ' ' + r.error));

const TEXTS = ['chumash', 'tehillim', 'tanya', 'rambam3', 'rambam1'];
for (const d of days) {
  if (d.error) { check(false, d.iso + ': ' + d.error); continue; }
  for (const s of TEXTS) {
    const x = d[s];
    check(x?.ok, `${d.iso} ${s}: didn't load${x?.why ? ' (' + x.why + ')' : ''}`);
    if (!x?.ok) continue;
    check(x.textLen > 200, `${d.iso} ${s}: almost no text on screen (${x.textLen} characters)`);
    check(!x.bad, `${d.iso} ${s}: the page shows "${x.bad}"`);
    check(x.sub && !/undefined|NaN|null/.test(x.sub), `${d.iso} ${s}: the title line is "${x.sub}"`);
  }
  if (d.chumash?.ok) check(!d.chumash.missing?.torah && !d.chumash.missing?.rashi, `${d.iso} chumash: part missing (${JSON.stringify(d.chumash.missing)}) for ${d.chumash.ref}`);
  if (d.tehillim?.ok) check(!d.tehillim.empty.length, `${d.iso} tehillim: psalm ${d.tehillim.empty} has no text`);
  if (d.tanya?.ok) {
    check(!d.tanya.approx, `${d.iso} tanya: the end of the portion is a guess (no next day from the calendar)`);
    check(d.tanya.blocks > 0 && !d.tanya.emptyBlocks, `${d.iso} tanya: ${d.tanya.blocks} pieces, ${d.tanya.emptyBlocks} of them empty`);
  }
  for (const s of ['rambam3', 'rambam1']) if (d[s]?.ok) check(!d[s].emptyChapters.length, `${d.iso} ${s}: no text for ${d[s].emptyChapters}`);
  check(d.shm?.items > 0 && !/undefined|NaN|failed/.test(d.shm.sub), `${d.iso} sefer hamitzvos: ${d.shm?.items} items, "${d.shm?.sub}"`);
  const dates2 = d.dayBar.match(/[A-Z][a-z]{2} \d{1,2}/g) || [];
  check(new Set(dates2).size === dates2.length, `${d.iso} day bar: "${d.dayBar}"`);
}

// Rambam: each day is exactly the calendar's portion, split the way the
// calendar splits it, and starts right where the day before stopped
const OPENING_BOOKS = ['Transmission of the Oral Law', 'Positive Mitzvot', 'Negative Mitzvot', 'Overview of Mishneh Torah Contents'];
const hebcalDay = async iso => JSON.parse((await saved('https://www.hebcal.com/hebcal?v=1&cfg=json&dps=on&dr3=on&dr1=on&d=on&start=' + iso + '&end=' + iso + '&lg=s')).body);
// "Foundations of the Torah 10, Human Dispositions 1-2" → [{ book, from, to, sections }]
// (book names can have commas, "Tefillin, Mezuzah and the Torah Scroll", so it splits only after a number)
const calendarParts = title => title.split(/(?<=\d), /).map(p => {
  const m = p.match(/^(.+?) (\d+)(:\d+)?(?:-(\d+)(?::\d+)?)?$/);
  return m && { book: m[1], from: +m[2], to: +(m[4] || m[2]), sections: !!m[3], text: p };
});
for (const [key, cat] of [['rambam3', 'dailyRambam3'], ['rambam1', 'dailyRambam1']]) {
  let before = null;   // where the day before ended: { book, n }
  for (const d of days) {
    const r = d[key];
    if (!r?.ok) { before = null; continue; }
    const item = (await hebcalDay(d.iso)).items?.find(i => i.category === cat);
    const want = item ? calendarParts(item.title) : null;
    if (!want || want.some(w => !w)) { check(false, `${d.iso} ${key}: can't read the calendar's "${item?.title}"`); before = null; continue; }
    // What the app should show: an opening piece whole, as one; a book's chapters one by one
    const expected = want.flatMap(w => OPENING_BOOKS.includes(w.book) ? [w.text]
      : Array.from({ length: w.to - w.from + 1 }, (_, i) => w.book + ' ' + (w.from + i)));
    const got = r.parts.map(p => p.title);
    check(JSON.stringify(got) === JSON.stringify(expected), `${d.iso} ${key}: shows [${got.join(' | ')}], the calendar says [${expected.join(' | ')}]`);
    for (const p of r.parts) {
      check(p.en && p.he, `${d.iso} ${key}: ${p.title} has ${p.en} English and ${p.he} Hebrew paragraphs`);
      if (p.opening && !p.opening.sections) check(p.en === p.opening.to - p.opening.from + 1 && p.he === p.en, `${d.iso} ${key}: ${p.title} should have ${p.opening.to - p.opening.from + 1} paragraphs, has ${p.en} English and ${p.he} Hebrew`);
      if (p.opening?.sections) check(p.opening.sectionCount === p.opening.to - p.opening.from + 1 && p.heads >= p.opening.sectionCount - 1, `${d.iso} ${key}: ${p.title} should have ${p.opening.to - p.opening.from + 1} sections, has ${p.opening.sectionCount} (${p.heads} with a title)`);
    }
    // Continues from the day before: the next paragraph or chapter of the same book, or a new book from its start
    const first = want[0], last = want.at(-1);
    if (before) {
      const follows = first.book === before.book ? first.from === before.n + 1 : first.from === 1;
      check(follows, `${d.iso} ${key}: starts at ${first.book} ${first.from}, but the day before ended at ${before.book} ${before.n}`);
    }
    before = { book: last.book, n: last.to };
  }
}

// Tehillim: each Hebrew month (day 1 to its last day) says all 150
{
  let month = null;
  const close = () => {
    if (!month || !month.complete) return;
    const missing = []; for (let n = 1; n <= 150; n++) if (!month.seen.has(n)) missing.push(n);
    check(!missing.length, `tehillim: the month from ${month.from} leaves out psalm(s) ${missing.join(', ')}`);
  };
  for (const d of days) {
    if (!d.tehillim?.ok) continue;
    if (d.tehillim.dayNum === 1) { close(); month = { from: d.iso, seen: new Set(), complete: true }; }
    if (month) d.tehillim.psalms.forEach(n => month.seen.add(n));
  }
  // (the last month in the stretch is usually cut off, so it isn't counted)
}

// Tanya: each chapter day starts right after the day before ends, and the
// server's portion (the guide's, the quiz's) is the app's
const chapterNum = slug => +(slug.match(/\.(\d+)$/) || [])[1];
const partOf = slug => slug.replace(/\.\d+$/, '');
for (let i = 0; i < days.length; i++) {
  const d = days[i], q = d.tanya?.quizRef;
  if (!d.tanya?.ok || d.tanya.opening || !q) continue;
  const prev = days[i - 1]?.tanya;
  if (prev?.ok && prev.quizRef && !prev.opening) {
    const p = prev.quizRef;
    const follows = p.endVerse != null
      ? q.chapterSlug === p.chapterSlug && q.startVerse === p.endVerse + 1
      : q.startVerse === 1 && (partOf(q.chapterSlug) !== partOf(p.chapterSlug) || chapterNum(q.chapterSlug) === chapterNum(p.chapterSlug) + 1);
    check(follows, `${d.iso} tanya: starts at ${q.chapterSlug}:${q.startVerse}, but the day before ended at ${p.chapterSlug}:${p.endVerse ?? 'end'}`);
  }
}
for (const d of days) {
  if (!d.tanya?.ok) continue;
  const s = await tanyaPortion(d.iso).catch(e => ({ error: e.message }));
  const a = d.tanya.quizRef;
  if (d.tanya.opening) { check(!a, `${d.iso} tanya: an opening day has a quiz passage`); continue; }
  const same = s && a && s.chapterSlug === a.chapterSlug && s.startVerse === a.startVerse && (s.endVerse ?? null) === (a.endVerse ?? null);
  check(same, `${d.iso} tanya: the server's portion ${JSON.stringify(s)} isn't the app's ${JSON.stringify(a)}`);
}

// ── Report ──────────────────────────────────────────────────────────────────
const openings = days.filter(d => d.tanya?.opening).map(d => d.iso);
console.log(`Days ${days[0]?.iso} to ${days.at(-1)?.iso} (${days.length}); Tanya opening days: ${openings.join(', ') || 'none'}`);
console.log(`Requests: ${fetched} fetched, ${fromDisk} from disk; ${Math.round((Date.now() - started) / 1000)}s`);
for (const p of problems) console.log('  ✗ ' + p);
console.log(`\n${passes} passed, ${fails} failed`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
