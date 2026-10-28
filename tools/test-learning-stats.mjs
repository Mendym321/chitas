/**
 * Tests for js/learning-stats.js — the Progress tab numbers.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { Intl, Date };
vm.createContext(ctx);
for (const f of ['holidays-data', 'progress', 'tehillim', 'chumash-data', 'chumash', 'learning-data', 'learning-stats'])
  vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8'), ctx);
const learningStats = vm.runInContext('learningStats', ctx);
const getParshaForDate = vm.runInContext('getParshaForDate', ctx);
const { learningOverview, chumashVerseCount, rambamHalachosOn, learningMilestone, RAMBAM_BOOK_SPANS } = vm.runInContext('({ learningOverview, chumashVerseCount, rambamHalachosOn, learningMilestone, RAMBAM_BOOK_SPANS })', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const day = s => new Date(s + 'T12:00:00');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function range(from, to) { const out = []; for (let d = day(from); d <= day(to); d.setDate(d.getDate() + 1)) out.push(iso(d)); return out; }
function userWith(map, todayISO = '2026-10-14') { // map: { 'YYYY-MM-DD': ['chumash', ...] } — today's marks go in "done", like the app
  const pastDone = {}; let done = {};
  for (const [d, ids] of Object.entries(map)) {
    const marks = Object.fromEntries(ids.map(id => [id, true]));
    if (d === todayISO) done = marks; else pastDone[d] = marks;
  }
  return { done, pastDone };
}
const TODAY = day('2026-10-14'); // 3 Cheshvan 5787

console.log('Times through Tehillim:');
const tishrei = range('2026-09-12', '2026-10-11'); // 1–30 Tishrei 5787
check('every day of Tishrei → 1 full Tehillim',
  learningStats(userWith(Object.fromEntries(tishrei.map(d => [d, ['tehillim']]))), TODAY, '3').tehillimBooks, 1);
check('one day missing → 0',
  learningStats(userWith(Object.fromEntries(tishrei.filter(d => d !== '2026-09-30').map(d => [d, ['tehillim']]))), TODAY, '3').tehillimBooks, 0);
check('every weekday of Tishrei, Shabbos/Yom Tov unmarked → still 1',
  learningStats(userWith(Object.fromEntries(tishrei.filter(d => day(d).getDay() !== 6).map(d => [d, ['tehillim']]))), TODAY, '3').tehillimBooks, 1);
check('started on 4 Tishrei (missed 3 Tishrei) → that month does not count',
  learningStats(userWith(Object.fromEntries(tishrei.slice(3).map(d => [d, ['tehillim']]))), TODAY, '3').tehillimBooks, 0);
check('current month not over yet → not counted',
  learningStats(userWith(Object.fromEntries(range('2026-10-12', '2026-10-13').map(d => [d, ['tehillim']]))), TODAY, '3').tehillimBooks, 0);

console.log('Chapters of Tehillim:');
check('1–30 Tishrei all said = 150 chapters, and 63 more from Elul\'s (1–9 Tishrei and Yom Kippur)', learningStats(userWith(Object.fromEntries(tishrei.map(d => [d, ['tehillim']]))), TODAY, '3').tehillimChapters, 213);
check('days 1 and 2 (1–9, 10–17) = 17 chapters, with Elul\'s 88–93 = 23', learningStats(userWith({ '2026-09-12': ['tehillim'], '2026-09-13': ['tehillim'] }), TODAY, '3').tehillimChapters, 23);

console.log('Parshiyos completed:');
const bereishisWeek = range('2026-10-04', '2026-10-10'); // Sun–Shabbos, parshas Bereishis
check('all 7 aliyos of Bereishis → counted',
  learningStats(userWith(Object.fromEntries(bereishisWeek.map(d => [d, ['chumash']]))), TODAY, '3').parshiyos, ['Bereishit']);
check('Sun–Fri marked, Shabbos not (can\'t use the app) → counted',
  learningStats(userWith(Object.fromEntries(bereishisWeek.slice(0, 6).map(d => [d, ['chumash']]))), TODAY, '3').parshiyos, ['Bereishit']);
check('a weekday (Monday) missing → not counted',
  learningStats(userWith(Object.fromEntries(bereishisWeek.filter((d, i) => i !== 1).map(d => [d, ['chumash']]))), TODAY, '3').parshiyos, []);

console.log('Rambam & sections:');
const ten = range('2026-10-01', '2026-10-10');
check('10 days on the 3-chapter track = 30 chapters',
  learningStats(userWith(Object.fromEntries(ten.map(d => [d, ['rambam']]))), TODAY, '3').rambamChapters, 30);
check('10 days on the 1-chapter track = 10 chapters',
  learningStats(userWith(Object.fromEntries(ten.map(d => [d, ['rambam']]))), TODAY, '1').rambamChapters, 10);
const mostly = userWith(Object.fromEntries(ten.map((d, i) => [d, i < 3 ? ['chumash', 'tehillim', 'tanya', 'rambam'] : ['chumash', 'tehillim', 'tanya']])));
const s = learningStats(mostly, TODAY, '3');
check('days per section in the last 30 days', [s.sections.chumash.last30, s.sections.rambam.last30], [10, 3]);
check('the section you miss most is flagged', s.needsAttention, 'rambam');
check('no flag when sections are even',
  learningStats(userWith(Object.fromEntries(ten.map(d => [d, ['chumash', 'tehillim', 'tanya', 'rambam']]))), TODAY, '3').needsAttention, null);

console.log('Your learning (totals):');
check('pesukim in one chapter (Genesis 2:4-2:19 = 16)', chumashVerseCount('Genesis 2:4-2:19'), 16);
check('pesukim across chapters (Genesis 1:1-2:3 = 31 + 3)', chumashVerseCount('Genesis 1:1-2:3'), 34);
check('Simchas Torah: two books joined by |', chumashVerseCount('Deuteronomy 33:1-34:12|Genesis 1:1-2:3'), 29 + 12 + 34);
check('Rambam halachos on Oct 14 2026 (Robbery 13–15) = 51', rambamHalachosOn(day('2026-10-14'), '3'), 51);
check('…on the 1-chapter track (Virgin Maiden 2) = 17', rambamHalachosOn(day('2026-10-14'), '1'), 17);
check('Sefer HaMitzvos track has no halacha count', rambamHalachosOn(day('2026-10-14'), 'm'), 0);
const bWeek = learningOverview(userWith(Object.fromEntries(bereishisWeek.map(d => [d, ['chumash']]))), TODAY, '3');
check('a full week of Bereishis = the whole parsha in pesukim (Simchas Torah day counts its Bereishis part too)', [bWeek.totals.parshiyos, bWeek.totals.pesukim > 140], [1, true]);

console.log('Consistency:');
const twoWeeks = range('2026-09-30', '2026-10-14');
const c = learningOverview(userWith(Object.fromEntries(twoWeeks.map(d => [d, ['chumash', 'tehillim', 'tanya', 'rambam']]))), TODAY, '3').consistency;
check('every day for 15 days → streak and best both 15', [c.streak, c.best], [15, 15]);
check('per-section run counts too', c.per.tehillim.current, 15);
const long = range('2026-09-14', '2026-10-14').filter(d => d !== '2026-10-06');
const gap = learningOverview(userWith(Object.fromEntries(long.map(d => [d, ['tehillim']]))), TODAY, '3').consistency.per.tehillim;
check('a missed weekday breaks the run; the longer run before it is remembered', [gap.current, gap.best], [8, 22]);

console.log('Highlights:');
const h = learningOverview(userWith(Object.fromEntries(twoWeeks.map(d => [d, ['chumash', 'tehillim', 'tanya', 'rambam']]))), TODAY, '3').highlights.map(x => x.title);
check('a run of a week or more is highlighted', h.some(t => /every day for 15 days/.test(t)), true);
check('the latest full parsha is highlighted', h.some(t => /^Learned all of Parshas /.test(t)), true);

console.log('Learning milestones (they follow the cycles):');
{
  const S = (map, today = TODAY, track = '3') => learningStats(userWith(map), today, track);
  const M = (id, before, after, d, today = TODAY, track = '3', map = {}) => learningMilestone(id, S(before, today, track), S(after, today, track), day(d), userWith(map), today, track);
  const six = Object.fromEntries(bereishisWeek.slice(0, 5).map(d => [d, ['chumash']]));      // Sun–Thu
  const all = { ...six, '2026-10-09': ['chumash'] };                                          // + Friday
  const m = M('chumash', six, all, '2026-10-09');
  check('the last aliyah of the week finishes the parsha', [m && m.title, m && m.key], ['Parshas Bereishit', 'parsha-2026-10-10']);
  check('an ordinary day is no milestone', M('chumash', {}, { '2026-10-04': ['chumash'] }, '2026-10-04'), null);
  const t29 = Object.fromEntries(tishrei.slice(0, 29).map(d => [d, ['tehillim']]));
  const t30 = Object.fromEntries(tishrei.map(d => [d, ['tehillim']]));
  check('the whole month of Tehillim → Sefer Tehillim', M('tehillim', t29, t30, '2026-10-11')?.title, 'All of Sefer Tehillim');

  // Chumash: the week of Vayechi finishes Sefer Bereishis (5787: Shabbos 26 Dec 2026)
  {
    let sat = day('2026-12-01'); while (getParshaForDate(sat) !== 'Vayechi' || sat.getDay() !== 6) sat.setDate(sat.getDate() + 1);
    const T = sat, fri = new Date(T); fri.setDate(T.getDate() - 1);
    const ch = range('2026-10-04', iso(T)).filter(d => d !== iso(T));      // Bereishis (4 Oct) through Friday of Vayechi
    const u = m => userWith(m, iso(fri));
    const cmap = days => Object.fromEntries(days.map(d => [d, ['chumash']]));
    const b = learningMilestone('chumash', learningStats(u(cmap(ch.slice(0, -1))), fri, '3'), learningStats(u(cmap(ch)), fri, '3'), fri, u(cmap(ch)), fri, '3');
    check('the last parsha of Bereishis finishes the book', [b?.title, b?.sub], ['Sefer Bereishis', 'Every parsha of it.']);
  }
  // Rambam, 3 chapters: Sefer Nezikin ran 28 Oct – 17 Nov 2025
  const NOV17 = day('2025-11-17');
  const nezikin = range('2025-10-28', '2025-11-17');
  const rmap = days => Object.fromEntries(days.map(d => [d, ['rambam']]));
  const R = days => { const before = rmap(days.filter(d => d !== '2025-11-17')), after = rmap(days), u = m => userWith(m, '2025-11-17');
    return learningMilestone('rambam', learningStats(u(before), NOV17, '3'), learningStats(u(after), NOV17, '3'), NOV17, u(after), NOV17, '3'); };
  check('the last day of a Rambam book, every day learned', [R(nezikin)?.title, R(nezikin)?.sub], ['Sefer Nezikin', 'You learned every day of it.']);
  const most = nezikin.filter((d, i) => i % 5 !== 1);
  check('most of it: says how many days', /^You learned \d+ of its 21 days\.$/.test(R(most)?.sub || ''), true);
  check('under half of it: no milestone', R(nezikin.filter((d, i) => i % 3 === 0 || d === '2025-11-17')), null);
  const mid = learningMilestone('rambam', S({}, NOV17), S({ '2025-11-10': ['rambam'] }, NOV17), day('2025-11-10'), userWith({ '2025-11-10': ['rambam'] }), NOV17, '3');
  check('a day in the middle of a book: no milestone', mid, null);
  // Sefer Shoftim, the last book: the Siyum (the next cycle starts 3 Feb 2026)
  const FEB2 = day('2026-02-02');
  const shoftimSpan = RAMBAM_BOOK_SPANS.three.find(([s, e, b]) => b === 14 && e === Math.round((Date.UTC(2026, 1, 2) - Date.UTC(2025, 0, 1)) / 86400000));
  const sh = range(new Date(Date.UTC(2025, 0, 1 + shoftimSpan[0])).toISOString().slice(0, 10), '2026-02-02');
  const u2 = m => userWith(m, '2026-02-02');
  const sm = learningMilestone('rambam', learningStats(u2(rmap(sh.slice(0, -1))), FEB2, '3'), learningStats(u2(rmap(sh)), FEB2, '3'), FEB2, u2(rmap(sh)), FEB2, '3');
  check('the end of Sefer Shoftim is the Siyum', sm?.title, 'Siyum HaRambam');
}

// ── Review: what stays with you ─────────────────────────────────────────────
{
  const reviewStats = vm.runInContext('reviewStats', ctx);
  const T = day('2026-10-21');   // a Wednesday
  check('no reviews yet: nothing to show', reviewStats({}, T), null);
  const u = {
    quizDone: { chumash: { quick: { r: 4, n: 4 } } },                                   // today
    pastQuizDone: {
      '2026-10-19': { tanya: { quick: { r: 2, n: 4 }, deep: { r: 5, n: 6 } } },          // this week
      '2026-10-12': { rambam: { quick: 3 } },                                            // last week, saved before { r, n }: out of 4
      '2026-09-14': { chumash: { quick: { r: 1, n: 4 } } },                              // 5 weeks back
      '2026-08-01': { chumash: { deep: { r: 6, n: 6 } } },                               // long ago: all-time only
    },
  };
  const r = reviewStats(u, T);
  check('six weeks, Sunday to Shabbos, ending this week', r.weeks.map(w => w.shabbos), ['2026-09-19', '2026-09-26', '2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24']);
  check('% right each week (none: null)', r.weeks.map(w => w.pct), [25, null, null, null, 75, 79]);
  check('now: the latest week; then: the earliest with reviews', [r.now, r.then], [79, 25]);
  check('by section, last 30 days (old numbers count out of 4)', r.bySection, { chumash: { pct: 100, n: 1 }, tanya: { pct: 70, n: 2 }, rambam: { pct: 75, n: 1 } });
  check('all time: answers right, deep dives, all right', [r.right, r.deepDives, r.perfect], [21, 2, 2]);
  check('a broken result is ignored', reviewStats({ quizDone: { tanya: { quick: { r: 2 } } } }, T), null);
}

console.log(failed ? `\n${failed} FAILED` : '\nAll learning-stats tests passed');
process.exit(failed ? 1 : 0);
