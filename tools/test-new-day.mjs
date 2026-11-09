/**
 * Tests for marks by date (js/progress.js: daysFrom, dayView, marksToSend):
 * a new day, the 4 am rule, older saved formats, and several devices sharing
 * one account. They run on New York time, where a past bug lived: the
 * night's marks were filed under the wrong day, or dropped, the next morning.
 * Run:  cd tools && npm test
 */
process.env.TZ = 'America/New_York';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
for (const f of ['../js/holidays-data.js', '../js/progress.js'])
  vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const P = vm.runInContext('({ daysFrom, reviewsFrom, dayView, marksToSend, reviewsToSend, progressISO, appNow })', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
}
const k = o => o && Object.fromEntries(Object.entries(o).sort());   // marks, in any order
const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true };
const MON = '2026-10-26', TUE = '2026-10-27', SUN = '2026-10-25';

console.log('A new day is just the next date:');
check('(the old way: in New York, "2026-10-26" read as a date is the 25th)', P.progressISO(new Date(MON)), SUN);
const days = { [SUN]: { ...ALL }, [MON]: { ...ALL } }, reviews = { [MON]: { tanya: { quick: { r: 4, n: 4 } } } };
const tue = P.dayView(days, reviews, TUE);
check('Tuesday: Monday\'s marks are Monday\'s (not Sunday\'s, not lost)', tue.pastDone[MON], ALL);
check('and Monday\'s Review with them', tue.pastQuizDone[MON], { tanya: { quick: { r: 4, n: 4 } } });
check('today starts empty, and nothing had to move', [tue.done, tue.quizDone], [{}, {}]);
check('on Monday the same record shows Monday as today', P.dayView(days, reviews, MON).done, ALL);

console.log('The learning day starts at 4 am:');
check('1:30 am Tuesday is still Monday', P.progressISO(P.appNow(new Date('2026-10-27T01:30:00'))), MON);
check('3:59 am is still Monday', P.progressISO(P.appNow(new Date('2026-10-27T03:59:00'))), MON);
check('4:00 am is Tuesday', P.progressISO(P.appNow(new Date('2026-10-27T04:00:00'))), TUE);
check('11 pm is that day', P.progressISO(P.appNow(new Date('2026-10-27T23:00:00'))), TUE);
check('the night the clocks go back (1 Nov): 3:30 am is still Shabbos', P.progressISO(P.appNow(new Date('2026-11-01T03:30:00'))), '2026-10-31');

console.log('Older saved formats read into the record:');
check('"today" (done + lastDate) goes under its date', P.daysFrom({ lastDate: MON, done: { tanya: true }, pastDone: { [SUN]: ALL } }), { [SUN]: ALL, [MON]: { tanya: true } });
check('history and today\'s list together: every day kept', Object.keys(P.daysFrom({ lastDate: TUE, done: { tanya: true }, pastDone: { [SUN]: ALL, [MON]: { chumash: true } } })), [SUN, MON, TUE]);
check('very old saved dates ("Mon Oct 26 2026") still work', P.daysFrom({ lastDate: 'Mon Oct 26 2026', done: { tanya: true } })[MON], { tanya: true });
check('a stale loose list (the old 4 am bug) is ignored where its day is filed', [P.daysFrom({ lastDate: TUE, done: ALL, pastDone: { [MON]: ALL, [TUE]: {} } })[TUE] || {}, P.daysFrom({ lastDate: TUE, done: ALL, pastDone: { [MON]: ALL, [TUE]: {} } })[MON]], [{}, ALL]);
check('the new record wins over the old lists', P.daysFrom({ lastDate: MON, done: { tanya: true }, days: { [MON]: { tanya: false } } })[MON], { tanya: false });
check('Review results the same way', P.reviewsFrom({ lastDate: MON, quizDone: { tanya: { quick: 3 } }, reviews: { [MON]: { tanya: { deep: 5 } } } })[MON], { tanya: { quick: 3, deep: 5 } });

console.log('Several devices, one account (saves merge, one field per mark, as Firestore does):');
{
  const deep = (a, b) => { const o = { ...(a || {}) }; for (const x in b) o[x] = (b[x] && typeof b[x] === 'object' && o[x] && typeof o[x] === 'object') ? deep(o[x], b[x]) : b[x]; return o; };
  let account = {};
  const mark = (iso, id, v) => { account = deep(account, { days: { [iso]: { [id]: v } } }); };
  // Laptop, open all evening: Tehillim. Phone, 1:30 am (still Monday): the other three.
  mark(MON, 'tehillim', true);
  ['chumash', 'tanya', 'rambam'].forEach(id => mark(MON, id, true));
  // 4 am: nothing is saved at all; every device just looks at the next date
  const morning = P.dayView(P.daysFrom(account), {}, TUE);
  check('Tuesday morning, any device: Monday complete (the old bug: only Tehillim)', k(morning.pastDone[MON]), k(ALL));
  check('and Tuesday empty (the old bug: last night\'s marks showed as today\'s)', morning.done, {});
  // Two devices mark at once: neither overwrites the other
  mark(TUE, 'chumash', true); mark(TUE, 'tanya', true);
  check('two devices marking at once: both marks kept', P.daysFrom(account)[TUE], { chumash: true, tanya: true });
  mark(TUE, 'tanya', false);
  check('un-marked on one device: every device sees it', P.daysFrom(account)[TUE].tanya, false);
  // A device with marks the account doesn't have (made signed out): sent up once
  const local = { [SUN]: { ...ALL }, [TUE]: { tanya: true, rambam: true } };
  check('what a device has that the account doesn\'t: only those, to send', P.marksToSend(P.daysFrom(account), local), [[SUN, 'chumash', true], [SUN, 'tehillim', true], [SUN, 'tanya', true], [SUN, 'rambam', true], [TUE, 'rambam', true]]);
  check('a mark the account already has, either way, stays as the account says', P.marksToSend(P.daysFrom(account), local).some(([iso, id]) => iso === TUE && id === 'tanya'), false);
  check('Review results to send the same way', P.reviewsToSend({ [MON]: { tanya: { quick: 3 } } }, { [MON]: { tanya: { quick: 3, deep: 5 } } }), [[MON, 'tanya', 'deep', 5]]);
}

console.log(failed ? `\n${failed} FAILED` : '\nAll new-day tests passed');
process.exit(failed ? 1 : 0);
