/**
 * Tests for js/learning-stats.js — the Progress tab numbers.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { Intl, Date };
vm.createContext(ctx);
for (const f of ['holidays-data', 'progress', 'tehillim', 'chumash-data', 'chumash', 'learning-stats'])
  vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8'), ctx);
const learningStats = vm.runInContext('learningStats', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const day = s => new Date(s + 'T12:00:00');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function range(from, to) { const out = []; for (let d = day(from); d <= day(to); d.setDate(d.getDate() + 1)) out.push(iso(d)); return out; }
function userWith(map) { // map: { 'YYYY-MM-DD': ['chumash', ...] }
  const pastDone = {};
  for (const [d, ids] of Object.entries(map)) pastDone[d] = Object.fromEntries(ids.map(id => [id, true]));
  return { done: {}, pastDone };
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
check('1–30 Tishrei all said = all 150 chapters', learningStats(userWith(Object.fromEntries(tishrei.map(d => [d, ['tehillim']]))), TODAY, '3').tehillimChapters, 150);
check('days 1 and 2 (1–9, 10–17) = 17 chapters', learningStats(userWith({ '2026-09-12': ['tehillim'], '2026-09-13': ['tehillim'] }), TODAY, '3').tehillimChapters, 17);

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

console.log(failed ? `\n${failed} FAILED` : '\nAll learning-stats tests passed');
process.exit(failed ? 1 : 0);
