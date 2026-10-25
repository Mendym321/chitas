/**
 * The admin page's numbers (api/_lib/admin-stats.js): right counts, and
 * nothing personal in what it returns.
 * Run:  cd tools && npm test
 */
import { summarize } from '../api/_lib/admin-stats.js';
let failed = 0;
const check = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
};
const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true };
const TODAY = '2026-10-23';
const users = [
  // learned all four today and yesterday; a 12-day streak; did a quick review today (3 of 4)
  { name: 'Mendy Cohen', email: 'mendy@example.com', city: 'Crown Heights', uid: 'u-secret-1', tehillimPeople: [{ label: 'Savta Rivka' }],
    lastDate: TODAY, done: ALL, pastDone: { '2026-10-22': ALL }, streak: 12, rambamTrack: '3',
    quizDone: { chumash: { quick: { r: 3, n: 4 } } }, extraTracks: ['hayomYom', 'dafYomi', 'kitzur'] },
  // learned Tehillim 5 days ago; streak long gone (stored 40, but not alive)
  { name: 'Someone Else', lastDate: '2026-10-18', done: { tehillim: true }, pastDone: {}, streak: 40, rambamTrack: 'm',
    pastQuizDone: { '2026-10-10': { tanya: { deep: { r: 6, n: 6 } } } }, extraTracks: ['dafYomi'] },
  // signed up, never learned
  { name: 'New Person', lastDate: null, done: {}, pastDone: {}, rambamTrack: '1' },
];
const s = summarize(users, { today: TODAY, signups: ['2026-10-20T10:00:00Z', '2026-10-21T10:00:00Z', '2026-09-01T10:00:00Z'],
  ai: { quizzesSaved: 7, quizDates: ['2026-10-23', '2026-10-23', '2026-10-01'], quizRequestsToday: 5, quizPeopleToday: 2, tanyaGuides: 30, tanyaFailed: 1 } });

console.log('Admin page numbers:');
check('accounts and sign-ins', [s.accounts.total, s.accounts.signIns], [3, 3]);
check('active today / last 7 / last 30 days', s.active, { today: 1, last7: 2, last30: 2 });
check('today: 1 learned, 1 full Chitas day', s.daily.at(-1), { date: TODAY, learned: 1, chitas: 1 });
check('Tehillim learned 3 times in 30 days (2 days by one, 1 by another)', s.sections30.tehillim, 3);
check('a streak only counts while it\'s alive', s.streaks, { 'None now': 2, '1–6 days': 0, '7–29 days': 1, '30+ days': 0 });
check('reviews in 30 days, and how many answers were right', s.reviews, { last30: 2, quick: 1, deep: 1, rightPct: 90 });
check('Rambam tracks', s.rambamTracks, { '3 chapters': 1, '1 chapter': 1, 'Sefer HaMitzvos': 1 });
check('More learning (Hayom Yom isn\'t one of them)', s.moreLearning, { dafYomi: 2, kitzur: 1 });
check('sign-ups this week (from Sunday Oct 18)', s.accounts.signedUpByWeek.at(-1), { week: '2026-10-18', n: 2 });
check('quizzes made today', s.ai.quizzesByDay.at(-1).n, 2);

const out = JSON.stringify(s);
check('nothing personal comes out: no names, emails, cities, ids or Tehillim names',
  ['Mendy', 'mendy@', 'Crown', 'u-secret', 'Savta', 'Someone', 'New Person'].filter(w => out.includes(w)), []);

console.log(failed ? `\n${failed} FAILED` : '\nAll admin-stats tests passed');
process.exit(failed ? 1 : 0);
