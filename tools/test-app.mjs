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
async function check(name, fn, expected, arg) {
  let actual;
  try { actual = await page.evaluate(fn, arg); } catch (e) { actual = 'THREW: ' + e.message.split('\n')[0]; }
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
}, 'Signed out');

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

await check('Mark Done in the reader saves it and offers the next section of the day', () => {
  const sec = (id, color) => ({ id, label: id[0].toUpperCase() + id.slice(1), icon: 'book', color, xp: 25, subtitle: '', chabadUrl: '' });
  schedule = { chumash: sec('chumash', '#F0A500'), tehillim: sec('tehillim', '#4A9EFF'),
               tanya: sec('tanya', '#A855F7'), rambam: sec('rambam', '#1DB954') };
  user.done = {}; user.pastDone = {}; dayOffset = 0;
  document.getElementById('chabad-panel').style.display = 'flex';
  showConfirm('tehillim', true); // what the reader's Mark Done button calls
  return [user.done.tehillim === true, document.getElementById('chabad-panel').style.display,
          document.querySelector('#reader-next .rn-go')?.textContent];
}, [true, 'flex', 'Next: Tanya']);

await check('ticking a section: its tick pops with a ring of its ink, after the list is drawn again', async () => {
  user.done = {}; user.pastDone = {}; dayOffset = 0;
  document.getElementById('chabad-panel').style.display = 'none';
  showConfirm('chumash', false);                      // the tick on Today
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  const tick = document.getElementById('tick-chumash');
  return [tick.style.animation.includes('checkPop'), !!tick.querySelector('.tick-ring'),
          document.getElementById('today-seg-0').classList.contains('on'), document.getElementById('toast').textContent];
}, [true, true, true, 'Nice! Chumash done.']);

await check('the line under the greeting says what kind of day it is', () => {
  switchTab('learn'); dayOffset = 0; setGreeting();
  const today = document.getElementById('day-note').textContent;
  const heb = document.getElementById('heb-chip').textContent;
  switchTab('stats'); const title = document.getElementById('greeting').textContent;
  switchTab('learn');
  return [today.length > 0, today === dayNote(new Date(), getParshaForDate(new Date())).map(t => t.replace(/^Parshas /, '')).join(' · '), /\d+ \w+/.test(heb), title];
}, [true, true, true, 'Progress']);

await check('finishing a week of Chumash celebrates the parsha, once', () => {
  const iso = d => dateISO(d);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const fri = new Date(today); fri.setDate(today.getDate() - today.getDay() - 2);   // last week's Friday
  user.done = {}; user.pastDone = {}; user.milestones = []; dayOffset = 0;
  for (let back = 5; back >= 1; back--) { const d = new Date(fri); d.setDate(fri.getDate() - back); user.pastDone[iso(d)] = { chumash: true }; }
  const seen = []; const real = window.celebrateLearning; window.celebrateLearning = m => seen.push(m.title);
  markDonePast('chumash', iso(fri));
  unmarkDonePast('chumash', iso(fri)); markDonePast('chumash', iso(fri));
  window.celebrateLearning = real;
  return [seen.length, /^Parshas /.test(seen[0] || '')];
}, [1, true]);

await check('catching up: after yesterday\'s Chumash, next is today\'s Chumash', () => {
  user.done = {}; user.pastDone = {}; dayOffset = -1;
  showConfirm('chumash', true);
  const r = document.querySelector('#reader-next .rn-go')?.textContent;
  dayOffset = 0;
  return r;
}, "Next: Today's Chumash");

await check('reader day bar: yesterday can go back or forward; from today you can read ahead', () => {
  dayOffset = -1; _updateReaderDayBar('chumash');
  const y = [document.getElementById('rd-label').textContent.startsWith('Yesterday'), document.getElementById('rd-next').disabled, document.getElementById('rd-next-label').textContent];
  dayOffset = 0; _updateReaderDayBar('chumash');
  return [...y, document.getElementById('rd-next').disabled, document.getElementById('rd-label').textContent];
}, [true, false, 'Today', false, 'Today']);

await check('finishing all 4 sections makes today a Chitas day; unmarking one takes it back', () => {
  user = { ...user, done: {}, pastDone: {}, streak: 0 };
  ['chumash', 'tehillim', 'tanya', 'rambam'].forEach(markDone);
  const streakFull = user.streak;
  unmarkDone('rambam');
  return [streakFull, user.streak, 'xp' in user && user.xp !== 0];
}, [1, 0, false]);

await check('catching up yesterday restores a 2-day streak', () => {
  const y = new Date(); y.setDate(y.getDate() - 1);
  user = { ...user, pastDone: {}, done: { chumash: true, tehillim: true, tanya: true, rambam: true } };
  dayOffset = -1;
  ['chumash', 'tehillim', 'tanya', 'rambam'].forEach(id => markDonePast(id, dateISO(y)));
  dayOffset = 0;
  return [user.streak, user.total];
}, [2, 2]);

await check('week strip shows 7 days', () => document.querySelectorAll('#week-strip button').length, 7);

await check('a malicious name is shown as text, not run (header + profile)', async () => {
  window.__hacked = false;
  user = { ...user, uid: 'u1', name: '<img src=x onerror="window.__hacked=true">', city: '<b onmouseover=x>NYC</b>' };
  updateHeader(); switchTab('profile');
  await new Promise(r => setTimeout(r, 100));
  closeProfileSheet();
  return [window.__hacked, document.querySelectorAll('#avatar-tab img, #profile-sheet img, #profile-sheet b[onmouseover]').length];
}, [false, 0]);

await check('Personal Tehillim builds its list without crashing (offline → no chapters yet)', async () => {
  user.tehillimFixedOpts = { rebbe: true, rebbetzin: false };
  user.tehillimPeople = [{ label: 'Savta', heDay: 5, heMonth: 'Nissan', heYear: 5700 }];
  const people = await _buildPersonalPsalms();
  return people.map(p => p.label);
}, ['Rebbe', 'Savta']);

await check('Your learning: totals (halachos of Rambam), consistency bars and a nudge for the section you miss', () => {
  const pastDone = {};
  for (let i = 1; i <= 10; i++) { const d = new Date(); d.setDate(d.getDate() - i); pastDone[dateISO(d)] = { chumash: true, tehillim: true, tanya: true, rambam: i <= 2 }; }
  user = { ...user, rambamTrack: '3', done: {}, pastDone };
  renderStats();
  const c = document.getElementById('stats-content').textContent;
  return [document.getElementById('learned-grid').textContent.includes('halachos of Rambam'),
          document.querySelectorAll('#stats-content .cbar').length, /Rambam (slips|is the one you miss most)/.test(c)];
}, [true, 4, true]);

await check('Rambam translator\'s notes become tappable numbers that open in place', () => {
  // The shape Sefaria sends: a marker <sup> followed by the note in <i class="footnote"> (which can nest <i>)
  const notes = [];
  const en = _cleanHtml('<b>One must</b> [rest]<sup class="footnote-marker">1</sup><i class="footnote">See <i>Shabbos</i> 2a.</i> on the seventh day.<sup class="footnote-marker">2</sup><i class="footnote">&lt;b&gt;<img src=x onerror="window.__hacked=true"></i>', notes);
  window._rambamData = { chapters: [{ ref: 'Mishneh Torah, Sabbath 1', title: 'Shabbos 1', chapter: 1, en: [en], he: ['שבת'], notes }] };
  localStorage.setItem('chitas_lang_rambam', 'en');
  (_rv.sid = 'rambam', _renderRambamContent());
  const btns = document.querySelectorAll('#native-reader-content .rambam-fn');
  btns[0].click();
  const popup = document.getElementById('rambam-note-popup');
  const first = [popup.style.display, popup.querySelector('.rn-text').textContent];
  btns[0].click(); // tap again → closes
  const closed = popup.style.display;
  return [btns.length, notes, first, closed, !!window.__hacked, document.getElementById('native-reader-content').textContent.includes('on the seventh day')];
}, [2, ['See Shabbos 2a.', '<b>'], ['block', 'See Shabbos 2a.'], 'none', false, true]);

// Keeping your place in the reader: see test-reader-place.mjs (npm run test:place)

await check('Tanya: guide labeled and shown as text; headings, opening word, hagahah, footnotes', () => {
  const N = '\uE000' + '0' + '\uE001';
  window._tanyaData = { chapterSlug: 'Tanya,_Part_I;_Likkutei_Amarim.41', chapterLabel: 'Likkutei Amarim · Chapter 41', chapterNum: 41, isFirstSegment: true,
    guide: { intro: 'About <img src=x onerror="window.__hacked=true">', recap: '', summary: 'Today the Alter Rebbe explains.' },
    notes: ['Jeremiah 23:24.'],
    blocks: [{ he: 'בְּרַם, צָרִיךְ', en: 'One must' + N, isHagahah: false, heading: 'The root' },
             { he: 'הגהה טקסט', en: 'A note', isHagahah: true }] };
  window.__hacked = false;
  localStorage.setItem('chitas_lang_tanya', 'both');
  localStorage.removeItem('chitas_tanya_guide'); localStorage.removeItem('chitas_tanya_nikud');
  (_rv.sid = 'tanya', _renderTanyaContent());
  const c = document.getElementById('native-reader-content');
  const on = [c.textContent.includes('AI-written'), c.textContent.includes('<img'), !!window.__hacked, c.querySelector('.tz-ch')?.textContent,
    c.querySelector('.tz-h')?.textContent, c.querySelector('.tz-open')?.textContent, !!c.querySelector('.tz-hag .tz-he'), c.querySelectorAll('.tanya-fn').length];
  c.querySelector('.tanya-fn').click();
  const note = document.getElementById('rambam-note-popup').querySelector('.rn-text')?.textContent;
  _toggleTanyaOpt('guide'); _toggleTanyaOpt('nikud');
  const off = [!!c.querySelector('.tz-guide'), !!c.querySelector('.tz-h'), c.querySelector('.tz-open')?.textContent];
  localStorage.removeItem('chitas_tanya_guide'); localStorage.removeItem('chitas_tanya_nikud');
  return [on, note, off];
}, [[true, true, false, 'פרק מא', 'The root', 'בְּרַם,', true, 1], 'Jeremiah 23:24.', [false, false, 'ברם,']]);

// Real Sefaria text (Touger translation) — see tools/fixtures/rambam-touger.json
const RAMBAM = JSON.parse(await readFile(new URL('./fixtures/rambam-touger.json', import.meta.url), 'utf8'));
await check('Rambam (real Sefaria text): sentences don\'t run together; transliterations stay italic', ({ robbery }) => {
  const en = _cleanHtml(robbery, []);
  return [en.includes('take it." Even if'), en.includes('<i>p\'rutah</i>'), en.includes('<br')];
}, [true, true, false], { robbery: RAMBAM.robbery_13_1 });

await check('Rambam (real Sefaria text): [bracketed] translator\'s words lighter, the Rambam\'s words bold, footnotes tappable', ({ sabbath }) => {
  const notes = [];
  const en = _cleanHtml(sabbath, notes);
  window._rambamData = { chapters: [{ title: 'Shabbos 1', chapter: 1, en: [en], he: ['ש'], notes }] };
  localStorage.setItem('chitas_lang_rambam', 'en');
  (_rv.sid = 'rambam', _renderRambamContent());
  const root = document.querySelector('#native-reader-content .rb-en');
  const add = root.querySelector('.rb-add'), bold = root.querySelector('b');
  return [add.textContent, +getComputedStyle(add).fontWeight < 600, +getComputedStyle(bold).fontWeight >= 700,
          root.textContent.includes('['), notes.length, notes[1].includes('Maggid Mishneh'),
          document.querySelectorAll('#native-reader-content .rambam-fn').length];
}, ['for performing such an act.', true, true, false, 2, true, 2], { sabbath: RAMBAM.sabbath_sample });

await check('Rambam (real Sefaria text, Ishus 1:2): added words lighter, footnotes tappable, transliterations italic', ({ ishus }) => {
  const notes = [];
  window._rambamData = { chapters: [{ title: 'Ishus 1', chapter: 1, en: [_cleanHtml(ishus, notes)], he: ['א'], notes }] };
  (_rv.sid = 'rambam', _renderRambamContent());
  const root = document.querySelector('#native-reader-content .rb-en');
  const adds = [...root.querySelectorAll('.rb-add')].map(e => e.textContent);
  return [adds.slice(0, 3), notes.length, document.querySelectorAll('#native-reader-content .rambam-fn').length,
          !!root.querySelector('b i, i'), root.textContent.includes('[')];
}, [['one of', 'the transfer of', 'the transfer of a'], 2, 2, true, false], { ishus: RAMBAM.marriage_1_2 });

await check('Rambam (real Sefaria text): a book with no brackets is shown in regular weight, not all bold', ({ robbery }) => {
  window._rambamData = { chapters: [{ title: 'Robbery 13', chapter: 13, en: [_cleanHtml(robbery, [])], he: ['א'], notes: [] }] };
  (_rv.sid = 'rambam', _renderRambamContent());
  const root = document.querySelector('#native-reader-content .rb-en');
  return [root.classList.contains('rb-plain'), +getComputedStyle(root).fontWeight < 600];
}, [true, true], { robbery: RAMBAM.robbery_13_1 });

await check('Tehillim "Both": each passuk in Hebrew with its English under it', () => {
  window._tehillimData = { chapters: [{ psalmNum: 18, startVerse: 1, he: ['לַמְנַצֵּחַ', 'וַיֹּאמַר'], en: ['For the leader', 'And he said'] }], psalmLabel: 'Psalms 18–22', dayNum: 3 };
  localStorage.setItem('chitas_lang_tehillim', 'both');
  (_rv.sid = 'tehillim', _renderTehillimContent());
  const pairs = [...document.querySelectorAll('#native-reader-content .th-pair')];
  return pairs.map(p => [p.querySelector('.th-v').textContent, p.querySelector('.th-en').textContent]);
}, [['א', 'For the leader'], ['ב', 'And he said']]);

await check('Tehillim looks like a printed Tehillim: chapter "יח.", day "יום ג", Hebrew verse letters', () => {
  window._tehillimData = { chapters: [{ psalmNum: 18, startVerse: 1, he: ['לַמְנַצֵּחַ', 'וַיֹּאמַר', 'יְהוָה'], en: [] }], psalmLabel: 'Psalms 18–22', dayNum: 3 };
  localStorage.setItem('chitas_lang_tehillim', 'he');
  (_rv.sid = 'tehillim', _renderTehillimContent());
  const c = document.getElementById('native-reader-content');
  return [c.querySelector('.th-ch-num').textContent, c.querySelector('.th-day').textContent,
          [...c.querySelectorAll('.th-v')].map(e => e.textContent), getComputedStyle(c.querySelector('.th-text')).textAlign];
}, ['יח.', 'יום ג', ['א', 'ב', 'ג'], 'justify']);

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
  user = { ...user, xp: 0, quizDone: {}, quizTotal: 0, quizCorrect: 0 };
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
  // Results: the score, every answer with its line, "Read it again" only on the missed one
  const ring = document.querySelector('.rv-ring b')?.textContent;
  const learned = [...document.querySelectorAll('.rv-item')].map(e => [e.querySelector('.rv-dot').classList.contains('ok'), e.querySelector('.rv-quote')?.textContent, !!e.querySelector('.rv-again')]);
  const first = [user.quizTotal, user.quizCorrect];
  await _startQuiz('quick'); [2, 0, 1, 3].forEach((a, i) => { selectAnswer(a); nextQuestion(); }); // a retry is for learning; not counted again
  return [levels, explained, ring, learned, first, [user.quizTotal, user.quizCorrect], user.quizDone.chumash, !!window.__hacked];
}, [2, true, '3/4', [[true, '“the line about c”', false], [false, '“q2”', true], [true, '“q3”', false], [true, '“q4”', false]], [4, 3], [4, 3], { quick: { r: 3, n: 4 } }, false]);

await check('Review on Today: a learned tile is ready to review, then says how it went', () => {
  closeQuiz(); dayOffset = 0;
  user.done = { chumash: true, tanya: true }; user.quizDone = { chumash: { quick: { r: 3, n: 4 } } };
  renderSectionsForOffset(dateISO(new Date()));
  const chip = id => document.querySelector('#card-' + id + ' .stile-rv')?.textContent || null;
  const ready = document.getElementById('review-ready');
  return [chip('chumash'), chip('tanya'), chip('tehillim'), chip('rambam'), ready.style.display, [...ready.querySelectorAll('.rr-t p:first-child')].map(p => p.textContent)];
}, ['Reviewed 3/4', 'Review · 4', null, null, 'block', ['Tanya is ready to review']]);

await check('Review right after you learn: marking it in the reader offers the review', () => {
  user.done = {}; user.quizDone = {}; dayOffset = 0;
  document.getElementById('chabad-panel').style.display = 'flex';
  showConfirm('rambam', true);
  const box = document.getElementById('reader-next');
  const r = [box.querySelector('.rv-fresh h3')?.textContent, [...box.querySelectorAll('.rn-row button')].map(b => b.textContent)];
  closeChabadPanel();
  return r;
}, ['4 questions on what you just learned', ['Deep dive · 6', 'Home']]);

await check('quiz request sends today\'s exact Chumash ref and the sign-in token',
  () => getChumashAliyaRef(new Date()).split('|'), quizRequest && quizRequest.body.refs);
console.log(quizRequest.auth === 'Bearer tok123' && quizRequest.body.section === 'chumash' && quizRequest.body.level === 'quick'
  ? '  ✓ …with section, level and token' : (failed++, '  ✗ quiz request was ' + JSON.stringify(quizRequest)));

// ── Light and dark: Automatic follows the phone ───────────────────────────
console.log('Appearance:');
const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
const pressed = () => page.evaluate(() => [...document.querySelectorAll('.th-seg')].map(g => g.querySelector('[aria-pressed=true]')?.dataset.th));
await page.evaluate(() => setThemePref('auto'));
await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(100);
let th = [await isDark(), await pressed()];
await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(100);
th.push(await isDark());
if (JSON.stringify(th) !== JSON.stringify([true, ['auto', 'auto'], false])) { failed++; console.log('  ✗ Automatic: got', th); }
else console.log('  ✓ Automatic follows the phone, also when it changes while the app is open');
await check('Light stays light when the phone goes dark, and is kept; both controls (Profile, reader) show it', async () => {
  setThemePref('light');
  return [localStorage.getItem('chitas_theme'), document.documentElement.classList.contains('light')];
}, ['light', true]);
await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(100);
th = [await isDark(), await pressed()];
await page.evaluate(() => setThemePref('auto'));
th.push(await isDark(), await page.evaluate(() => localStorage.getItem('chitas_theme')));
if (JSON.stringify(th) !== JSON.stringify([false, ['light', 'light'], true, null])) { failed++; console.log('  ✗ Light / back to Automatic: got', th); }
else console.log('  ✓ …and Automatic again forgets the choice and follows the phone');
await page.emulateMedia({ colorScheme: 'light' });

// ── A brand-new visitor, in a fresh page ───────────────────────────────────
console.log('New visitor (signed out):');
const page2 = await browser.newPage();
page2.on('pageerror', e => pageErrors.push(e.message));
await page2.route(u => !u.href.startsWith(url), r => r.abort());
await page2.goto(url, { waitUntil: 'load' });
async function check2(name, fn, expected) {
  let actual;
  try { actual = await page2.evaluate(fn); } catch (e) { actual = 'THREW: ' + e.message.split('\n')[0]; }
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}

await check2('first visit shows ONE welcome screen (no forced sign-in)', () => {
  const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
  return [vis('onboarding'), vis('ob-welcome'), vis('main-app'), document.querySelectorAll('#onboarding button').length];
}, [true, true, false, 2]);

await check2('"Start learning" opens the app right away, Rambam defaults to 3 chapters', async () => {
  obStartGuest();
  await new Promise(r => setTimeout(r, 300));
  const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  return [vis('main-app'), vis('onboarding'), user.uid, user.started, user.rambamTrack, user.rambamTrackAsked];
}, [true, false, '', true, '3', false]);

await check2('first time opening Rambam asks which track you learn', () => {
  schedule = schedule || {};
  schedule.rambam = schedule.rambam || { id: 'rambam', label: 'Rambam', color: '#1DB954', subtitle: '', chabadUrl: '' };
  openChabadPanel('rambam');
  const m = document.getElementById('rambam-track-modal');
  const r = [!!m, !!m && m.textContent.includes('Which Rambam do you learn?')];
  m?.remove();
  return r;
}, [true, true]);

await check2('quiz while signed out → asks to sign in (not an error)', () => {
  schedule.chumash = schedule.chumash || { id: 'chumash', label: 'Chumash', color: '#F0A500', subtitle: '' };
  openQuiz('chumash');
  const r = [getComputedStyle(document.getElementById('signin-sheet')).display, document.getElementById('signin-title').textContent];
  closeSignIn();
  return r;
}, ['flex', 'Sign in to take quizzes']);

await check2('after the first section, offers (once) to save progress', async () => {
  schedule.tehillim = schedule.tehillim || { id: 'tehillim', label: 'Tehillim', color: '#4A9EFF', subtitle: '' };
  markDone('tehillim');
  await new Promise(r => setTimeout(r, 2100));
  const r = [!!user.done.tehillim, document.getElementById('signin-title').textContent, user.signinPrompted];
  closeSignIn();
  return r;
}, [true, 'Keep your streak safe', true]);

await check2('profile says progress is only on this phone, no "Sign out"', () => {
  switchTab('profile');
  const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  const r = [vis('ps-guest-row'), vis('ps-signout-row')];
  closeProfileSheet();
  return r;
}, [true, false]);

await check2('signing in keeps what was done signed out and adds the account\'s history', async () => {
  const y = new Date(); y.setDate(y.getDate() - 3);
  const iso = dateISO(y);
  window._fb = { ...(window._fb || {}),
    loadUser: async () => ({ name: 'Mendy', rambamTrack: '1', xp: 200, lastDate: iso, done: {}, pastDone: { [iso]: { chumash: true } } }),
    saveUser: async () => {}, getIdToken: async () => 't', fetchLeaderboard: async () => [] };
  await new Promise(r => setTimeout(r, 120)); // bootApp registers its sign-in handler once _fb exists
  openSignIn('streak');
  await window._fb._onAuthReady({ uid: 'acc1', displayName: 'Mendy C', photoURL: '' });
  return [user.uid, user.name, user.rambamTrack, user.rambamTrackAsked, !!user.done.tehillim, !!user.pastDone[iso]?.chumash,
    getComputedStyle(document.getElementById('signin-sheet')).display];
}, ['acc1', 'Mendy', '1', true, true, true, 'none']);

// ── Firebase blocked (ad blocker / offline): the app must still start ─────
await check2('Delete everything (no account): the phone is cleared and the welcome screen shows', async () => {
  localStorage.setItem('chitas_test_key', '1');
  openDeleteAccount();
  const asked = document.querySelector('#del-sheet .del-t')?.textContent;
  await deleteAccount();
  const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  return [asked, localStorage.getItem('chitas_test_key'), localStorage.getItem('chitas_v78'), vis('onboarding'), vis('main-app')];
}, ['Delete everything on this phone?', null, null, true, false]);

console.log('Firebase blocked:');
const page3 = await browser.newPage();
await page3.route(u => !u.href.startsWith(url), r => r.abort());
await page3.addInitScript(() => localStorage.setItem('chitas_v78', JSON.stringify({ uid: 'u1', name: 'M', rambamTrack: '3', done: {}, pastDone: {} })));
await page3.goto(url, { waitUntil: 'load' });
await page3.waitForTimeout(4500);
const started = await page3.evaluate(() => getComputedStyle(document.getElementById('main-app')).display !== 'none' && (schedule !== null || document.body.innerText.includes('Schedule unavailable')));
if (started) console.log('  ✓ a signed-in user\'s app still opens when Firebase can\'t load');
else { failed++; console.log('  ✗ app stuck on Loading when Firebase can\'t load'); }

// Signed in, but the cloud copy of progress never answers (e.g. a blocker on the database)
const page4 = await browser.newPage();
await page4.route(u => !u.href.startsWith(url), r => r.abort());
await page4.addInitScript(() => {
  localStorage.setItem('chitas_v78', JSON.stringify({ uid: 'u1', name: 'M', rambamTrack: '3', done: {}, pastDone: {} }));
  setTimeout(() => { window._fb = { loadUser: () => new Promise(() => {}), saveUser: async () => {}, loadDailyCache: async () => null, getIdToken: async () => null, getCurrentUser: () => ({ uid: 'u1' }), _authReady: true, _authUser: { uid: 'u1' } }; }, 300);
});
await page4.goto(url, { waitUntil: 'load' });
await page4.waitForTimeout(6000);
const shown = await page4.evaluate(() => getComputedStyle(document.getElementById('main-app')).opacity === '1' && getComputedStyle(document.getElementById('rescue')).display === 'none');
if (shown) console.log('  ✓ app shows (not a blank screen) when the cloud never answers');
else { failed++; console.log('  ✗ blank screen when the cloud never answers'); }

const unexpected = pageErrors.filter(m => !/Failed to fetch|NetworkError|firebase|import/i.test(m));
if (unexpected.length) { failed++; console.log('  ✗ uncaught page errors:\n      ' + unexpected.join('\n      ')); }
else console.log('  ✓ no uncaught JavaScript errors');

await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll app tests passed');
process.exit(failed ? 1 : 0);
