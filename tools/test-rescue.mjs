/**
 * Browser test: the "The app didn't start" rescue screen. It must show only
 * when the app really didn't start while you were looking: not because the
 * tab sat in the background (where loading is paused), and it goes away by
 * itself if the app appears after all. The clock is fast-forwarded.
 *
 * Run:  cd tools && npm run test:rescue
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
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

// A page whose tab starts in the background (hidden), and whose app can be held off screen
async function page({ hidden }) {
  const p = await browser.newPage();
  await p.clock.install({ time: new Date('2026-11-06T09:00:00') });
  await p.route(u => !u.href.startsWith(url), r => r.abort());
  await p.addInitScript(h => {
    window.__h = h;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__h ? 'hidden' : 'visible') });
  }, hidden);
  await p.goto(url, { waitUntil: 'load' });
  // The app not on screen yet (as when its loading is paused): the check sees nothing
  await p.evaluate(() => { window.__realVisible = window.__appVisible; window.__appVisible = () => false; });
  return p;
}
const rescue = p => p.evaluate(() => document.getElementById('rescue').style.display === 'block');

console.log('Left in the background, then back:');
{
  const p = await page({ hidden: true });
  await p.clock.runFor(20 * 60 * 1000);   // twenty minutes away
  ok('twenty minutes in the background: no rescue screen', await rescue(p), false);
  await p.evaluate(() => { window.__h = false; });   // back on the tab
  await p.clock.runFor(4000);
  await p.evaluate(() => { window.__appVisible = () => true; });   // the app finishes loading a few seconds later
  await p.clock.runFor(20000);
  ok('back on the tab, the app appears in a few seconds: still no rescue screen', await rescue(p), false);
  await p.close();
}

console.log('A real failure while looking:');
{
  const p = await page({ hidden: false });
  await p.clock.runFor(14000);
  ok('14 seconds on screen: not yet', await rescue(p), false);
  await p.clock.runFor(2000);
  ok('15 seconds on screen without the app: the rescue screen', await rescue(p), true);
  await p.evaluate(() => { window.__appVisible = () => true; });   // a slow network wakes up: the app appears after all
  await p.clock.runFor(1500);
  ok('the app appears after all: the rescue screen goes away by itself', await rescue(p), false);
  await p.close();
}

console.log('The app starting normally:');
{
  const p = await page({ hidden: false });
  await p.evaluate(() => { window.__appVisible = () => true; });
  await p.clock.runFor(60000);
  ok('no rescue screen', await rescue(p), false);
  await p.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll rescue tests passed');
process.exit(failed ? 1 : 0);
