/**
 * Browser test: the service worker (sw.js). After one visit the app must open
 * with no internet: the page, its scripts, data and every font of our own are
 * kept (Vilna and OT Siddur too), a font is kept the first time it's used, and
 * the store of fetched texts doesn't grow for ever.
 *
 * Run:  cd tools && npm run test:offline
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  // Stand-ins for our api/ (always answers, so its replies get kept)
  if (path.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(await readFile(join(ROOT, path === '/' ? 'index.html' : path))); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });

let failed = 0;
const ok = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
};

const ctx = await browser.newContext();
await ctx.route(u => !u.href.startsWith(url), r => r.abort());   // no outside internet at all
const page = await ctx.newPage();
await page.goto(url);
await page.evaluate(() => navigator.serviceWorker.ready);
// Wait for the install to finish keeping the shell
await page.waitForFunction(async () => {
  const names = await caches.keys();
  const shell = names.find(n => n.startsWith('chitas-shell-'));
  return shell && (await (await caches.open(shell)).keys()).length > 30;
}, null, { timeout: 30000 });

console.log('Kept on the first visit');
const kept = await page.evaluate(async () => {
  const shell = (await caches.keys()).find(n => n.startsWith('chitas-shell-'));
  return (await (await caches.open(shell)).keys()).map(r => decodeURIComponent(new URL(r.url).pathname));
});
for (const f of ['/', '/fonts/OT Vilna Basic-VF.ttf', '/fonts/OT Siddur - Classic.ttf', '/fonts/Heilig.otf', '/fonts/Shlomo.ttf', '/js/progress.js', '/data/hayom-yom.json'])
  ok(f, kept.includes(f), true);

console.log('A font is kept the first time it is used');
const fontKept = await page.evaluate(async () => {
  const shell = (await caches.keys()).find(n => n.startsWith('chitas-shell-'));
  const c = await caches.open(shell);
  await c.delete('/icons/icon-32.png');
  await fetch('/icons/icon-32.png');                 // through the service worker, not in the cache
  for (let i = 0; i < 40 && !(await c.match('/icons/icon-32.png')); i++) await new Promise(r => setTimeout(r, 50));
  return !!(await c.match('/icons/icon-32.png'));
});
ok('fetched once → kept', fontKept, true);

console.log('The store of fetched texts stays small');
const dataCount = await page.evaluate(async () => {
  for (let i = 0; i < 430; i++) await fetch('/api/test-' + i);
  await new Promise(r => setTimeout(r, 500));
  await fetch('/api/test-last');                     // one more, after the others are kept
  await new Promise(r => setTimeout(r, 1500));
  const data = (await caches.keys()).find(n => n.startsWith('chitas-data-'));
  const keys = (await (await caches.open(data)).keys()).map(r => new URL(r.url).pathname);
  return { n: keys.length, newest: keys.includes('/api/test-last'), oldest: keys.includes('/api/test-0') };
});
ok('at most 400 kept', dataCount.n <= 400, true);
ok('the newest kept, the oldest dropped', [dataCount.newest, dataCount.oldest], [true, false]);

console.log('Opens with no internet');
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(1500);
ok('the page loads from what was kept', await page.evaluate(() => !!document.getElementById('main-app')), true);
ok('its scripts too (the app ran)', await page.evaluate(() => typeof window.switchTab), 'function');

await browser.close();
server.close();
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nAll offline tests passed');
