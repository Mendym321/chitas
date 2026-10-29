/**
 * Browser test: every Rashi of the day's aliyah is shown. Vayera's fourth
 * aliyah (Bereishis 19:21–21:4, Wed 28 Oct 2026) runs over three chapters and
 * has 58 Rashis on 29 verses. Sefaria's real text (tools/fixtures). As on the
 * real Sefaria, a verse range ("Rashi on Genesis 20:1-150") brings the Rashi
 * and a whole chapter ("Rashi on Genesis 20") brings nothing to show: on the
 * phone, chapter 20 had no Rashi. Then a chapter that doesn't come at all:
 * the reader says so, and Try again brings it.
 *
 * Run:  cd tools && npm run test:rashi
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const FIX = JSON.parse(await readFile(new URL('./fixtures/genesis-19-21.json', import.meta.url), 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  let body;
  try { body = await readFile(join(ROOT, path === '/' ? 'index.html' : path)); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });

let failed = 0;
const ok = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
};

const asked = [];
let down = '';   // a chapter Sefaria doesn't answer for
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const errors = []; page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
await page.clock.install({ time: new Date('2026-10-28T10:00:00') });
await page.route(u => !u.href.startsWith(url), r => {
  const u = decodeURIComponent(r.request().url()), H = { 'Access-Control-Allow-Origin': '*' };
  if (u.includes('hebcal.com/converter')) return r.fulfill({ headers: H, json: { hd: 17, hm: 'Cheshvan', hy: 5787 } });
  if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [{ category: 'dailyLearning', title: 'Psalms 79-82' }, { category: 'dailyLearning', title: 'Rambam: Sales 13-15' }] } });
  if (u.includes('/api/texts/versions/')) return r.fulfill({ headers: H, json: [{ language: 'en', versionTitle: 'Rashi Chumash, Metsudah Publications, 2009' }] });
  const m = u.match(/api\/texts\/(Rashi on )?Genesis (\d+)(?::(\d+)-(\d+))?\?/);
  if (!m) return r.abort();
  const [, rashi, ch, a, b] = m;
  if (rashi) {
    asked.push(u.match(/texts\/([^?]+)/)[1]);
    if (!a) return r.fulfill({ headers: H, json: { versionTitle: 'x', text: [], he: [] } });   // whole chapter: nothing to show
    if (ch === down) return r.abort();
  }
  const t = (rashi ? FIX.rashi : FIX.torah)[ch], from = a ? +a - 1 : 0, to = b ? +b : undefined;
  return r.fulfill({ headers: H, json: { versionTitle: 'x', text: t.en.slice(from, to), he: t.he.slice(from, to) } });
});
await page.addInitScript(() => { try { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1');
  localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: '3', started: true, lastDate: '2026-10-28', done: {} }));
  localStorage.setItem('chitas_lang_chumash', 'both'); } } catch {} });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.chumash, null, { timeout: 8000 }).catch(() => {});

console.log('Vayera, fourth aliyah (Bereishis 19:21–21:4):');
await page.evaluate(() => openChabadPanel('chumash'));
await page.waitForFunction(() => document.querySelectorAll('#native-reader-content .rd-comm').length > 0, null, { timeout: 8000 }).catch(() => {});
const r = await page.evaluate(() => ({ ref: window._chumashData?.ref, shown: document.querySelectorAll('#native-reader-content .rd-comm').length,
  first: document.querySelector('#native-reader-content .rd-comm .rf-body')?.textContent.slice(0, 30) }));
ok('the aliyah', r.ref, 'Genesis 19:21-21:4');
ok('all 58 Rashis are shown, chapter 19 included', r.shown, 58);
ok('Rashi asked for as verse ranges only', [...new Set(asked)].sort(), ['Rashi on Genesis 19:21-150', 'Rashi on Genesis 20:1-150', 'Rashi on Genesis 21:1-4']);
ok('nothing missing: no note', await page.evaluate(() => !!document.getElementById('ch-missing')), false);
await page.evaluate(() => { localStorage.setItem('chitas_lang_chumash', 'en'); _renderChumashContent(); });
ok('English only: still all 58', await page.evaluate(() => document.querySelectorAll('#native-reader-content .rd-comm').length), 58);
await page.evaluate(() => { localStorage.setItem('chitas_lang_chumash', 'he'); _renderChumashContent(); });
ok('Hebrew only: still all 58', await page.evaluate(() => document.querySelectorAll('#native-reader-content .rd-comm').length), 58);

console.log('A chapter of Rashi that does not come:');
down = '20';
await page.evaluate(() => { localStorage.setItem('chitas_lang_chumash', 'both'); _dropTexts('chumash'); _reopenReader('chumash'); });
await page.waitForFunction(() => document.getElementById('ch-missing'), null, { timeout: 8000 }).catch(() => {});
ok('the reader says so', await page.evaluate(() => document.getElementById('ch-missing')?.textContent), "Some of today's Rashi didn't load. Try again");
ok('the rest of Rashi is still there (19 and 21)', await page.evaluate(() => document.querySelectorAll('#native-reader-content .rd-comm').length), 30);
down = '';
await page.click('#ch-missing button');
await page.waitForFunction(() => !document.getElementById('ch-missing') && document.querySelectorAll('#native-reader-content .rd-comm').length === 58, null, { timeout: 8000 }).catch(() => {});
ok('Try again brings all 58', await page.evaluate(() => [!!document.getElementById('ch-missing'), document.querySelectorAll('#native-reader-content .rd-comm').length]), [false, 58]);
ok('no errors', errors, []);

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll Rashi tests passed');
process.exit(failed ? 1 : 0);
