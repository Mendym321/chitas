/**
 * Browser test: your reading choices on every device. Two devices with their
 * own storage and one pretend account: choose on the laptop, the phone uses it
 * when it next loads your account; the newer choice wins; text size and
 * light/dark stay with the device; signed out, nothing is sent; only choices
 * are written. (The real database writes and rules: test-rules.mjs.)
 *
 * Run:  cd tools && npm run test:prefsync
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf' };
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

// The pretend account: its choices, and every write the app makes
const cloud = { prefs: {} }, writes = [];
const T0 = Date.now(), now = () => new Date(Date.parse('2026-10-28T10:00:00') + Date.now() - T0);

async function device({ signedIn = true, seed = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.__errors = []; page.on('pageerror', e => page.__errors.push(e.message.split('\n')[0]));
  await page.clock.install({ time: now() });
  await page.exposeFunction('__savePrefs', (uid, prefs) => { writes.push({ uid, keys: Object.keys(prefs) }); Object.assign(cloud.prefs, prefs); });
  await page.route(u => !u.href.startsWith(url), r => {
    const u = r.request().url(), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com/converter')) return r.fulfill({ headers: H, json: { hd: 12, hm: 'Cheshvan', hy: 5787 } });
    if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [] } });
    return r.abort();
  });
  await page.addInitScript(seed => { try { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: '3', started: true, lastDate: '2026-10-28', done: {} }));
    for (const k in seed) localStorage.setItem(k, seed[k]); } } catch {} }, seed);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(signedIn => {
    window._fb = { ...(window._fb || {}), saveUser: async () => {}, savePlaces: async () => {}, savePrefs: (uid, p) => window.__savePrefs(uid, p) };
    if (signedIn) user.uid = 'u1';
  }, signedIn);
  return page;
}
const loadAccount = p => p.evaluate(prefs => window._cloudPrefsIn(prefs), JSON.parse(JSON.stringify(cloud.prefs)));
const get = (p, k) => p.evaluate(k => localStorage.getItem(k), k);
const tap = async p => { await p.mouse.click(5, 400); await p.clock.runFor(2500); await p.waitForTimeout(100); };

console.log('Choose on the laptop, the phone follows:');
const laptop = await device({ seed: { chitas_lang_tehillim: 'he', chitas_reader_font_step: '2' } });
await loadAccount(laptop);
await laptop.clock.runFor(60000);   // later, a choice
await laptop.evaluate(() => { localStorage.setItem('chitas_lang_tehillim', 'both'); localStorage.setItem('chitas_tehillim_translation', 'koren'); });
await tap(laptop);
ok('a tap later, the choices go to the account', [cloud.prefs.chitas_lang_tehillim?.v, cloud.prefs.chitas_tehillim_translation?.v], ['both', 'koren']);
ok('only choices are written, nothing else', writes.every(w => w.uid === 'u1' && w.keys.every(k => k.startsWith('chitas_lang_') || k.startsWith('chitas_') && !k.startsWith('chitas_v'))), true);
ok('text size and light/dark are not sent', 'chitas_reader_font_step' in cloud.prefs || 'chitas_theme' in cloud.prefs, false);

const phone = await device({ seed: { chitas_lang_tehillim: 'en', chitas_theme: 'dark' } });
await loadAccount(phone);
ok('the phone uses the laptop\'s choices', [await get(phone, 'chitas_lang_tehillim'), await get(phone, 'chitas_tehillim_translation')], ['both', 'koren']);
ok('…and keeps its own light/dark', await get(phone, 'chitas_theme'), 'dark');

console.log('The newer choice wins:');
await phone.clock.runFor(120000);
await phone.evaluate(() => { localStorage.setItem('chitas_lang_tehillim', 'he'); localStorage.setItem('hayomYomLang', 'en'); });
await tap(phone);
ok('a choice on the phone goes up', cloud.prefs.chitas_lang_tehillim?.v, 'he');
ok('a Hayom Yom choice too', cloud.prefs.hayomYomLang?.v, 'en');
await loadAccount(laptop);
ok('the laptop takes the newer one', [await get(laptop, 'chitas_lang_tehillim'), await get(laptop, 'hayomYomLang')], ['he', 'en']);
const before = writes.length;
await loadAccount(laptop); await laptop.clock.runFor(3000);
ok('nothing new: nothing is written', writes.length, before);

console.log('A choice made here since, while away, beats an older one in the account:');
await laptop.clock.runFor(300000);
await laptop.evaluate(() => localStorage.setItem('chitas_lang_chumash', 'en'));
cloud.prefs.chitas_lang_chumash = { v: 'he', t: 5 };   // old, from long ago
await loadAccount(laptop);
await laptop.clock.runFor(2500); await laptop.waitForTimeout(100);
ok('this device\'s newer choice stays, and goes up', [await get(laptop, 'chitas_lang_chumash'), cloud.prefs.chitas_lang_chumash.v], ['en', 'en']);

console.log('A new device takes the account\'s choices over its defaults:');
const tablet = await device({ seed: { chitas_lang_tehillim: 'en' } });
await loadAccount(tablet);
ok('its old setting gives way to the account', await get(tablet, 'chitas_lang_tehillim'), 'he');

console.log('The reader that\'s open is drawn again, quietly, on the same words:');
await tablet.evaluate(() => { localStorage.setItem('hayomYomLang', 'he'); window._hayomYomLang = null; });
await tablet.evaluate(() => openExtraReader('hayomYom'));
await tablet.waitForFunction(() => document.querySelector('#native-reader-content .hy-he'), null, { timeout: 8000 }).catch(() => {});
await tablet.evaluate(() => document.querySelector('#native-reader-content .hy-he').dataset.mark = 'first');
const shown = p => p.evaluate(() => [_rv.sid, !!document.querySelector('#native-reader-content .hy-he'), !!document.querySelector('#native-reader-content .hy-en'), document.querySelector('#native-reader-content [data-mark]')?.dataset.mark || 'drawn again']);
ok('Hayom Yom open on the tablet, in Hebrew', await shown(tablet), ['extra_hayomYom', true, false, 'first']);
cloud.prefs.chitas_lang_rambam = { v: 'en', t: Date.parse(now()) + 1e6 };   // another reader's choice
await loadAccount(tablet); await tablet.waitForTimeout(600);
ok('another reader\'s choice leaves it alone', await shown(tablet), ['extra_hayomYom', true, false, 'first']);
cloud.prefs.hayomYomLang = { v: 'both', t: Date.parse(now()) + 2e6 };       // its own, from the laptop
await loadAccount(tablet); await tablet.waitForTimeout(1500);
ok('its own choice: drawn again at once, in Both, still open', await shown(tablet), ['extra_hayomYom', true, true, 'drawn again']);
ok('…with no message', await tablet.evaluate(() => [...document.querySelectorAll('.toast, #toast')].filter(e => e.offsetParent && e.textContent.trim()).length), 0);

console.log('Signed out:');
const guest = await device({ signedIn: false });
const n = writes.length;
await guest.evaluate(() => localStorage.setItem('chitas_lang_rambam', 'en'));
await tap(guest);
ok('nothing is sent', writes.length, n);

for (const p of [laptop, phone, tablet, guest]) ok('no errors', p.__errors, []);
await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll prefs-sync tests passed');
process.exit(failed ? 1 : 0);
