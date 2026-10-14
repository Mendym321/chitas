/**
 * Browser smoke test: opens the real index.html in headless Chromium (with the
 * internet blocked, so results don't depend on Sefaria/Hebcal being up) and
 * checks that key functions work and don't crash.
 *
 * Run:  cd tools && npm run test:app
 * First time on a new computer:  npx playwright install chromium
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };

// Tiny static file server for the repo folder
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  try {
    const body = await readFile(join(ROOT, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

// Use the pre-installed Chromium in cloud sessions, Playwright's own elsewhere
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.route(u => !u.href.startsWith(url), r => r.abort()); // block the internet
await page.goto(url, { waitUntil: 'load' });

let failed = 0;
async function check(name, fn, expected) {
  let actual;
  try { actual = await page.evaluate(fn); } catch (e) { actual = 'THREW: ' + e.message.split('\n')[0]; }
  if (actual === expected) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}

console.log('App smoke tests:');

await check('_refreshUI() updates the screen without crashing', () => {
  user.xp = 123; _refreshUI();
  return document.getElementById('stat-xp-inline').textContent;
}, '123');

await check('when the schedule can\'t load, the error message shows', async () => {
  await init(); // internet is blocked, so this takes the error path
  return document.getElementById('api-error').style.display;
}, 'flex');

await check('sign out finishes and shows a message', async () => {
  await signOut();
  return document.getElementById('toast').textContent;
}, 'Signed out 👋');

await check('Rebbe toggle in Personal Tehillim turns him off', () => {
  user.tehillimFixedOpts = { rebbe: true, rebbetzin: true };
  _openTehillimPeopleManager();
  document.getElementById('tpm-toggle-rebbe').click();
  return user.tehillimFixedOpts.rebbe;
}, false);

await check('Likkutei Sichos card shows this week\'s parsha', async () => {
  dayOffset = 0;
  const el = Object.assign(document.createElement('p'), { id: 'extra-sub-likkuteiSichos' });
  document.body.appendChild(el);
  await _loadExtraSubtitle('likkuteiSichos');
  return el.textContent.startsWith('Sichos · ');
}, true);

await check('Mark Done in the reader saves the section and closes the reader', () => {
  const sec = (id, color) => ({ id, label: id, icon: 'book', color, xp: 25, subtitle: '', chabadUrl: '' });
  schedule = { chumash: sec('chumash', '#F0A500'), tehillim: sec('tehillim', '#4A9EFF'),
               tanya: sec('tanya', '#A855F7'), rambam: sec('rambam', '#1DB954') };
  user.done = {}; dayOffset = 0;
  document.getElementById('chabad-panel').style.display = 'flex';
  showConfirm('tehillim', true); // what the reader's Mark Done button calls
  return user.done.tehillim === true && document.getElementById('chabad-panel').style.display;
}, 'none');

const unexpected = pageErrors.filter(m => !/Failed to fetch|NetworkError|firebase|import/i.test(m));
if (unexpected.length) { failed++; console.log('  ✗ uncaught page errors:\n      ' + unexpected.join('\n      ')); }
else console.log('  ✓ no uncaught JavaScript errors');

await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll app tests passed');
process.exit(failed ? 1 : 0);
