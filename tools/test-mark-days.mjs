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
console.log("Tehillim is read, not learned:");
{
  const p = await open(false);
  await p.evaluate(() => openChabadPanel('tehillim'));
  await p.waitForTimeout(1500);
  ok('today: Mark as read', await btn(p), ['todo', 'Mark as read', true]);
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

console.log("The reader's menu: days, the calendar, Today:");
{
  const p = await open(false);
  const menu = () => p.evaluate(() => { const m = document.getElementById('reader-menu'); return m && {
    when: m.querySelector('.rm-when h2').textContent, today: [...m.querySelectorAll('.rm-tool')].some(b => b.textContent === 'Today'),
    rows: [...m.querySelectorAll('.rm-row')].slice(0, 4).map(r => r.querySelector('.rm-n').textContent + (r.classList.contains('done') ? ' ✓' : '')),
    reader: document.getElementById('rd-label').textContent }; });
  await p.evaluate(() => openReaderMenu()); await p.waitForTimeout(300);
  ok('today: the day, a calendar, no Today button', await menu(), { when: 'Today', today: false, rows: ['Chumash', 'Tehillim', 'Tanya', 'Rambam'], reader: 'Today' });
  await p.screenshot({ path: shot('menu-today') });
  await p.click('#reader-menu .rm-step[aria-label="The day before"]'); await p.waitForTimeout(900);
  ok('‹ : the reader goes to yesterday, and the menu stays open on it', await menu(), { when: 'Yesterday', today: true, rows: ['Chumash', 'Tehillim', 'Tanya', 'Rambam'], reader: 'Yesterday, Oct 29' });
  await p.click('#reader-menu .rm-step[aria-label="The day before"]'); await p.waitForTimeout(900);
  ok('learned stays in its place, quieter, with a check', (await menu()).rows, ['Chumash ✓', 'Tehillim', 'Tanya', 'Rambam']);
  ok('…and can still be opened', await p.evaluate(() => { const r = document.querySelector('#reader-menu .rm-row.done'); return !!r && !r.disabled && !!r.onclick; }), true);
  await p.screenshot({ path: shot('menu-past') });
  await p.evaluate(() => setTheme('dark', false)); await p.waitForTimeout(200);
  await p.screenshot({ path: shot('menu-past-dark') });
  await p.evaluate(() => setTheme('light', false));
  await p.click('#reader-menu .rm-tool:has-text("Today")'); await p.waitForTimeout(900);
  ok('Today: back to today, in the reader and the menu', await menu(), { when: 'Today', today: false, rows: ['Chumash', 'Tehillim', 'Tanya', 'Rambam'], reader: 'Today' });
  await p.click('#reader-menu .rm-tool:has-text("Calendar")'); await p.waitForTimeout(400);
  ok('Calendar: the month opens (and the menu closes)', await p.evaluate(() => [!!document.getElementById('day-picker'), !document.getElementById('reader-menu')]), [true, true]);
  await p.evaluate(() => { _pickOff = -2; _renderDayPicker(); });
  await p.click('#day-picker .dp-go'); await p.waitForTimeout(1200);
  ok('picking Wednesday opens Wednesday in the reader', await p.evaluate(() => [!document.getElementById('day-picker'), document.getElementById('rd-label').textContent, document.getElementById('chabad-panel').style.display]), [true, 'Wednesday, Oct 28', 'flex']);
  ok('…with its own words at the bottom', (await btn(p)).slice(0, 2), ['past', 'You learned this on Wednesday']);
  ok('no errors', p.__errors, []);
  await p.close();
}

console.log('The menu follows the finger from the left edge:');
{
  const p = await open(false);
  // A finger, step by step: down at x, moved through xs, up (ms between moves)
  const finger = (target, x0, xs, ms, lift = true) => p.evaluate(async ([sel, x0, xs, ms, lift]) => {
    const el = document.querySelector(sel), y = 400;
    const t = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const fire = (type, x) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t(x)], changedTouches: [t(x)] }));
    fire('touchstart', x0);
    for (const x of xs) { await new Promise(r => setTimeout(r, ms)); fire('touchmove', x); }
    if (lift) { await new Promise(r => setTimeout(r, ms)); fire('touchend', xs.at(-1)); }
  }, [target, x0, xs, ms, lift]);
  const where = () => p.evaluate(() => { const m = document.getElementById('reader-menu'); if (!m) return null;
    const r = m.querySelector('.rm-panel').getBoundingClientRect(); return { left: Math.round(r.left), w: Math.round(r.width), open: m.classList.contains('open'), shade: +getComputedStyle(m.querySelector('.rm-shade')).opacity }; });
  await finger('#native-reader', 8, [30, 60, 90, 120], 30, false);
  const mid = await where();
  ok('while the finger moves, the menu is out as far as the finger, and the page dims as much', [!!mid, mid && mid.left > -mid.w && mid.left < 0, mid && mid.shade > 0.2 && mid.shade < 0.6, mid && mid.open], [true, true, true, false]);
  await p.waitForTimeout(200);   // the finger rests, then lifts
  await p.evaluate(() => document.querySelector('#native-reader').dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [new Touch({ identifier: 1, target: document.querySelector('#native-reader'), clientX: 120, clientY: 400 })] })));
  await p.waitForTimeout(450);
  ok('let go slowly before 40%: it slides back in', await where(), null);
  await finger('#native-reader', 8, [20, 40, 70], 12);   // a quick flick, not far
  await p.waitForTimeout(450);
  ok('a flick opens it, however short', await where(), { left: 0, w: (await where())?.w, open: true, shade: 1 });
  await p.screenshot({ path: shot('menu-pulled') });
  await finger('#reader-menu .rm-panel', 250, [230, 200, 160, 110], 40);
  await p.waitForTimeout(450);
  ok('open, dragged back to the left: it shuts', await where(), null);
  await finger('#native-reader', 8, [40, 90, 140, 190, 240], 40);   // a slow pull, past 40%
  await p.waitForTimeout(450);
  ok('a slow pull past 40% opens it', (await where())?.open, true);
  await p.evaluate(() => closeReaderMenu()); await p.waitForTimeout(300);
  await finger('#native-reader', 150, [180, 220, 260], 20);   // not from the edge
  await p.waitForTimeout(300);
  ok('from the middle of the page it isn\'t the menu', await where(), null);
  await p.click('#reader-menu-btn'); await p.waitForTimeout(350);
  ok('opened by a tap: no focus ring jumps to the ✕', await p.evaluate(() => document.activeElement?.classList.contains('rm-x')), false);
  await p.evaluate(() => closeReaderMenu()); await p.waitForTimeout(300);
  await p.keyboard.press('Shift'); await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
  await p.evaluate(() => openReaderMenu()); await p.waitForTimeout(350);
  ok('opened from the keyboard: focus goes to the ✕, for keyboards and screen readers', await p.evaluate(() => document.activeElement?.classList.contains('rm-x')), true);
  await p.evaluate(() => closeReaderMenu()); await p.waitForTimeout(300);
  ok('no errors', p.__errors, []);
  await p.close();
}

console.log('A phone on its side: slim bars that slide away while you read:');
{
  const p = await open(false);
  await p.setViewportSize({ width: 844, height: 390 });
  await p.evaluate(() => { _closeReaderNow(); openChabadPanel('chumash'); }); await p.waitForTimeout(1500);
  const st = () => p.evaluate(() => ({ away: document.getElementById('chabad-panel').classList.contains('bars-away'),
    head: document.getElementById('reader-head').offsetHeight, daybar: getComputedStyle(document.getElementById('reader-daybar')).display }));
  const scroll = async ys => { for (const y of ys) { await p.evaluate(y => { const r = document.getElementById('native-reader'); r.scrollTop = y; r.dispatchEvent(new Event('scroll')); }, y); await p.waitForTimeout(40); } await p.waitForTimeout(350); };
  const s0 = await st();
  ok('sideways: one slim bar, and no day bar', [s0.head <= 60, s0.daybar, s0.away], [true, 'none', false]);
  await scroll([100, 160, 220, 280]);
  ok('reading on: the bars slide away', (await st()).away, true);
  await scroll([260, 230, 200]);
  ok('scrolling back up a little: they come back', (await st()).away, false);
  await scroll([260, 320, 380]);
  await p.evaluate(() => { const r = document.getElementById('native-reader'); r.scrollTop = r.scrollHeight; r.dispatchEvent(new Event('scroll')); }); await p.waitForTimeout(350);
  ok('at the end: back, for Mark as learned', (await st()).away, false);
  // Pixel for pixel: a little scroll moves them a little, then they settle to the nearer side
  await scroll([400, 450, 500, 550, 600]);   // reading on: away
  await p.evaluate(() => { const r = document.getElementById('native-reader'); r.scrollTop = 580; r.dispatchEvent(new Event('scroll')); });
  const part = await p.evaluate(() => [_barOff, _barH]);
  ok('scrolled back 20px: the bar comes 20px back, following the finger', part[0] === part[1] - 20, true);
  await p.waitForTimeout(450);
  ok('…and then settles out of the way (nearer side)', (await st()).away, true);
  ok('the text never jumps: the bars float over it', await p.evaluate(() => getComputedStyle(document.getElementById('reader-head')).position), 'absolute');
  await p.evaluate(() => openReaderSettings()); await p.waitForTimeout(400);
  ok('the settings box scrolls inside itself when it\'s taller than the screen', await p.evaluate(() => { const b = document.getElementById('reader-settings-popover'), r = b.getBoundingClientRect();
    return [getComputedStyle(b).overflowY, r.bottom <= innerHeight + 1]; }), ['auto', true]);
  await p.evaluate(() => closeReaderSettings()); await p.waitForTimeout(300);
  await scroll([300, 360, 420, 480]);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(350);
  ok('turned upright: the bars are back as they always are', [(await st()).away, (await st()).daybar !== 'none'], [false, true]);
  ok('no errors', p.__errors, []);
  await p.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll mark-day tests passed');
process.exit(failed ? 1 : 0);
