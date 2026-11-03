/**
 * Browser test: your place in the reader on every device. Two devices with
 * their own storage (a laptop and a phone) and one pretend account: read
 * halfway on the laptop, open on the phone at the same words. The newer place
 * wins; marking learned sends "top" too; signed out, nothing is sent; only
 * places are ever written. (The real database writes and rules: test-rules.mjs.)
 *
 * Run:  cd tools && npm run test:placesync
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const FIX = JSON.parse(await readFile(new URL('./fixtures/genesis-19-21.json', import.meta.url), 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.otf': 'font/otf' };
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

// The pretend account: only its places, and every write the app makes
const cloud = { places: {} }, writes = [];
// Every device's clock shows the same time, as real ones do (they set it from the internet)
const T0 = Date.now(), now = () => new Date(Date.parse('2026-10-28T10:00:00') + Date.now() - T0);

// A device: its own storage, signed in as u1 (or not), Wednesday 28 Oct
async function device(width, height, { signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.__errors = []; page.on('pageerror', e => page.__errors.push(e.message.split('\n')[0]));
  await page.clock.install({ time: now() });
  await page.exposeFunction('__savePlaces', (uid, places, drop) => {
    writes.push({ uid, keys: Object.keys(places), drop });
    Object.assign(cloud.places, places); drop.forEach(k => delete cloud.places[k]);
  });
  await page.route(u => !u.href.startsWith(url), r => {
    const u = decodeURIComponent(r.request().url()), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [] } });
    if (u.includes('/api/texts/versions/')) return r.fulfill({ headers: H, json: [{ language: 'en', versionTitle: 'Metsudah' }] });
    const m = u.match(/api\/texts\/(Rashi on )?Genesis (\d+)(?::(\d+)-(\d+))?\?/);
    if (!m) return r.abort();   // (Firebase too: the account is pretend)
    const [, rashi, ch, a, b] = m, t = (rashi ? FIX.rashi : FIX.torah)[ch];
    if (!t) return r.abort();
    return r.fulfill({ headers: H, json: { versionTitle: 'x', text: t.en.slice(a ? a - 1 : 0, b ? +b : undefined), he: t.he.slice(a ? a - 1 : 0, b ? +b : undefined) } });
  });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: '3', started: true, lastDate: '2026-10-28', done: {} }));
    localStorage.setItem('chitas_lang_chumash', 'en'); } } catch {} });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.chumash, null, { timeout: 8000 }).catch(() => {});
  // Signed in: the account (as loadUser hands it over) and its writes
  if (signedIn) await page.evaluate(places => {
    user.uid = 'u1';
    window._fb = { ...(window._fb || {}), saveUser: async () => {}, savePlaces: (uid, p, d) => window.__savePlaces(uid, p, d) };
    window._cloudPlacesIn(places);
  }, cloud.places);
  await page.evaluate(() => document.getElementById('app-loader')?.remove());
  return page;
}
const openChumash = async p => {
  await p.evaluate(() => openChabadPanel('chumash'));
  await p.waitForFunction(() => document.querySelector('#native-reader-content .rd-vn'), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);   // put back, and held
};
const topWords = p => p.evaluate(() => _readerPlace()?.a || null);
const close = p => p.evaluate(() => closeChabadPanel());
const KEY = 'scroll_chumash_2026-10-28';

console.log('Read on the laptop, open on the phone:');
const laptop = await device(1280, 900);
await openChumash(laptop);
await laptop.mouse.move(640, 500); await laptop.mouse.wheel(0, 2600); await laptop.waitForTimeout(900);
const there = await topWords(laptop);
await close(laptop); await laptop.waitForTimeout(300);
ok('closing sends the place to the account at once', [!!cloud.places[KEY]?.a, writes.length >= 1], [true, true]);
ok('only places are written, nothing else', writes.every(w => w.uid === 'u1' && w.keys.every(k => k.startsWith('scroll_'))), true);
const phone = await device(390, 844);
await openChumash(phone);
ok('the phone opens at the same words (a different width)', await topWords(phone), there);
ok('…not at the top', await phone.evaluate(() => document.getElementById('native-reader').scrollTop > 300), true);

console.log('The newer place wins:');
await phone.mouse.move(195, 500); await phone.mouse.wheel(0, 1500); await phone.waitForTimeout(900);
const phoneWords = await topWords(phone);
await close(phone); await phone.waitForTimeout(300);
await laptop.evaluate(places => window._cloudPlacesIn(places), cloud.places);   // the laptop comes back to the app
await openChumash(laptop);
ok('back on the laptop: where the phone left off', await topWords(laptop), phoneWords);
await close(laptop);
await phone.evaluate(() => { const k = 'scroll_chumash_2026-10-28', p = JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify({ ...p, t: 1 })); });
await phone.evaluate(places => window._cloudPlacesIn(places), { [KEY]: { y: 0, t: Date.now() + 1 } });
await openChumash(phone);
ok('an older place on the phone loses to a newer one (here: the top)', await phone.evaluate(() => document.getElementById('native-reader').scrollTop), 0);
await close(phone);

console.log('Marked learned: the top, everywhere:');
await phone.evaluate(places => window._cloudPlacesIn(places), cloud.places);
await openChumash(phone);
ok('(the phone is in the middle first)', await phone.evaluate(() => document.getElementById('native-reader').scrollTop > 300), true);
await phone.evaluate(() => { showConfirm('chumash', true); closeChabadPanel(); });
await phone.waitForTimeout(300);
ok('the account now says the top', cloud.places[KEY]?.y, 0);
await laptop.evaluate(places => window._cloudPlacesIn(places), cloud.places);
await openChumash(laptop);
ok('the laptop opens it at the top', await laptop.evaluate(() => document.getElementById('native-reader').scrollTop), 0);
await close(laptop);

console.log('Old places go, once a session:');
{
  cloud.places['scroll_tanya_2026-10-10'] = { y: 500, t: 1 };
  const p = await device(390, 844);
  await openChumash(p); await p.mouse.move(195, 500); await p.mouse.wheel(0, 900); await p.waitForTimeout(900); await close(p); await p.waitForTimeout(300);
  ok('a place from more than a week ago is removed from the account', 'scroll_tanya_2026-10-10' in cloud.places, false);
  ok('this week\'s stay', KEY in cloud.places, true);
  ok('no errors', p.__errors, []);
  await p.context().close();
}

console.log('Signed out:');
{
  const before = writes.length;
  const p = await device(390, 844, { signedIn: false });
  await openChumash(p); await p.mouse.move(195, 500); await p.mouse.wheel(0, 1200); await p.waitForTimeout(900); await close(p); await p.waitForTimeout(300);
  ok('nothing is sent', writes.length, before);
  ok('the place is still kept on the phone', await p.evaluate(() => !!JSON.parse(localStorage.getItem('scroll_chumash_2026-10-28') || 'null')?.a), true);
  ok('no errors', p.__errors, []);
  await p.context().close();
}

ok('no errors on the laptop or the phone', [...laptop.__errors, ...phone.__errors], []);
await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll place-sync tests passed');
process.exit(failed ? 1 : 0);
