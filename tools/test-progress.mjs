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
const P = vm.runInContext('({ computeStreak, countChitasDays, isRestDay, milestoneReached, nextMilestone, welcomeBack })', ctx);

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

console.log('Two devices overnight, with the account merging every save (as Firestore does):');
{
  const S = vm.runInContext('({ syncFromCloud, archiveOldToday, filedForCloud, datedToday })', ctx);
  // Firestore setDoc(…, { merge: true }): maps merge, keys that aren't sent stay
  const deep = (a, b) => { const o = { ...(a || {}) }; for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object') ? deep(o[k], b[k]) : b[k]; return o; };
  const k = o => o && Object.fromEntries(Object.entries(o).sort());   // marks, in any order
  let cloud = {};
  const save = u => { cloud = deep(cloud, { lastDate: u.lastDate, done: u.done || {}, quizDone: u.quizDone || {}, ...S.filedForCloud(u) }); };
  const N8 = '2026-11-08', N9 = '2026-11-09';
  const laptop = { lastDate: N8, done: { tehillim: true }, pastDone: {} };             // open all evening
  save(laptop);
  const phone = S.syncFromCloud({}, cloud, day(N8));                                    // 1:30 am, still the 8th
  Object.assign(phone.done, { chumash: true, tanya: true, rambam: true }); phone.lastDate = N8; save(phone);
  Object.assign(laptop, S.archiveOldToday(laptop, N9)); save({ ...laptop, lastDate: N9 }); // 4 am: the laptop rolls over, never re-read
  const fresh = S.syncFromCloud({}, cloud, day(N9));
  check('a device reading the account in the morning sees the 8th complete (before: only Tehillim)', k(fresh.pastDone[N8]), k(ALL));
  check('and today empty (before: last night\'s marks showed as today\'s)', fresh.done, {});
  const back = S.syncFromCloud(phone, cloud, day(N9));
  check('the phone too: the 8th complete, today empty', [k(back.pastDone[N8]), back.done], [k(ALL), {}]);
  check('the laptop, taking in the account, gets the phone\'s marks for the 8th', k(S.syncFromCloud(laptop, cloud, day(N9)).pastDone[N8]), k(ALL));
  check('an old copy of the account (nothing filed for its last day) reads as before', S.datedToday({ lastDate: N8, done: { tanya: true }, pastDone: {} }).done, { tanya: true });
  check('an un-mark made on one device reaches the others', (() => {
    const p2 = S.syncFromCloud({}, cloud, day(N9)); p2.done = { tanya: true }; p2.lastDate = N9; save(p2);
    const p3 = S.syncFromCloud({}, cloud, day(N9)); p3.done.tanya = false; p3.lastDate = N9; save(p3);
    return S.syncFromCloud({}, cloud, day(N9)).done;
  })(), { tanya: false });
}

console.log(failed ? `\n${failed} FAILED` : '\nAll progress tests passed');
process.exit(failed ? 1 : 0);
