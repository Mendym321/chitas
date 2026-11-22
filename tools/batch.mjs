/**
 * The weekly guide batch's helper (see docs/guides-batch.md, the playbook).
 *
 *   node batch.mjs plan  [--from YYYY-MM-DD] [--days 10]   what's coming, and what still needs a guide
 *   node batch.mjs tanya "Likkutei Amarim 5|1|7"            a Tanya portion's text, to write its guide
 *   node batch.mjs pieces "Likkutei Amarim 5|1|7"           a written portion's pieces, with word counts
 *   node batch.mjs rambam "Hiring 11"                       a Rambam chapter's text, to write its guide and splits
 *   node batch.mjs check [--from YYYY-MM-DD] [--days 10]    everything written for those days, against the real text
 *
 * Run from tools/ with: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
 * `check` exits 1 if anything written doesn't fit the text: then nothing goes live.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), 'utf8');
const json = p => JSON.parse(read(p));
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => { const i = args.indexOf('--' + name); return i > 0 ? args[i + 1] : def; };
const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const FROM = opt('from', addDays(nyToday(), 1)), DAYS = +opt('days', 10);
const dates = Array.from({ length: DAYS }, (_, i) => addDays(FROM, i));

const { tanyaPortion, tanyaYomiItem } = await import('../api/_lib/tanya-portion.js');
const { writtenKey } = await import('../api/_lib/tanya-written.js');
const { WRITTEN } = await import('../api/_lib/tanya-written-data.js');
const { fetchChapter, writtenBlocks } = await import('../api/_lib/tanya-guide.js');
const { writtenGuide } = await import('../api/_lib/tanya-written.js');
const { cleanTanyaHtml, isHagahahHtml, withoutNotes } = await import('../api/_lib/tanya-text.js');
const { hebrewStarts } = await import('../api/_lib/tanya-split.js');
const { cleanHe, enParagraphs } = await import('../api/_lib/rambam-paras.js');

// The Chumash day (parsha and aliyah), from the app's own code
const ctx = { console, Date, Math, JSON };
vm.createContext(ctx);
for (const f of ['js/chumash-data.js', 'js/chumash.js']) vm.runInContext(read(f), ctx);
const chumashKeys = iso => { const d = vm.runInContext(`getChumashDay(new Date('${iso}T12:00:00'))`, ctx); return d ? d.parsha.split('-').map(p => p + ' ' + d.aliyah) : []; };

// Tanya: the book name in a written key ↔ Sefaria's address
const PARTS = { 'Likkutei Amarim': 'Tanya,_Part_I;_Likkutei_Amarim', 'Shaar HaYichud VehaEmunah': 'Tanya,_Part_II;_Shaar_HaYichud_VehaEmunah',
  'Iggeret HaTeshuvah': 'Tanya,_Part_III;_Iggeret_HaTeshuvah', 'Iggeret HaKodesh': 'Tanya,_Part_IV;_Iggeret_HaKodesh', 'Kuntres Acharon': 'Tanya,_Part_V;_Kuntres_Acharon' };
// The opening pages and Chinuch Katan ("…Likkutei_Amarim,_Approbation.3") have their own built-in reader
const builtIn = p => p && /;_[^.]*,_/.test(p.chapterSlug) ? null : p;
const keyToSlug = key => { const m = key.split('|')[0].match(/^(.*) (\d+)$/); return PARTS[m[1]] + '.' + m[2]; };

// Rambam: the day's chapters on each track, from Hebcal (the app's own source)
const OPENING = /^(Transmission of the Oral Law|Positive Mitzvot|Negative Mitzvot|Overview of Mishneh Torah Contents)$/;
async function rambamDays() {
  const r = await fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&dr3=on&dr1=on&start=${dates[0]}&end=${dates.at(-1)}`).then(r => r.json());
  const out = {};
  for (const it of r.items || []) {
    const track = it.category === 'dailyRambam3' ? '3' : it.category === 'dailyRambam1' ? '1' : null;
    if (!track) continue;
    const chapters = [];
    for (const part of it.title.split(/(?<=\d), /)) {
      const m = part.match(/^(.+?) (\d+)(?::\d+)?(?:-(\d+)(?::\d+)?)?$/);
      if (!m || OPENING.test(m[1])) continue;   // the opening pieces have their own reader
      for (let c = +m[2]; c <= +(m[3] || m[2]); c++) chapters.push(m[1] + ' ' + c);
    }
    (out[it.date] ||= {})[track] = chapters;
  }
  return out;
}

async function fetchRambam(title) {
  const ref = 'Mishneh Torah, ' + title, enc = encodeURIComponent(ref);
  const V = 'english|Mishneh Torah, trans. by Eliyahu Touger. Jerusalem, Moznaim Pub. c1986-c2007';
  const flat = x => typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : [];
  // Sefaria sometimes answers a burst of requests with an error page: wait and ask again
  const json = async url => {
    for (let tries = 0; ; tries++) {
      try { return await fetch(url).then(r => r.json()); }
      catch (e) { if (tries >= 4) throw e; await new Promise(r => setTimeout(r, 15000 * (tries + 1))); }
    }
  };
  const [en, he] = await Promise.all([
    json(`https://www.sefaria.org/api/v3/texts/${enc}?version=${encodeURIComponent(V)}&fill_in_missing_segments=1`),
    json(`https://www.sefaria.org/api/texts/${enc}?context=0&commentary=0&lang=he`),
  ]);
  return { en: flat(en?.versions?.[0]?.text || []), he: flat(he?.he || []).map(cleanHe) };
}
const noVowels = s => String(s).replace(/[֑-ֽֿ-ׇ]/g, '').normalize('NFKD').replace(/[֑-ׇ]/g, '');
const words = s => String(s || '').split(/\s+/).filter(Boolean).length;

if (cmd === 'plan') {
  const rambamAi = json('data/guides/rambam-ai.json'), chumash = json('data/guides/chumash.json');
  const rd = await rambamDays();
  const todo = { tanya: [], rambam: new Set(), chumash: [] };
  for (const iso of dates) {
    const p = builtIn(await tanyaPortion(iso));
    let tanya;
    if (p) { const key = writtenKey(p.chapterSlug, p.startVerse, p.endVerse); tanya = key + (WRITTEN[key] ? (WRITTEN[key].flow === 'bridges' ? '  ✓ written' : '  (old style)') : '  ✗ to write'); if (!WRITTEN[key] || WRITTEN[key].flow !== 'bridges') todo.tanya.push(key); }
    else tanya = ((await tanyaYomiItem(iso))?.url || 'none') + '  (built-in: not chapters)';
    const ch = chumashKeys(iso).map(k => k + (chumash[k] ? ' ✓' : ' ✗'));
    chumashKeys(iso).filter(k => !chumash[k]).forEach(k => todo.chumash.push(k));
    const rm = ['3', '1'].map(t => (rd[iso]?.[t] || []).map(c => { if (!rambamAi[c]) todo.rambam.add(c); return c + (rambamAi[c] ? ' ✓' : ' ✗'); }).join(', '));
    console.log(`${iso}\n  Tanya:   ${tanya}\n  Rambam:  3 chapters: ${rm[0] || '(built-in)'}\n           1 chapter:  ${rm[1] || '(built-in)'}\n  Chumash: ${ch.join(', ') || '(none)'}`);
  }
  console.log('\nTO WRITE\n  Tanya:   ' + (todo.tanya.join('  ·  ') || 'nothing') + '\n  Rambam:  ' + ([...todo.rambam].join('  ·  ') || 'nothing') + '\n  Chumash: ' + ([...new Set(todo.chumash)].join('  ·  ') || 'nothing'));
} else if (cmd === 'tanya') {
  const key = args[1], [, from, to] = key.split('|');
  const c = await fetchChapter(keyToSlug(key));
  const end = to === 'end' ? c.allHe.length : +to;
  console.log(key, '·', end - from + 1, 'segments (of', c.allHe.length + ')');
  for (let i = +from - 1; i < end; i++) {
    console.log('\n[' + (i + 1) + ']' + (isHagahahHtml(c.allHe[i], c.allEn[i]) ? ' (GLOSS: no bridge on it)' : ''));
    console.log('HE: ' + noVowels(cleanTanyaHtml(c.allHe[i])));
    console.log('EN: ' + withoutNotes(cleanTanyaHtml(c.allEn[i], [])));
  }
} else if (cmd === 'pieces') {
  // A written portion as the reader shows it: each piece's English word count (>> over 15), and the bridges
  const key = args[1], [, from, to] = key.split('|'), slug = keyToSlug(key);
  const c = await fetchChapter(slug);
  const s = +from - 1, e = to === 'end' ? c.allHe.length : +to;
  const he = c.allHe.slice(s, e), en = c.allEn.slice(s, e);
  const blocks = writtenBlocks(writtenGuide(slug, +from, to === 'end' ? null : +to), he.map(x => cleanTanyaHtml(x)), en.map(x => cleanTanyaHtml(x, [])), he.map((x, i) => isHagahahHtml(x, en[i])), +from);
  if (!blocks) { console.log(key + ': no written entry, or a cut not in the text'); process.exit(1); }
  for (const b of blocks) {
    if (b.heading) console.log('   [bridge] ' + b.heading);
    const t = withoutNotes(String(b.en || '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (t) console.log((words(t) > 15 ? '>> ' : '   ') + String(words(t)).padStart(2) + ' | ' + t);
  }
} else if (cmd === 'rambam') {
  const { en, he } = await fetchRambam(args[1]);
  console.log(args[1], '·', en.length, 'halachos');
  en.forEach((e, i) => {
    const paras = enParagraphs(e);
    console.log('\n[halacha ' + (i + 1) + ']' + (paras.length > 1 ? ' ' + paras.length + ' English paragraphs: splits needed for 2..' + paras.length : ''));
    console.log('HE: ' + noVowels(he[i] || ''));
    paras.forEach((p, k) => console.log('EN ' + (k + 1) + ': ' + p));
  });
} else if (cmd === 'check') {
  let errors = 0, warnings = 0;
  const err = m => { errors++; console.log('  ✗ ' + m); };
  const warn = m => { warnings++; console.log('  ! ' + m); };
  let rambamAi, chumash;
  try { rambamAi = json('data/guides/rambam-ai.json'); chumash = json('data/guides/chumash.json'); json('data/guides/rambam.json'); json('data/guides/rambam-heads.json'); }
  catch (e) { err('a guide file is not valid JSON: ' + e.message); }
  // Tanya: every written bridges entry for these days fits its text
  console.log('Tanya');
  for (const iso of dates) {
    const p = builtIn(await tanyaPortion(iso));
    if (!p) continue;
    const key = writtenKey(p.chapterSlug, p.startVerse, p.endVerse), w = WRITTEN[key];
    if (!w) { warn(`${iso} ${key}: no written guide (the server's AI will write one)`); continue; }
    if (w.flow !== 'bridges') continue;
    const c = await fetchChapter(p.chapterSlug);
    const s = p.startVerse - 1, e = p.endVerse ?? c.allHe.length;
    const he = c.allHe.slice(s, e), en = c.allEn.slice(s, e);
    const blocks = writtenBlocks(writtenGuide(p.chapterSlug, p.startVerse, p.endVerse), he.map(x => cleanTanyaHtml(x)), en.map(x => cleanTanyaHtml(x, [])), he.map((x, i) => isHagahahHtml(x, en[i])), p.startVerse);
    if (!blocks) { err(`${iso} ${key}: a segment or cut isn't in the text`); continue; }
    const bridges = blocks.filter(b => b.heading);
    if (bridges.some(b => words(b.heading) > 45)) warn(`${iso} ${key}: a bridge over 45 words`);
    if (bridges.length > 7) warn(`${iso} ${key}: ${bridges.length} bridges (usually 3 to 6)`);
    if (!w.summary || !(w.intro || w.recap)) err(`${iso} ${key}: needs an intro (chapter start) or recap, and a summary`);
    const long = blocks.filter(b => words(withoutNotes(b.en)) > 30).length;
    if (long) warn(`${iso} ${key}: ${long} pieces over 30 words`);
    console.log(`  ✓ ${iso} ${key}: ${blocks.length} pieces, ${bridges.length} bridges`);
  }
  // Rambam: every written entry's splits are found in the Hebrew, notes and headings on real halachos
  console.log('Rambam');
  const rd = await rambamDays();
  const titles = [...new Set(dates.flatMap(iso => [...(rd[iso]?.['3'] || []), ...(rd[iso]?.['1'] || [])]))];
  for (const t of titles) {
    const g = rambamAi?.[t];
    if (!g) { warn(`${t}: no written guide (the server's AI will write one)`); continue; }
    const { en, he } = await fetchRambam(t);
    const n = en.length;
    let bad = 0;
    for (const [h, starts] of Object.entries(g.splits || {})) {
      const i = +h - 1, paras = enParagraphs(en[i] || '');
      if (!he[i] || paras.length < 2) { err(`${t} ${h}: splits for a halacha without English paragraphs`); bad++; continue; }
      if (starts.length !== paras.length - 1) { err(`${t} ${h}: ${starts.length} starts for ${paras.length} English paragraphs (need ${paras.length - 1})`); bad++; continue; }
      const found = hebrewStarts(he[i], starts);
      found.forEach((at, k) => { if (at < 0 && starts[k]) { err(`${t} ${h}: start "${starts[k]}" (paragraph ${k + 2}) isn't in the Hebrew`); bad++; } });
    }
    for (const h of Object.keys(g.notes || {})) if (!(+h >= 1 && +h <= n)) { err(`${t}: a note on halacha ${h}, of ${n}`); bad++; }
    for (const [h] of g.heads || []) if (!(+h >= 1 && +h <= n)) { err(`${t}: a heading on halacha ${h}, of ${n}`); bad++; }
    if (!g.about) err(`${t}: no "about" line`);
    Object.values(g.notes || {}).forEach(x => { if (words(x.text) > 50) warn(`${t}: a note over 50 words`); });
    const multi = en.filter(e => enParagraphs(e).length > 1).length, done = Object.keys(g.splits || {}).length;
    if (done < multi) warn(`${t}: splits for ${done} of ${multi} halachos with English paragraphs`);
    if (!bad) console.log(`  ✓ ${t}: ${n} halachos, ${done} split, ${Object.keys(g.notes || {}).length} notes`);
  }
  // Chumash: a line for every day
  console.log('Chumash');
  for (const iso of dates) for (const k of chumashKeys(iso)) if (!chumash?.[k]) warn(`${iso} ${k}: no line`);
  console.log(`\n${errors} errors, ${warnings} warnings`);
  process.exit(errors ? 1 : 0);
} else {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0]);
}
