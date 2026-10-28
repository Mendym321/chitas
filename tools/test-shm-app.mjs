/**
 * Browser test of the Sefer HaMitzvos track: the Today tile, a day with our
 * own text, a day of mitzvos not written yet (Ibn Tibbon's Hebrew), and a day
 * that isn't a mitzvah. Internet blocked; Sefaria's Hebrew is a stand-in.
 *
 * Run:  cd tools && npm run test:shm      (-- --shots saves pictures to tools/.look/)
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = process.argv.includes('--shots') ? join(ROOT, 'tools/.look') : null;
if (SHOTS) await mkdir(SHOTS, { recursive: true });
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
async function openOn(iso) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  p.__errors = []; p.on('pageerror', e => p.__errors.push(e.message.split('\n')[0]));
  await p.clock.install({ time: new Date(iso + 'T10:00:00') });
  await p.route(u => !u.href.startsWith(url), r => {
    const u = r.request().url(), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com/converter')) return r.fulfill({ headers: H, json: { hd: 17, hm: 'Cheshvan', hy: 5787 } });
    if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [{ category: 'dailyLearning', title: 'Rambam: Sales 16-18' }] } });
    if (u.includes('sefaria.org/api/texts/Sefer')) { asked.push(decodeURIComponent(u.replace(/^.*texts\//, '').split('?')[0])); return r.fulfill({ headers: H, json: { he: ['היא שצונו. והוא אמרו. ולשון ספרא. וכבר התבאר. (שם, שם):'] } }); }
    return r.abort();
  });
  await p.addInitScript(d => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: 'm', started: true, lastDate: d, done: {} })); } } catch {} }, iso);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.rambam, null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => { document.getElementById('app-loader')?.remove(); document.getElementById('main-app')?.classList.add('ready'); });
  return p;
}
async function read(p) {
  await p.evaluate(() => openChabadPanel('rambam'));
  await p.waitForFunction(() => document.querySelector('#native-reader-content .tz-head'), null, { timeout: 5000 }).catch(() => {});
  return p.evaluate(() => {
    const c = document.getElementById('native-reader-content');
    return { heads: [...c.querySelectorAll('.tz-ch')].map(e => e.textContent), labels: [...c.querySelectorAll('.tz-en-label')].map(e => e.textContent),
      name: c.querySelector('.sm-name')?.textContent || null, rows: c.querySelectorAll('.sm-row').length, both: c.querySelectorAll('.sm-row.both').length,
      soon: c.querySelector('.sm-soon')?.textContent || null, same: !!c.querySelector('.sm-same'), tags: /<i>|&lt;i&gt;/.test(c.textContent),
      sub: document.getElementById('chabad-panel-sub').textContent };
  });
}

console.log('Today, Wed 28 Oct 2026 (day 268):');
{
  const p = await openOn('2026-10-28');
  ok('the Rambam tile says the mitzvah', await p.evaluate(() => schedule.rambam.subtitle), 'Negative Commandment 251');
  const r = await read(p);
  ok('a printed-page heading: מצות לא תעשה רנא, day 268', [r.heads, r.labels], [['מצות לא תעשה רנא'], ['Negative Commandment 251 · Day 268']]);
  ok('our digest, then the whole text side by side (5 paragraphs)', [r.name, r.rows, r.both], ['Not to hurt others with words', 5, 5]);
  ok('no stray tags, nothing downloaded', [r.tags, asked.length], [false, 0]);
  if (SHOTS) { await p.waitForTimeout(800); await p.screenshot({ path: join(SHOTS, 'shm-today.png') }); }
  await p.evaluate(() => _smSetLang('en'));
  ok('English only', await p.evaluate(() => [document.querySelectorAll('.sm-row .rd-he').length, document.querySelectorAll('.sm-row').length]), [0, 5]);
  ok('no errors', p.__errors, []);
  await p.close();
}
console.log('The next day repeats it, the day after that is new:');
{
  const p = await openOn('2026-10-30');   // day 270: N253, as day 269
  const r = await read(p);
  ok('day 270: N253 again, marked as the same as yesterday', [r.labels[0], r.same, r.name], ['Negative Commandment 253 · Day 270', true, 'Not to cheat a convert in business']);
  await p.close();
}
console.log('Five mitzvos not written yet (Sat 14 Nov, day 285):');
{
  asked.length = 0;
  const p = await openOn('2026-11-14');
  ok('the tile', await p.evaluate(() => schedule.rambam.subtitle), '5 mitzvos');
  const r = await read(p);
  ok('in their order, each with its heading', r.labels.map(l => l.split(' · ')[0]), ['Positive Commandment 232', 'Negative Commandment 258', 'Negative Commandment 259', 'Negative Commandment 257', 'Negative Commandment 260']);
  ok('"1 of 5 today"', r.labels[0].includes('1 of 5 today'), true);
  ok('Ibn Tibbon\'s Hebrew, from Sefaria, with a note', [r.soon, asked.length, r.rows > 0], ['Our English for this mitzvah is on its way. Here is the Hebrew.', 5, true]);
  ok('no errors', p.__errors, []);
  await p.close();
}
console.log('A day that isn\'t a mitzvah (Fri 8 Jan 2027, day 1):');
{
  const p = await openOn('2027-01-08');
  const r = await read(p);
  ok('named, not an error', [r.labels[0], r.sub], ['The Rambam\'s introduction · Day 1', 'The Rambam\'s introduction']);
  ok('no errors', p.__errors, []);
  await p.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll Sefer HaMitzvos app tests passed');
process.exit(failed ? 1 : 0);
