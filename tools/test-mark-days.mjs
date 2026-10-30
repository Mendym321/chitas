/**
 * Browser test: the reader's bottom button follows the day on screen, not
 * today. Friday 30 Oct 2026: Wednesday's Chumash was learned, Thursday's
 * missed, today's not yet. Sefaria's real text (tools/fixtures).
 *
 * Run:  cd tools && npm run test:markdays
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
const shot = name => new URL('./.look/' + name + '.png', import.meta.url).pathname;

let failed = 0;
const ok = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
};

async function open(doneToday) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.__errors = []; page.on('pageerror', e => page.__errors.push(e.message.split('\n')[0]));
  await page.clock.install({ time: new Date('2026-10-30T10:00:00') });
  await page.route(u => !u.href.startsWith(url), r => {
    const u = decodeURIComponent(r.request().url()), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com/converter')) return r.fulfill({ headers: H, json: { hd: 19, hm: 'Cheshvan', hy: 5787 } });
    if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [{ category: 'dailyLearning', title: 'Psalms 90-96' }, { category: 'dailyLearning', title: 'Rambam: Sales 22-24' }] } });
    if (u.includes('/api/texts/versions/')) return r.fulfill({ headers: H, json: [{ language: 'en', versionTitle: 'Metsudah' }] });
    const m = u.match(/api\/texts\/(Rashi on )?Genesis (\d+)(?::(\d+)-(\d+))?\?/);
    if (!m) return r.abort();
    const [, rashi, ch, a, b] = m, t = (rashi ? FIX.rashi : FIX.torah)[ch];
    if (!t) return r.abort();
    const from = a ? +a - 1 : 0, to = b ? +b : undefined;
    return r.fulfill({ headers: H, json: { versionTitle: 'x', text: t.en.slice(from, to), he: t.he.slice(from, to) } });
  });
  await page.addInitScript(today => { try { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: '3', started: true, lastDate: '2026-10-30',
      done: today ? { chumash: true } : {}, pastDone: { '2026-10-28': { chumash: true } } }));
    localStorage.setItem('chitas_lang_chumash', 'en'); } } catch {} }, doneToday);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.chumash, null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { document.getElementById('app-loader')?.remove(); openChabadPanel('chumash'); });
  await page.waitForFunction(() => document.querySelector('#native-reader-content .rd-vn'), null, { timeout: 8000 }).catch(() => {});
  return page;
}
const btn = p => p.evaluate(() => { const b = document.getElementById('chabad-mark-btn'); return [b.dataset.state, document.getElementById('chabad-mark-label').textContent.trim(), !!b.onclick]; });
const back = async p => {
  await p.evaluate(() => _readerGoDay(-1));
  await p.waitForTimeout(700);
  await p.waitForFunction(() => document.querySelector('#native-reader-content .rd-vn'), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(400);
};

console.log("Today's Chumash not learned yet:");
{
  const p = await open(false);
  ok('today: Mark as learned', await btn(p), ['todo', 'Mark as learned', true]);
  await p.screenshot({ path: shot('mark-today') });
  await back(p);
  ok('Thursday, missed: Catch up · Mark Thursday as learned', await btn(p), ['todo', 'Catch upMark yesterday as learned', true]);
  await p.screenshot({ path: shot('mark-missed') });
  await back(p);
  ok('Wednesday, learned: no button, a small line (was "Mark as learned")', await btn(p), ['past', 'You learned this on Wednesday', false]);
  await p.screenshot({ path: shot('mark-learned') });
  ok('no errors', p.__errors, []);
  await p.close();
}
console.log("Today's Chumash already learned:");
{
  const p = await open(true);
  ok('today: Learned', await btn(p), ['done', 'Learned', false]);
  await back(p);
  ok('Thursday, missed, still says so (was "Learned")', (await btn(p))[0], 'todo');
  await p.click('#chabad-mark-btn');
  await p.waitForTimeout(300);
  ok('marking it: done, and the next step offered', await p.evaluate(() => [document.getElementById('reader-next').style.display, document.querySelector('#reader-next .rn-done')?.textContent, !!document.querySelector('#reader-next .rn-go')]), ['block', 'Chumash done', true]);
  ok('Thursday is now learned', await p.evaluate(() => !!(user.pastDone['2026-10-29'] || {}).chumash), true);
  await p.screenshot({ path: shot('mark-after') });
  ok('no errors', p.__errors, []);
  await p.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll mark-day tests passed');
process.exit(failed ? 1 : 0);
