/**
 * Tests for js/progress.js — points, streak, Chitas days. Each test is a small
 * story ("learned 60 days in a row") with a known right answer.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
for (const f of ['../js/holidays-data.js', '../js/progress.js'])
  vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const P = vm.runInContext('({ POINTS, pointsForDay, computeStreak, countChitasDays, weekPoints, isRestDay, milestoneReached, nextMilestone, welcomeBack })', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const day = s => new Date(s + 'T12:00:00');
const iso = d => d.toISOString().slice(0, 10);
const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true };
const TODAY = day('2026-10-14'); // a Wednesday

// Build a user who did a Chitas day on each of the given dates
function userWith(dates, todayDone = {}) {
  const pastDone = {};
  for (const s of dates) pastDone[s] = { ...ALL };
  return { done: todayDone, pastDone };
}
function daysBack(n, from = TODAY) { // ISO dates for the n days before `from`
  return Array.from({ length: n }, (_, i) => { const d = new Date(from); d.setDate(d.getDate() - i - 1); return iso(d); });
}

console.log('Points:');
check('a full Chitas day = 50', P.pointsForDay(ALL), 50);
check('3 of 4 sections = 30', P.pointsForDay({ chumash: true, tehillim: true, tanya: true }), 30);
check('extra learning = 5 each', P.pointsForDay({ ...ALL, dafYomi: true, hayomYom: true }), 60);
check('unmarked sections count nothing', P.pointsForDay({ chumash: false }), 0);

console.log('Streak:');
check('60 days in a row (old bug capped this at 9)',
  P.computeStreak(userWith(daysBack(59), ALL), TODAY), { current: 60, atRisk: false });
check('today not done yet → streak kept, "at risk"',
  P.computeStreak(userWith(daysBack(5)), TODAY), { current: 5, atRisk: true });
check('a missed weekday breaks it',
  P.computeStreak(userWith(['2026-10-13', '2026-10-11']), TODAY), { current: 1, atRisk: true });
check('unmarked Shabbos (Oct 10) is skipped, not a break',
  P.computeStreak(userWith(['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-09']), TODAY), { current: 4, atRisk: true });
check('marked Shabbos counts',
  P.computeStreak(userWith(['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09']), TODAY), { current: 5, atRisk: true });
check('unmarked Yom Kippur (Mon Sep 21) is skipped',
  P.computeStreak(userWith(['2026-09-20'], ALL), day('2026-09-22')), { current: 2, atRisk: false });
check('brand-new user → 0', P.computeStreak({ done: {}, pastDone: {} }, TODAY), { current: 0, atRisk: false });
check('Shabbos is never "at risk" (no nagging on Shabbos)',
  P.computeStreak(userWith(['2026-10-09']), day('2026-10-10')).atRisk, false);

console.log('Totals:');
check('Chitas days counted from history + today',
  P.countChitasDays({ done: ALL, pastDone: { '2026-10-01': ALL, '2026-10-02': { chumash: true } } }, TODAY), 2);
check('points this week (Sun Oct 11 → Wed Oct 14)',
  P.weekPoints({ done: { chumash: true }, pastDone: { '2026-10-11': ALL, '2026-10-10': ALL } }, TODAY), 60);

console.log('Milestones:');
check('crossing 17 → 18 is a milestone (חי)', P.milestoneReached(17, 18), 18);
check('6 → 6 is not', P.milestoneReached(6, 6), null);
check('next milestone after 20 is 30', P.nextMilestone(20), 30);
check('Yom Kippur 2026 is a rest day', P.isRestDay(day('2026-09-21')), true);

console.log('Welcome back:');
check('a new user: nothing to come back to', P.welcomeBack({ done: {}, pastDone: {} }, TODAY), null);
check('learned yesterday: no break', P.welcomeBack({ done: {}, pastDone: { '2026-10-13': ALL } }, TODAY), null);
check('missed yesterday after learning before → welcome back, catch up yesterday',
  P.welcomeBack({ done: {}, pastDone: { '2026-10-12': ALL } }, TODAY), { missedOff: -1 });
check('already started today: no card', P.welcomeBack({ done: { chumash: true }, pastDone: { '2026-10-12': ALL } }, TODAY), null);
check('away for weeks: welcome back; yesterday can still be caught up',
  P.welcomeBack({ done: {}, pastDone: { '2026-09-01': ALL } }, TODAY), { missedOff: -1 });
check('yesterday half-done still counts as missed', P.welcomeBack({ done: {}, pastDone: { '2026-10-12': ALL, '2026-10-13': { chumash: true } } }, TODAY), { missedOff: -1 });

console.log(failed ? `\n${failed} FAILED` : '\nAll progress tests passed');
process.exit(failed ? 1 : 0);
