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
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name); // compares contents, so lists work too
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}

console.log('App smoke tests:');

await check('_refreshUI() updates the screen without crashing', () => {
  user.streak = 12; _refreshUI();
  return document.getElementById('streak-pill-num').textContent;
}, '12');

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

await check('points: finishing all 4 sections = 50, unmarking one takes back 20', () => {
  user = { ...user, xp: 0, done: {}, pastDone: {}, streak: 0 };
  ['chumash', 'tehillim', 'tanya', 'rambam'].forEach(markDone);
  const full = user.xp, streakFull = user.streak;
  unmarkDone('rambam');
  return [full, streakFull, user.xp, user.streak];
}, [50, 1, 30, 0]);

await check('catching up yesterday restores a 2-day streak', () => {
  const y = new Date(); y.setDate(y.getDate() - 1);
  user = { ...user, xp: 0, pastDone: {}, done: { chumash: true, tehillim: true, tanya: true, rambam: true } };
  dayOffset = -1;
  ['chumash', 'tehillim', 'tanya', 'rambam'].forEach(id => markDonePast(id, dateISO(y)));
  dayOffset = 0;
  return [user.streak, user.total, user.xp];
}, [2, 2, 50]);

await check('week strip shows 7 days', () => document.querySelectorAll('#week-strip button').length, 7);

await check('a malicious name/city on the leaderboard is shown as text, not run', async () => {
  window.__hacked = false;
  user = { ...user, uid: 'u1', name: '<img src=x onerror="window.__hacked=true">', city: '<b onmouseover=x>NYC</b>' };
  await renderLeaders();
  await new Promise(r => setTimeout(r, 100));
  const html = document.getElementById('leaders-list').innerHTML;
  return [window.__hacked, html.includes('&lt;img'), document.querySelectorAll('#leaders-list img, #leaders-list b[onmouseover]').length];
}, [false, true, 0]);

await check('Personal Tehillim builds its list without crashing (offline → no chapters yet)', async () => {
  user.tehillimFixedOpts = { rebbe: true, rebbetzin: false };
  user.tehillimPeople = [{ label: 'Savta', heDay: 5, heMonth: 'Nissan', heYear: 5700 }];
  const people = await _buildPersonalPsalms();
  return people.map(p => p.label);
}, ['Rebbe', 'Savta']);

await check('Progress tab shows learning stats (Rambam out of 1,000, last-30-days bars)', () => {
  const pastDone = {};
  for (let i = 1; i <= 10; i++) { const d = new Date(); d.setDate(d.getDate() - i); pastDone[dateISO(d)] = { chumash: true, tehillim: true, tanya: true, rambam: i <= 2 }; }
  user = { ...user, rambamTrack: '3', done: {}, pastDone };
  renderStats();
  const grid = document.getElementById('learned-grid').textContent;
  return [grid.includes('of 1,000 chapters'), !!document.getElementById('needs-attention')?.textContent.includes('Rambam')];
}, [true, true]);

await check('Rambam translator\'s notes become tappable numbers that open in place', () => {
  // The shape Sefaria sends: a marker <sup> followed by the note in <i class="footnote"> (which can nest <i>)
  const notes = [];
  const en = _cleanHtml('<b>One must</b> [rest]<sup class="footnote-marker">1</sup><i class="footnote">See <i>Shabbos</i> 2a.</i> on the seventh day.<sup class="footnote-marker">2</sup><i class="footnote">&lt;b&gt;<img src=x onerror="window.__hacked=true"></i>', notes);
  window._rambamData = { chapters: [{ ref: 'Mishneh Torah, Sabbath 1', title: 'Shabbos 1', chapter: 1, en: [en], he: ['שבת'], notes }] };
  localStorage.setItem('chitas_lang_rambam', 'en');
  _renderRambamContent();
  const btns = document.querySelectorAll('#native-reader-content .rambam-fn');
  btns[0].click();
  const popup = document.getElementById('rambam-note-popup');
  const first = [popup.style.display, popup.querySelector('.rn-text').textContent];
  btns[0].click(); // tap again → closes
  const closed = popup.style.display;
  return [btns.length, notes, first, closed, !!window.__hacked, document.getElementById('native-reader-content').textContent.includes('on the seventh day')];
}, [2, ['See Shabbos 2a.', '<b>'], ['block', 'See Shabbos 2a.'], 'none', false, true]);

// Pretend /api/quiz: remembers what the app sent, answers with 4 questions
let quizRequest = null;
await page.route('**/api/quiz', route => {
  quizRequest = { body: route.request().postDataJSON(), auth: route.request().headers().authorization };
  route.fulfill({ json: { level: 'quick', questions: [
    { q: 'Q1 <img src=x onerror="window.__hacked=true">', options: ['a', 'b', 'c', 'd'], answer: 2, explanation: 'Because of c.', quote: 'the line about c' },
    { q: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'E2', quote: 'q2' },
    { q: 'Q3', options: ['a', 'b', 'c', 'd'], answer: 1, explanation: 'E3', quote: 'q3' },
    { q: 'Q4', options: ['a', 'b', 'c', 'd'], answer: 3, explanation: 'E4', quote: 'q4' },
  ] } });
});

await check('quiz: pick a level, answer 4, see explanations and a review of misses', async () => {
  window.__hacked = false;
  window._fb = { saveUser: async () => {}, ...(window._fb || {}), getIdToken: async () => 'tok123' };
  user = { ...user, xp: 0, quizDone: {} };
  dayOffset = 0;
  openQuiz('chumash');
  const levels = document.querySelectorAll('#quiz-body .quiz-level').length;
  await _startQuiz('quick');
  selectAnswer(2);                                    // right
  const explained = document.getElementById('quiz-feedback').textContent.includes('Because of c.');
  nextQuestion(); selectAnswer(1);                    // wrong (answer is 0)
  nextQuestion(); selectAnswer(1);                    // right
  nextQuestion(); selectAnswer(3);                    // right
  nextQuestion();
  const missed = [...document.querySelectorAll('.quiz-missed')].map(e => e.textContent.includes('Q2'));
  const xp1 = user.xp;
  await _startQuiz('quick'); [2, 0, 1, 3].forEach((a, i) => { selectAnswer(a); nextQuestion(); }); // retry: no extra points
  return [levels, explained, missed, xp1, user.xp, user.quizDone.chumash, !!window.__hacked];
}, [2, true, [true], 15, 15, { quick: 3 }, false]);

await check('quiz request sends today\'s exact Chumash ref and the sign-in token',
  () => getChumashAliyaRef(new Date()).split('|'), quizRequest && quizRequest.body.refs);
console.log(quizRequest.auth === 'Bearer tok123' && quizRequest.body.section === 'chumash' && quizRequest.body.level === 'quick'
  ? '  ✓ …with section, level and token' : (failed++, '  ✗ quiz request was ' + JSON.stringify(quizRequest)));

const unexpected = pageErrors.filter(m => !/Failed to fetch|NetworkError|firebase|import/i.test(m));
if (unexpected.length) { failed++; console.log('  ✗ uncaught page errors:\n      ' + unexpected.join('\n      ')); }
else console.log('  ✓ no uncaught JavaScript errors');

await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll app tests passed');
process.exit(failed ? 1 : 0);
