/**
 * Browser test: marks made late at night, on New York time, are still there
 * in the morning; on reload, with the app left open overnight, from the
 * reader and from a Review, and when another device saved meanwhile. The
 * learning day starts at 4 am: until then it's still the day before.
 * The clock is faked (Monday 26 Oct 2026, late at night), the internet blocked.
 *
 * Run:  cd tools && npm run test:midnight
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
const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true };
const SUN = '2026-10-25', MON = '2026-10-26', TUE = '2026-10-27';

// A page on New York time at a given moment, with this user saved on the phone
async function open(at, saved, { cloud, zone = 'America/New_York' } = {}) {
  const context = await browser.newContext({ timezoneId: zone, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message.split('\n')[0]));
  await page.clock.install({ time: new Date(at) });
  await page.route(u => !u.href.startsWith(url), r => {
    const u = r.request().url(), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com/converter')) return r.fulfill({ json: { hd: 15, hm: 'Cheshvan', hy: 5787 }, headers: H });
    if (u.includes('hebcal.com/hebcal')) return r.fulfill({ headers: H, json: { items: [
      { category: 'parashat', title: 'Parashat Vayera', leyning: { 1: 'Genesis 18:1-18:14', 2: 'Genesis 18:15-18:33', 3: 'Genesis 19:1-19:20', 4: 'Genesis 19:21-21:4', 5: 'Genesis 21:5-21:21', 6: 'Genesis 21:22-21:34', 7: 'Genesis 22:1-22:24' } },
      { category: 'dailyLearning', title: 'Psalms 79-82' }, { category: 'dailyLearning', title: 'Rambam: Sales 13-15' },
      { category: 'dailyLearning', title: 'Rambam (1 Chapter): Forbidden Intercourse 8' }] } });
    return r.abort();
  });
  await page.addInitScript(([u, c]) => {
    try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('chitas_v78', JSON.stringify(u)); sessionStorage.setItem('seeded', '1'); } } catch {}   // (a blocked text's frame has no storage)
    if (c) {   // signed in, with a cloud copy another device saved
      window.__cloud = c;
      // The account as Firestore keeps it: saves merge field by field, and every
      // device watching is told at once. __otherDevice marks as another device would.
      const deep = (a, b) => { const o = { ...(a || {}) }; for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object') ? deep(o[k], b[k]) : b[k]; return o; };
      const put = d => { window.__cloud = deep(window.__cloud, d); (window.__watchers || []).forEach(f => f(window.__cloud)); };
      window.__otherDevice = (iso, id, v = true) => put({ days: { [iso]: { [id]: v } } });
      setTimeout(() => { window._fb = { ...(window._fb || {}), loadUser: async () => window.__cloud, saveUser: async (uid, d) => { window.__saved = d; put(d); }, getIdToken: async () => 't', getCurrentUser: () => ({ uid: u.uid }),
        setMark: async (uid, iso, id, v) => put({ days: { [iso]: { [id]: v } } }), setReview: async (uid, iso, id, lv, v) => put({ reviews: { [iso]: { [id]: { [lv]: v } } } }),
        addRecords: async (uid, days, reviews) => put({ days, reviews }),
        watchUser: (uid, f) => { (window.__watchers = window.__watchers || []).push(f); setTimeout(() => f(window.__cloud), 0); return () => { window.__watchers = window.__watchers.filter(x => x !== f); }; } }; }, 0);
    }
  }, [saved, cloud || null]);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.chumash, null, { timeout: 8000 }).catch(() => {});
  return page;
}
const state = page => page.evaluate(() => ({ done: user.done, past: user.pastDone, quiz: user.quizDone, pastQuiz: user.pastQuizDone }));
const base = { uid: '', name: 'M', rambamTrack: '3', started: true };

console.log('Marked last night, opened this morning:');
{
  const page = await open(`${TUE}T08:00:00-04:00`, { ...base, lastDate: MON, done: { ...ALL }, quizDone: { tanya: { quick: { r: 4, n: 4 } } }, pastDone: { [SUN]: { ...ALL } } });
  const s = await state(page);
  ok('Monday has all four (before: filed under Sunday, then lost)', s.past[MON], ALL);
  ok('Monday\'s Review is kept with it', s.pastQuiz[MON], { tanya: { quick: { r: 4, n: 4 } } });
  ok('Sunday is untouched, and Tuesday starts empty', [s.past[SUN], s.done], [ALL, {}]);
  ok('the streak counts Monday', await page.evaluate(() => user.streak >= 2), true);
  ok('no errors', page.__errors, []);
  await page.context().close();
}

console.log('Up late: until 4 am it is still the day before:');
{
  const page = await open(`${TUE}T01:30:00-04:00`, { ...base, lastDate: MON, done: { chumash: true }, pastDone: {} });
  ok('at 1:30 am Today shows Monday, with Monday\'s marks', [await page.evaluate(() => _viewedISO()), (await state(page)).done], [MON, { chumash: true }]);
  await page.evaluate(() => markDone('tehillim'));
  ok('a mark at 1:30 am counts for Monday', (await state(page)).done, { chumash: true, tehillim: true });
  ok('no errors', page.__errors, []);
  await page.context().close();
}

console.log('Other time zones: the phone\'s own clock:');
{
  const page = await open(`${TUE}T01:30:00+02:00`, { ...base, lastDate: MON, done: { tanya: true }, pastDone: {} }, { zone: 'Asia/Jerusalem' });
  ok('in Jerusalem at 1:30 am it is still Monday', [await page.evaluate(() => _viewedISO()), (await state(page)).done], [MON, { tanya: true }]);
  await page.context().close();
  const morning = await open(`${TUE}T08:00:00+02:00`, { ...base, lastDate: MON, done: { tanya: true }, pastDone: {} }, { zone: 'Asia/Jerusalem' });
  ok('and at 8 am Monday\'s Tanya is Monday\'s', [(await state(morning)).past[MON], await morning.evaluate(() => _viewedISO())], [{ tanya: true }, TUE]);
  await morning.context().close();
}

console.log('The app left open overnight:');
{
  const page = await open(`${MON}T23:50:00-04:00`, { ...base, lastDate: MON, done: { chumash: true }, pastDone: {} });
  await page.evaluate(() => markDone('tehillim'));
  await page.clock.runFor(15 * 60e3);              // 12:05 am
  ok('at 12:05 am it is still Monday', [(await state(page)).done, await page.evaluate(() => _appDay)], [{ chumash: true, tehillim: true }, MON]);
  await page.clock.fastForward(4 * 3600e3);         // 4:05 am (jumps ahead, like a phone waking up)
  await page.clock.runFor(61e3);                   // and the minute check
  const s = await state(page);
  ok('at 4:05 am Monday\'s marks are Monday\'s', s.past[MON], { chumash: true, tehillim: true });
  ok('and Today is Tuesday, with nothing marked', [s.done, await page.evaluate(() => _viewedISO()), await page.evaluate(() => _appDay)], [{}, TUE, TUE]);
  await page.evaluate(() => markDone('chumash'));
  ok('a mark now counts for Tuesday only', (await state(page)).done, { chumash: true });
  ok('no errors', page.__errors, []);
  await page.context().close();
}

console.log('The reader opened before 4 am, marked after:');
{
  const page = await open(`${TUE}T03:55:00-04:00`, { ...base, lastDate: MON, done: {}, pastDone: {} });
  await page.evaluate(() => openChabadPanel('tanya'));
  await page.clock.runFor(10 * 60e3);              // 4:05 am, reader still open
  await page.evaluate(() => showConfirm('tanya', true));
  const s = await state(page);
  ok('the night\'s Tanya is marked for Monday, the day it was read', [s.past[MON]?.tanya, s.done.tanya], [true, undefined]);
  await page.evaluate(() => _closeReaderNow());
  ok('closing the reader: Today moves on to Tuesday', await page.evaluate(() => [dayOffset, _appDay, _viewedISO()]), [0, TUE, TUE]);
  ok('no errors', page.__errors, []);
  await page.context().close();
}

console.log('A Review started before 4 am, finished after:');
{
  const page = await open(`${TUE}T03:55:00-04:00`, { ...base, uid: 'u1', lastDate: MON, done: { tanya: true }, pastDone: {} }, { cloud: { ...base, uid: 'u1', lastDate: MON, done: { tanya: true }, pastDone: {} } });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    openQuiz('tanya');
    quizState = { ...quizState, level: 'quick', score: 3, current: 3, answered: true,
      questions: Array.from({ length: 4 }, (_, i) => ({ q: 'Q' + i, options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'x', quote: '' })),
      answers: [0, 1, 2, 3].map(i => ({ q: 'Q' + i, options: ['a', 'b', 'c', 'd'], answer: 0, right: i < 3, quote: '' })) };
  });
  await page.clock.runFor(10 * 60e3);              // 4:05 am
  await page.evaluate(() => { try { showQuizResults(); } catch (e) { window.__qerr = e.message + ' @ ' + (e.stack || '').split('\n')[1]; } });
  const s = await state(page);
  ok('the result is Monday\'s', s.pastQuiz[MON], { tanya: { quick: { r: 3, n: 4 } } });
  ok('and Tuesday has no Review yet', s.quiz, {});
  ok('no errors', [page.__errors, await page.evaluate(() => window.__qerr || null)], [[], null]);
  await page.context().close();
}

const k = o => o && Object.fromEntries(Object.entries(o).sort());   // marks, in any order

console.log('Marked on the laptop at night, the phone left open:');
{
  const phone = { ...base, uid: 'u1', lastDate: MON, done: { chumash: true }, pastDone: { [SUN]: { ...ALL } } };
  const page = await open(`${MON}T21:00:00-04:00`, phone, { cloud: phone });
  await page.waitForTimeout(500);
  // Meanwhile the laptop marks Tehillim, Tanya and Rambam
  await page.evaluate(([mon]) => ['tehillim', 'tanya', 'rambam'].forEach(id => window.__otherDevice(mon, id)), [MON]);
  await page.waitForTimeout(100);
  ok('the phone shows them at once, while still open', k((await state(page)).done), k(ALL));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(11 * 3600e3);        // the phone sleeps until 8 am
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  const s = await state(page);
  ok('in the morning the phone has Monday from both devices', k(s.past[MON]), k(ALL));
  ok('and Tuesday starts empty', s.done, {});
  ok('no errors', page.__errors, []);
  await page.context().close();
}

console.log('The laptop left open (and on screen) all night, marked on the phone at 1:30 am:');
{
  const laptop = { ...base, uid: 'u1', lastDate: MON, done: { tehillim: true }, pastDone: { [SUN]: { ...ALL } } };
  const page = await open(`${MON}T21:00:00-04:00`, laptop, { cloud: laptop });
  await page.waitForTimeout(500);
  await page.clock.runFor(4.5 * 3600e3);            // 1:30 am: the laptop still on screen
  // The phone marks the other three
  await page.evaluate(([mon]) => ['chumash', 'tanya', 'rambam'].forEach(id => window.__otherDevice(mon, id)), [MON]);
  await page.clock.runFor(2.6 * 3600e3);            // past 4 am: the laptop moves on to Tuesday by itself
  await page.waitForTimeout(300);
  const s = await state(page);
  ok('the laptop has Monday whole (the old bug: only Tehillim)', k(s.past[MON]), k(ALL));
  ok('and Tuesday starts empty', s.done, {});
  ok('the account has Monday whole too, and nothing was saved at 4 am', [k(await page.evaluate(([mon]) => daysFrom(window.__cloud)[mon], [MON])), await page.evaluate(([tue]) => daysFrom(window.__cloud)[tue] ?? null, [TUE])], [k(ALL), null]);
  // Tuesday on the laptop: only that one mark goes up
  await page.evaluate(() => { markDone('tehillim'); });
  await page.waitForTimeout(100);
  ok('a mark sends just that mark, under its date', await page.evaluate(([tue]) => window.__cloud.days?.[tue], [TUE]), { tehillim: true });
  ok('a full save carries no marks at all (so it can\'t undo another device\'s)', await page.evaluate(() => { saveUser(); return ['done', 'pastDone', 'days', 'lastDate'].filter(f => f in (window.__saved || {})); }), []);
  ok('no errors', page.__errors, []);
  await page.context().close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll midnight tests passed');
process.exit(failed ? 1 : 0);
