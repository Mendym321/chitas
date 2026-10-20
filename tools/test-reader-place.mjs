/**
 * Reader place tests: does the reader keep your place, for each section and
 * day, the way a person uses it? Opens the real index.html in headless
 * Chromium with Sefaria, Hebcal and the app's own /api answered by fakes (some
 * of them slow on purpose), scrolls with the mouse wheel, opens, closes and
 * switches sections and days, and checks which passage is at the top.
 *
 * Run:  cd tools && npm run test:place
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  try {
    const body = await readFile(join(ROOT, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── The fake internet ────────────────────────────────────────────────────────
// Every passage starts with its own name ("Genesis 12:1-13 v7"), so the test
// can tell exactly which text, and which part of it, is on screen.
const filler = n => ' and the words of this passage continue'.repeat(n);
const verses = (name, n = 24, len = 9) => Array.from({ length: n }, (_, i) => `${name} v${i + 1}.${filler(len)}`);
const heVerses = (n = 24) => Array.from({ length: n }, (_, i) => `פסוק ${i + 1} ` + 'מילים של הפסוק '.repeat(12));

let delays = [];          // [[RegExp, ms]]: answers that come slowly
let guide = null;         // what /api/tanya-enhance answers (null = not available)
function fake(u) {
  const q = new URL(u);
  const path = decodeURIComponent(q.pathname);
  if (q.hostname.endsWith('sefaria.org')) {
    if (path.startsWith('/api/texts/versions/')) return [{ language: 'en', versionTitle: 'Metsudah Chumash' }];
    if (path.startsWith('/api/v3/texts/')) {
      const ref = path.slice('/api/v3/texts/'.length);
      return { versions: [{ language: 'en', text: verses(ref, 12) }] };
    }
    if (path.startsWith('/api/texts/')) {
      const ref = path.slice('/api/texts/'.length);
      if (q.searchParams.get('lang') === 'he') return { he: heVerses(12) };
      return { text: verses(ref), he: heVerses(), versionTitle: 'Metsudah Chumash' };
    }
    if (path.startsWith('/api/links/')) return [];
    return null;
  }
  if (q.hostname.endsWith('hebcal.com')) {
    if (path === '/converter') return { hy: 5787, hm: 'Cheshvan', hd: 5, hebrew: 'ה׳ חשון' };
    const start = q.searchParams.get('start');
    return { items: [{ category: 'dailyRambam3', title: 'Fake ' + start, refs: ['Mishneh Torah, Fake ' + start + ' 1'] }] };
  }
  if (q.origin + '/' === url && path === '/api/tanya-boundary') {
    const day = +q.searchParams.get('date').slice(8, 10);  // a different chapter each day
    const base = 'Tanya,_Part_I;_Likkutei_Amarim.' + day;
    return { today: 'Tanya, Part I; Likkutei Amarim ' + day + ':1', tomorrow: 'Tanya, Part I; Likkutei Amarim ' + day + ':21',
             todayUrl: base + '.1', tomorrowUrl: base + '.21', isApproximate: false };
  }
  if (q.origin + '/' === url && path === '/api/tanya-enhance') return guide ? guide : { status: 404, json: { error: 'none' } };
  return null;
}

const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: 'block' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.route(u => !u.href.startsWith(url) || u.pathname.startsWith('/api/'), async route => {
  const u = route.request().url();
  const ms = (delays.find(([re]) => re.test(decodeURIComponent(u))) || [])[1] || 0;
  if (ms) await sleep(ms);
  const body = fake(u);
  if (body === null) return route.abort().catch(() => {});
  const status = body.status || 200, json = body.json ?? body;
  await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(json) }).catch(() => {});
});
await page.goto(url, { waitUntil: 'load' });

// A signed-in learner on today, with today's schedule, the app's own screens
// out of the way, and nothing loaded or saved yet
async function fresh() {
  delays = []; guide = null;
  await page.evaluate(() => {
    document.getElementById('onboarding')?.style.setProperty('display', 'none');
    document.getElementById('loader')?.style.setProperty('display', 'none');
    const app = document.getElementById('main-app'); app.style.display = 'block'; app.classList.add('ready');   // what a real start does (and keeps the rescue screen away)
    document.getElementById('rescue').style.display = 'none';
    if (document.getElementById('chabad-panel').style.display !== 'none') closeChabadPanel();
    Object.keys(localStorage).filter(k => k.startsWith('scroll_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('chitas_lang_chumash', 'both'); localStorage.setItem('chitas_lang_tanya', 'both');
    user.rambamTrack = '3'; user.rambamTrackAsked = true; user.done = {}; user.pastDone = {};
    user.tehillimFixedOpts = { rebbe: false, rebbetzin: false }; user.tehillimPeople = [];
    dayOffset = 0;
    const sec = id => ({ id, label: id[0].toUpperCase() + id.slice(1), color: '#000', subtitle: '', chabadUrl: '', sefariaRef: null });
    schedule = { chumash: sec('chumash'), tehillim: sec('tehillim'), tanya: sec('tanya'), rambam: sec('rambam') };
    schedule.chumash.sefariaRef = getChumashAliyaRef(new Date());
    window._todaySchedule = JSON.parse(JSON.stringify(schedule));
    window._chumashData = window._tehillimData = window._tanyaData = window._rambamData = null;
    if (typeof _dayTexts !== 'undefined') _dayTexts.clear();
    window._chumashData = window._tehillimData = window._tanyaData = window._rambamData = null; window._prefetched = {}; window._cachedTanyaBoundary = null;
  });
}

// What's at the top of the reader: the passage, and how far into it (px)
const where = () => page.evaluate(() => {
  const reader = document.getElementById('native-reader');
  const c = document.getElementById('native-reader-content');
  if (!reader || reader.style.display === 'none' || c.style.display === 'none') return null;
  const top = reader.getBoundingClientRect().top;
  for (const el of c.querySelectorAll('p, .tz-p')) {
    const r = el.getBoundingClientRect();
    if (r.height < 4 || r.bottom <= top + 8) continue;
    const m = el.textContent.match(/([A-Za-z][\w ,;'.:-]*? v\d+)/);
    if (!m) continue;
    return { text: m[1].trim(), into: Math.round(top - r.top), y: Math.round(reader.scrollTop), h: reader.scrollHeight };
  }
  return reader.scrollTop < 40 ? { text: 'top', into: 0 } : { text: 'unnamed', into: 0, y: Math.round(reader.scrollTop), h: reader.scrollHeight };
});
// Same place: same passage, within a few lines
const same = (a, b) => !!a && !!b && a.text === b.text && Math.abs(a.into - b.into) < 40 && (a.text !== 'unnamed' || Math.abs(a.y - b.y) < 40);

async function open(id) { await page.evaluate(id => openChabadPanel(id), id); await settle(); }
async function close() { await page.evaluate(() => closeChabadPanel()); }
async function settle(ms = 500) { await sleep(ms); }
// Scrolls like a person: the pointer over the text, then the wheel
async function scrollBy(dy) {
  await page.mouse.move(200, 400);
  for (let left = dy; left !== 0;) { const s = Math.sign(left) * Math.min(Math.abs(left), 600); await page.mouse.wheel(0, s); left -= s; await sleep(40); }
  await sleep(450);       // the place is saved a moment after you stop
}
async function goDay(delta) { await page.evaluate(d => _readerGoDay(d), delta); await settle(900); }
// Which passage the reader is showing (the name its first verse starts with)
const readerShows = () => page.evaluate(() => {
  for (const el of document.querySelectorAll('#native-reader-content p, #native-reader-content .tz-p')) {
    const m = el.textContent.match(/^\s*(?:\d+\.)?((?!Rashi)[A-Za-z][^\n]*?) v1\./);
    if (m) return m[1];
  }
  return null;
});
// The start of a ref, which is how the reader names its first passage ("Genesis 12:14")
const startOf = ref => ref.split('-')[0] + '-';   // exact: "Genesis 12:1-" isn't "Genesis 12:14-"
const chumashRef = off => page.evaluate(off => { const d = new Date(); d.setDate(d.getDate() + off); return getChumashAliyaRef(d); }, off);

let failed = 0;
async function test(name, fn) {
  try { await fresh(); await fn(); console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n      ', e.message.split('\n').join('\n       ')); }
}
function expect(cond, msg, detail) { if (!cond) throw new Error(msg + (detail !== undefined ? ': ' + JSON.stringify(detail) : '')); }

console.log('Reader place tests:');

await test('close and open again: back at the same passage', async () => {
  await open('chumash');
  await scrollBy(2400);
  const a = await where();
  expect(a && a.text !== 'top', 'scrolled into the text', a);
  await close(); await open('chumash');
  const b = await where();
  expect(same(a, b), 'same place', { before: a, after: b });
});

await test('each section keeps its own place (no leaking)', async () => {
  await open('chumash'); await scrollBy(2400); const ch = await where(); await close();
  await open('tanya'); const t0 = await where();
  expect(t0?.text === 'top' || t0?.into < 40 && /v1$/.test(t0.text), 'Tanya starts at its top', t0);
  await scrollBy(1200); const ta = await where(); await close();
  await open('chumash'); const ch2 = await where(); await close();
  await open('tanya'); const ta2 = await where(); await close();
  expect(same(ch, ch2), 'Chumash place kept', { ch, ch2 });
  expect(same(ta, ta2), 'Tanya place kept', { ta, ta2 });
});

await test('switching section straight from the reader ("Next") keeps both places', async () => {
  await open('chumash'); await scrollBy(2400); const ch = await where();
  await open('tanya');                      // no close in between
  const t0 = await where();
  expect(t0?.into < 40 && (t0.text === 'top' || /v1$/.test(t0.text)), 'Tanya starts at its top', t0);
  await scrollBy(1000); const ta = await where();
  await open('chumash'); const ch2 = await where();
  await open('tanya'); const ta2 = await where();
  expect(same(ch, ch2) && same(ta, ta2), 'both kept', { ch, ch2, ta, ta2 });
});

await test('each day keeps its own place, and shows its own text', async () => {
  const [today, yest] = [await chumashRef(0), await chumashRef(-1)];
  await open('chumash'); await scrollBy(2400); const t = await where();
  await goDay(-1);
  expect((await readerShows())?.startsWith(startOf(yest)), 'yesterday\'s text', { shows: await readerShows(), yest });
  const y0 = await where();
  expect(y0?.into < 40 && (y0.text === 'top' || /v1$/.test(y0.text)), 'yesterday starts at its top', y0);
  await scrollBy(1200); const y = await where();
  await goDay(1);
  expect((await readerShows())?.startsWith(startOf(today)), 'today\'s text again', await readerShows());
  const t2 = await where();
  expect(same(t, t2), 'today\'s place', { t, t2 });
  await goDay(-1); const y2 = await where();
  expect(same(y, y2), 'yesterday\'s place', { y, y2 });
});

await test('a day picked on Today, then opened at once, shows that day\'s text (slow calendar)', async () => {
  delays = [[/hebcal\.com/, 700]];
  const yest = await chumashRef(-1);
  await page.evaluate(() => { navDay(-1); openChabadPanel('chumash'); });
  await settle(1500);
  expect((await readerShows())?.startsWith(startOf(yest)), 'yesterday\'s Chumash', { shows: await readerShows(), yest });
  await close(); await page.evaluate(() => navDay(1)); await settle(300);
});

await test('a slow section you left never replaces the one you opened', async () => {
  delays = [[/sefaria\.org\/api\/texts\/(versions\/)?(Rashi on )?(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)/, 1200]];
  await page.evaluate(() => { openChabadPanel('chumash'); });
  await sleep(150);
  await close();
  await open('tanya');
  await scrollBy(900); const ta = await where();
  await settle(1500);                        // Chumash arrives now
  const shows = await readerShows(), ta2 = await where();
  expect(/Tanya|Likkutei/.test(shows || ''), 'still Tanya', shows);
  expect(same(ta, ta2), 'Tanya place not moved', { ta, ta2 });
  await close();
  delays = [];
  await open('chumash');
  expect((await readerShows())?.startsWith(startOf(await chumashRef(0))), 'Chumash opens with today\'s Chumash', await readerShows());
});

await test('going through days quickly: the last day you picked is the one shown', async () => {
  const d2 = await chumashRef(-2);
  await open('chumash');
  delays = [[/(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)/, 1500]];
  await page.evaluate(() => _readerGoDay(-1));
  await sleep(600);                          // yesterday's text is on its way (slowly)
  delays = [];
  await page.evaluate(() => _readerGoDay(-1));
  await settle(2000);
  expect((await readerShows())?.startsWith(startOf(d2)), 'two days ago', { shows: await readerShows(), d2 });
  const label = await page.evaluate(() => dayOffset);
  expect(label === -2, 'on day -2', label);
});

await test('opened twice while loading: the second copy arriving doesn\'t jump you', async () => {
  delays = [[/(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)/, 1400]];
  await page.evaluate(() => openChabadPanel('chumash'));
  await sleep(200); await close();
  delays = [];
  await open('chumash');                     // loads again, quickly
  await scrollBy(1800); const a = await where();
  await settle(1400);                        // the first load arrives now
  const b = await where();
  expect(same(a, b), 'not moved', { a, b });
});

await test('text that grows above you after you\'re placed (fonts, the guide) doesn\'t move you', async () => {
  await open('tanya'); await scrollBy(1500); const a = await where(); await close();
  await open('tanya');
  // Something above the text grows a moment after opening
  await page.evaluate(() => { const c = document.getElementById('native-reader-content'); const x = document.createElement('div'); x.style.height = '700px'; c.prepend(x); });
  await settle(400);
  const b = await where();
  expect(same(a, b), 'still at the passage', { a, b });
});

await test('once you scroll, nothing moves you back', async () => {
  await open('tanya'); await scrollBy(1500); await close();
  await open('tanya');
  await scrollBy(-600); const mine = await where();
  await page.evaluate(() => { const c = document.getElementById('native-reader-content'); const x = document.createElement('div'); x.style.height = '1px'; c.append(x); });
  await settle(1200);
  const b = await where();
  expect(same(mine, b), 'stays where you scrolled', { mine, b });
});

await test('the Tanya guide arriving keeps your passage', async () => {
  guide = { blocks: Array.from({ length: 20 }, (_, i) => ({ he: 'פסקה ' + i + ' ' + 'מילים '.repeat(30), en: `Tanya, Part I; Likkutei Amarim guide v${i + 1}.${filler(8)}`, heading: i % 4 ? '' : 'Step ' + i })), intro: '', recap: 'A recap. '.repeat(30), summary: 'x' };
  delays = [[/tanya-enhance/, 1500]];
  await page.evaluate(() => openChabadPanel('tanya')); await settle(400);
  await scrollBy(1500); const a = await where();
  await settle(1600);                         // the guide comes in
  const b = await where();
  expect(b && b.text.includes('guide'), 'guide shown', b);
  // The guide's pieces have new words, so the place is the same proportion through the text
  expect(Math.abs(parseInt(a.text.match(/v(\d+)$/)[1]) - parseInt(b.text.match(/v(\d+)$/)[1])) <= 3, 'about the same passage', { a, b });
});

await test('Tehillim and Rambam: each keeps its own place too', async () => {
  await open('tehillim');
  const range = await page.evaluate(() => document.querySelector('#native-reader-content .th-range')?.textContent || null);
  expect(/Psalms/.test(range || ''), 'Tehillim shown', range);
  await scrollBy(1200); const t = await where();
  await open('rambam'); await scrollBy(900); const r = await where();
  await open('tehillim'); const t2 = await where();
  await open('rambam'); const r2 = await where();
  expect(t.y > 600 && r.y > 400, 'really scrolled into both', { t, r });
  expect(same(t, t2) && same(r, r2), 'both kept', { t, t2, r, r2 });
});

await test('switching language or text size keeps your passage', async () => {
  await open('chumash'); await scrollBy(2400); const a = await where();
  await page.evaluate(() => _setChumashLang('en')); await settle(300);
  const b = await where();
  await page.evaluate(() => _readerFontStep(1)); await settle(300);
  const c = await where();
  await page.evaluate(() => { _readerFontStep(-1); _setChumashLang('both'); }); await settle(300);
  expect(a.text === b.text && b.text === c.text, 'same passage', { a, b, c });
});

await test('changing the Chumash translation keeps your place, and the saved place', async () => {
  await open('chumash'); await scrollBy(2400); const a = await where();
  await page.evaluate(() => _setChumashTranslation('koren'));
  await settle(800);
  const b = await where();
  await close(); await open('chumash'); const c = await where();
  expect(a.text === b.text && same(b, c), 'kept', { a, b, c });
});

await test('leaving the app (switching apps) saves your place right away', async () => {
  await open('rambam');
  await page.mouse.move(200, 400); await page.mouse.wheel(0, 1800); await sleep(60);
  const a = await where();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; });
  const saved = await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('scroll_rambam_')));
  expect(saved, 'saved', a);
});

await test('back at the top: next time it opens at the top', async () => {
  await open('chumash'); await scrollBy(2400); await scrollBy(-5000); await close();
  await open('chumash'); const b = await where();
  expect(b?.into < 40 && (b.text === 'top' || /v1$/.test(b.text)), 'at the top', b);
});

await test('the same words twice (your own Tehillim chapter is also today\'s): back at the right one', async () => {
  const r = await page.evaluate(async () => {
    const reader = document.getElementById('native-reader');
    const c = document.getElementById('native-reader-content');
    document.getElementById('chabad-panel').style.display = 'flex'; reader.style.display = 'flex'; c.style.display = 'block';
    const ch = 'Psalms 20 v1. ' + 'the words of the psalm '.repeat(120);
    c.innerHTML = '<p>' + ch + '</p><p>Between the two</p><p>' + ch + '</p><div style="height:2000px"></div>';
    const second = c.querySelectorAll('p')[2];
    reader.scrollTop += second.getBoundingClientRect().top - reader.getBoundingClientRect().top + 100;
    const place = _readerPlace();
    reader.scrollTop = 0;
    const y = _placeY(place);
    const want = second.getBoundingClientRect().top - reader.getBoundingClientRect().top + 100;
    document.getElementById('chabad-panel').style.display = 'none'; c.innerHTML = '';
    return [Math.round(y), Math.round(want)];
  });
  expect(Math.abs(r[0] - r[1]) < 4, 'the second one', r);
});

await test('Today keeps its place while you read', async () => {
  await page.evaluate(() => { const x = document.createElement('div'); x.id = 'tall'; x.style.height = '3000px'; document.getElementById('main-app').append(x); window.scrollTo(0, 400); });
  await open('chumash'); await scrollBy(1500); await close();
  const y = await page.evaluate(() => { const y = window.scrollY; document.getElementById('tall').remove(); return y; });
  expect(y === 400, 'Today where you left it', y);
});

await test('the page behind the reader doesn\'t scroll with it', async () => {
  const v = await page.evaluate(() => getComputedStyle(document.getElementById('native-reader')).overscrollBehaviorY);
  expect(v === 'contain' || v === 'none', 'reader keeps its scrolling to itself', v);
});

const errs = pageErrors.filter(m => !/Failed to fetch|NetworkError|Load failed/.test(m));
if (errs.length) { failed++; console.log('  ✗ no errors on the page\n      ', errs.slice(0, 5)); }
await browser.close(); server.close();
console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
