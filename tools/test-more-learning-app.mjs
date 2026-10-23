/**
 * Browser test for "More learning" (beta): the Add learning sheet, the rows on
 * Today, the readers (Daf Yomi, Nach Yomi, Halacha Yomis, the week's Likkutei
 * Torah) and marking, on a fixed day: Friday 23 October 2026, 12 Cheshvan 5787,
 * the week of Lech Lecha. Sefaria is faked (the internet is blocked) and every
 * text request is recorded, so we check the app asks for the right piece.
 *
 * Run:  cd tools && npm run test:more
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

const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
// The app's service worker would fetch Sefaria itself, out of the fake's reach
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.clock.setFixedTime(new Date('2026-10-23T10:00:00'));

// The internet is blocked, except a fake Sefaria that answers any text with
// numbered pieces (two chapters when the ref spans two)
const asked = [];
await page.route(u => !u.href.startsWith(url), r => r.abort());
await page.route(/sefaria\.org\/api\//, route => {
  const u = new URL(route.request().url());
  asked.push(decodeURIComponent(u.pathname.replace(/^\/api\/(v3\/)?texts\//, '').replace(/^\/api\//, '')) + u.search);
  if (u.pathname.startsWith('/api/links/')) {                    // one Rashi, on the 2nd line of amud beis
    const ref = decodeURIComponent(u.pathname.split('/links/')[1]);
    const m = ref.match(/^(.+) (\d+)a-\d+b$/);
    return route.fulfill({ json: m ? [{ collectiveTitle: { en: 'Rashi' }, anchorRef: m[1] + ' ' + m[2] + 'b:2', he: 'רש"י על ב', text: 'Rashi on b' }] : [] });
  }
  if (!u.pathname.includes('/texts/')) return route.fulfill({ json: [] });
  const ref = decodeURIComponent(u.pathname.split('/texts/')[1]);
  if (/\d+a-\d+b$/.test(ref)) {                                   // a daf: one list per amud
    if (u.pathname.startsWith('/api/v3/')) return route.fulfill({ json: { versions: [{ language: 'en', text: [['A 1', 'A 2', 'A 3'], ['B 1', 'B 2', 'B 3']] }] } });
    return route.fulfill({ json: { he: [['א 1', 'א 2', 'א 3'], ['ב 1', 'ב 2', 'ב 3']], text: [['A 1', 'A 2', 'A 3'], ['B 1', 'B 2', 'B 3']] } });
  }
  const he = n => Array.from({ length: n }, (_, i) => (i === 0 ? '<b>פתיחה של</b> ' : '') + 'טקסט ' + (i + 1));
  const en = n => Array.from({ length: n }, (_, i) => 'Text ' + (i + 1));
  const two = /\d+:\d+-\d+:\d+$/.test(ref);
  if (u.pathname.startsWith('/api/v3/')) return route.fulfill({ json: { versions: [{ language: 'en', text: en(3) }] } });
  route.fulfill({ json: two ? { he: [he(2), he(2)], text: [en(2), en(2)] } : { he: he(3), text: en(3) } });
});
await page.goto(url, { waitUntil: 'load' });

let failed = 0;
async function check(name, fn, expected, arg) {
  let actual;
  try { actual = await page.evaluate(fn, arg); } catch (e) { actual = 'THREW: ' + e.message.split('\n')[0]; }
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

console.log('More learning (beta):');

await page.evaluate(() => { user.extraTracks = []; user.done = {}; user.pastDone = {}; dayOffset = 0; _syncMoreLearning(); });

await check('"More learning" shows, with a Beta chip and an Add learning row', () => [
  document.getElementById('extra-tracks-separator').style.display,
  document.querySelector('#extra-tracks-separator .beta-chip')?.textContent,
  document.getElementById('add-learning-btn').style.display,
], ['flex', 'Beta', 'block']);

await check('the Add learning sheet offers the four tracks, with today\'s piece', async () => {
  _openExtraTracksMenu();
  await new Promise(r => setTimeout(r, 300));
  return [...document.querySelectorAll('#extra-tracks-modal .ml-row')].map(r => r.querySelector('.ml-t p').textContent + ' | ' + r.querySelector('.ml-t p + p').textContent);
}, [
  'Daf Yomi | A page of Gemara a day · Bechoros 35',
  'Nach Yomi | A chapter of Nach a day · Yirmiyahu 41',
  "Halacha Yomis | Kitzur Shulchan Aruch, a few se'ifim a day · Siman 10:20–26",
  "Likkutei Torah | The parsha's maamarim, once a week · Parshas Lech Lecha · Torah Ohr",
]);

await check('Add adds a track, and the button says Added', () => {
  ['dafYomi', 'nachYomi', 'kitzur', 'likkuteiTorah'].forEach(id => document.getElementById('ml-add-' + id).click());
  return [user.extraTracks, document.getElementById('ml-add-dafYomi').textContent, document.getElementById('add-learning-btn').style.display];
}, [['dafYomi', 'nachYomi', 'kitzur', 'likkuteiTorah'], 'Added', 'none']);

await check('Today has a row for each, with its piece (no network needed)', async () => {
  _closeExtraMenu();
  await new Promise(r => setTimeout(r, 300));
  return ['dafYomi', 'nachYomi', 'kitzur', 'likkuteiTorah'].map(id => document.getElementById('extra-sub-' + id).textContent);
}, ['Bechoros 35', 'Yirmiyahu 41', 'Siman 10:20–26', 'Parshas Lech Lecha · Torah Ohr']);
if (asked.some(a => a.startsWith('calendars'))) { failed++; console.log('  ✗ a row asked Sefaria\'s calendar:', asked); }
else console.log('  ✓ no row asked Sefaria\'s calendar');

asked.length = 0;
await check('Nach Yomi opens the day\'s chapter, in Koren, with verse numbers', async () => {
  await openExtraReader('nachYomi');
  return [document.getElementById('chabad-panel-sub').textContent,
          document.querySelector('#native-reader-content .seg-n')?.textContent,
          document.getElementById('native-reader-content').textContent.includes('טקסט 1')];
}, ['Yirmiyahu 41', '1', true]);
if (!asked.some(a => a.startsWith('Jeremiah 41') && a.includes('Koren'))) { failed++; console.log('  ✗ Nach asked for', asked); }

asked.length = 0;
await check('Halacha Yomis opens Kitzur 10:20–26, numbered from seif 20', async () => {
  closeChabadPanel();
  await openExtraReader('kitzur');
  return [document.getElementById('chabad-panel-sub').textContent, document.querySelector('#native-reader-content .seg-n')?.textContent];
}, ['Siman 10:20–26', '20']);
if (!asked.some(a => a.startsWith('Kitzur Shulchan Arukh 10:20-26'))) { failed++; console.log('  ✗ Kitzur asked for', asked); }

asked.length = 0;
await check('Daf Yomi opens both sides of Bechoros 35', async () => {
  closeChabadPanel();
  await openExtraReader('dafYomi');
  return [document.getElementById('chabad-panel-sub').textContent, document.getElementById('native-reader-content').textContent.includes('Talmud Bavli')];
}, ['Bechoros 35', true]);
if (!asked.some(a => a.startsWith('Bekhorot 35a-35b'))) { failed++; console.log('  ✗ Daf asked for', asked); }

await check('Rashi on amud beis sits beside amud beis (not amud aleph)', () =>
  [_dafData.allHe.length, _dafData.rashiHe.indexOf('רש"י על ב'), _dafData.allHe[4]], [6, 4, 'ב 2']);

await check('Rashi with English: two columns; without English: all the way across', () => {
  localStorage.setItem('chitas_lang_extra_dafYomi', 'both'); localStorage.setItem('chitas_daf_commentary', 'rashi');
  _rerenderDaf();
  const grid = () => [...document.querySelectorAll('#native-reader-content div')].filter(d => d.textContent.startsWith('רש"י') && d.querySelector('div[style*="grid"]')).length;
  const withEn = grid();
  _dafData.rashiEn = _dafData.rashiEn.map(() => ''); _rerenderDaf();
  const withoutEn = grid();
  const full = [...document.querySelectorAll('#native-reader-content p')].some(p => p.textContent === 'רש"י על ב' && p.style.width === '100%');
  localStorage.removeItem('chitas_daf_commentary');
  return [withEn, withoutEn, full];
}, [1, 0, true]);

await check('the Gemara\'s English looks like every other reader\'s (same font and size as Nach)', async () => {
  const enStyle = () => { const p = [...document.querySelectorAll('#native-reader-content p')].find(e => /^(A|Text) \d/.test(e.textContent.replace(/^\d+\s*/, '')));
    const c = p && getComputedStyle(p); return c && [c.fontFamily.split(',')[0], c.fontSize, c.lineHeight]; };
  localStorage.setItem('chitas_lang_extra_dafYomi', 'both'); _rerenderDaf();
  const daf = enStyle();
  closeChabadPanel(); localStorage.setItem('chitas_lang_extra_nachYomi', 'both');
  await openExtraReader('nachYomi');
  const nach = enStyle();
  closeChabadPanel(); await openExtraReader('dafYomi');
  return [daf, daf && daf[0] === nach[0] && daf[1] === nach[1] && daf[2] === nach[2]];
}, [['"Crimson Pro"', '15px', '27.3px'], true]);

await check('the daf heads like a page of Shas, with each amud marked', () =>
  [_dafData.head.startsWith('דף לה') || _dafData.head.includes('דף לה'), [...document.querySelectorAll('.g-amud')].map(e => e.textContent)], [true, ['דף לה ע״א', 'דף לה ע״ב']]);

await check('tapping a line opens its Rashi under it (and only its), tapping again closes it', () => {
  localStorage.setItem('chitas_lang_extra_dafYomi', 'he'); localStorage.removeItem('chitas_daf_commentary');
  _rerenderDaf();
  const chips = document.querySelectorAll('.g-chips').length;
  _dafTap(4);
  const opened = [...document.querySelectorAll('#native-reader-content .g-seg')].filter(d => d.textContent.includes('רש"י על ב')).length;
  _dafTap(4);
  const closed = document.getElementById('native-reader-content').textContent.includes('רש"י על ב');
  return [chips, opened, closed];
}, [1, 1, false]);

asked.length = 0;
await check('Me\'ilah 22 (in March): the Gemara, then Kinnim\'s first perek under its own heading', async () => {
  closeChabadPanel();
  dayOffset = Math.round((Date.parse('2027-03-12T12:00:00') - Date.parse('2026-10-23T12:00:00')) / 864e5);
  await openExtraReader('dafYomi');
  const c = document.getElementById('native-reader-content').textContent;
  const r = [document.getElementById('chabad-panel-sub').textContent, c.includes('Talmud Bavli and Mishnah'), c.includes('Mishnah Kinnim'), c.includes('all of its first perek')];
  closeChabadPanel(); dayOffset = 0;
  return r;
}, ["Me'ilah 22", true, true, true]);
if (!asked.some(a => a.startsWith('Meilah 22a?')) || !asked.some(a => a.startsWith('Mishnah Kinnim 1:1-4'))) { failed++; console.log('  ✗ Me\'ilah 22 asked for', asked); }

await check('ticking Halacha Yomis marks it, says so, and leaves the day\'s four rings alone', async () => {
  closeChabadPanel();
  _toggleTrack('kitzur');
  await new Promise(r => setTimeout(r, 50));
  return [user.done.kitzur, document.getElementById('toast').textContent, sectionsDone(user.done),
          document.querySelector('#extra-card-kitzur .check').classList.contains('on')];
}, [true, 'Nice! Halacha Yomis done.', 0, true]);

await check('ticking it again unmarks it', () => { _toggleTrack('kitzur'); return [!!user.done.kitzur, document.querySelector('#extra-card-kitzur .check').classList.contains('on')]; }, [false, false]);

asked.length = 0;
await check('Likkutei Torah opens the week\'s maamarim: Torah Ohr on Lech Lecha', async () => {
  await openExtraReader('likkuteiTorah');
  return [document.getElementById('chabad-panel-sub').textContent, document.querySelectorAll('.lt-m').length,
          document.querySelectorAll('.lt-m-t')[1].textContent, document.querySelector('.lt-m-d').textContent.startsWith('Torah Ohr · about ')];
}, ['Parshas Lech Lecha', 6, 'אנכי מגן לך', true]);
if (asked.length) { failed++; console.log('  ✗ the list should need no network:', asked); }

await check('tapping a maamar opens it like the printed sefer (title, bold opening, Heilig), with a way back', async () => {
  await _ltOpen(1);
  const c = document.getElementById('native-reader-content');
  return [c.querySelector('.lt-title')?.textContent.startsWith('פרשת') && c.querySelector('.lt-body .lt-open')?.textContent === 'פתיחה של' && !c.querySelector('.lt-body b') && getComputedStyle(c.querySelector('.lt-open')).fontWeight === '400' ? 'אנכי מגן לך' : c.innerHTML.slice(0, 300), !!c.querySelector('.lt-back'), getComputedStyle(c.querySelector('.lt-body')).fontFamily.startsWith('DachHeilig')];
}, ['אנכי מגן לך', true, true]);
if (!asked.some(a => a.startsWith('Torah Ohr, Lech Lecha 2'))) { failed++; console.log('  ✗ the maamar asked for', asked); }

await check('back goes to the list', () => { _ltBack(); return document.querySelectorAll('.lt-m').length; }, 6);

await check('your place in a maamar is kept for the whole week (by its Shabbos)', async () => {
  await _ltOpen(1);
  return [_rv.sid, _rv.iso];
}, ['extra_likkuteiTorah:Torah Ohr, Lech Lecha 2', '2026-10-24']);

await check('Likkutei Torah marked on Wednesday counts for the week, here on Friday', async () => {
  closeChabadPanel();
  dayOffset = -2; _toggleTrack('likkuteiTorah');                 // Wednesday
  dayOffset = 0; _renderExtraTrackCards(_viewedISO(), true);     // back to Friday
  return [user.pastDone['2026-10-21']?.likkuteiTorah, !!user.done.likkuteiTorah,
          document.querySelector('#extra-card-likkuteiTorah .check').classList.contains('on')];
}, [true, false, true]);

await check('and the reader says it\'s learned this week', async () => {
  await openExtraReader('likkuteiTorah');
  return [document.getElementById('chabad-mark-btn').dataset.state, document.getElementById('chabad-mark-label').textContent];
}, ['done', 'Learned this week']);

await check('unticking it on Friday removes Wednesday\'s mark', () => {
  closeChabadPanel();
  _toggleTrack('likkuteiTorah');
  return [!!user.pastDone['2026-10-21']?.likkuteiTorah, document.querySelector('#extra-card-likkuteiTorah .check').classList.contains('on')];
}, [false, false]);

await check('next week is a new week: Vayera', async () => {
  dayOffset = 2;
  const p = await _trackPiece('likkuteiTorah', _viewedISO());
  dayOffset = 0;
  return [p.parsha, p.books];
}, ['Vayera', 'Torah Ohr']);

await check('more than 7 days back is read only', async () => {
  dayOffset = -9;
  _toggleTrack('nachYomi');
  const t = document.getElementById('toast').textContent;
  await openExtraReader('nachYomi');
  const label = document.getElementById('chabad-mark-label').textContent;
  closeChabadPanel(); dayOffset = 0;
  return [Object.values(user.pastDone).some(d => d.nachYomi), t, label];
}, [false, 'Read only. You can mark today and the last 7 days.', 'Read only']);

await page.unroute(/sefaria\.org\/api\//);
await check('when Sefaria can\'t be reached, the reader says so', async () => {
  await openExtraReader('nachYomi');
  const t = document.getElementById('native-reader-content').textContent;
  closeChabadPanel();
  return t;
}, 'Could not load content. Please try again.');

if (pageErrors.length) { failed++; console.log('  ✗ page errors:', pageErrors); }
await browser.close();
server.close();
if (failed) { console.log('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll passed');
