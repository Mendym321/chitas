/**
 * Tests for the new day and for two devices (js/progress.js: archiveOldToday,
 * syncFromCloud). They run on New York time, where the bug lived: the night's
 * marks were filed under the wrong day, or dropped, the next morning.
 * Run:  cd tools && npm test
 */
process.env.TZ = 'America/New_York';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
for (const f of ['../js/holidays-data.js', '../js/progress.js'])
  vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const P = vm.runInContext('({ archiveOldToday, syncFromCloud, progressISO, appNow })', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
}
const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true };
const MON = '2026-10-26', TUE = '2026-10-27', SUN = '2026-10-25';

console.log('A new day:');
check('(the old way: in New York, "2026-10-26" read as a date is the 25th)', P.progressISO(new Date(MON)), SUN);

// Learned all of Sunday and Monday; Monday's marks are still "today" when Tuesday starts
const user = { lastDate: MON, done: { ...ALL }, quizDone: { tanya: { quick: { r: 4, n: 4 } } }, pastDone: { [SUN]: { ...ALL } }, pastQuizDone: {} };
const moved = P.archiveOldToday(user, TUE);
check('Monday night\'s marks move to Monday (not Sunday, and not lost)', moved.pastDone[MON], ALL);
check('Sunday is untouched', moved.pastDone[SUN], ALL);
check('Monday\'s Review moves with them', moved.pastQuizDone[MON], { tanya: { quick: { r: 4, n: 4 } } });
check('today starts empty', [moved.done, moved.quizDone], [{}, {}]);
check('a day that already has marks keeps them, the new ones added', P.archiveOldToday({ lastDate: MON, done: { tanya: true }, pastDone: { [MON]: { chumash: true } } }, TUE).pastDone[MON], { chumash: true, tanya: true });
check('still the same day: nothing moves', P.archiveOldToday({ lastDate: TUE, done: ALL }, TUE), null);
check('nothing marked: nothing to move', P.archiveOldToday({ lastDate: MON, done: {}, quizDone: {} }, TUE), null);
check('the clock set back a day: nothing moves', P.archiveOldToday({ lastDate: TUE, done: ALL }, MON), null);
check('very old saved dates ("Mon Oct 26 2026") still work', P.archiveOldToday({ lastDate: 'Mon Oct 26 2026', done: { tanya: true } }, TUE).pastDone[MON], { tanya: true });

console.log('The learning day starts at 4 am:');
check('1:30 am Tuesday is still Monday', P.progressISO(P.appNow(new Date('2026-10-27T01:30:00'))), MON);
check('3:59 am is still Monday', P.progressISO(P.appNow(new Date('2026-10-27T03:59:00'))), MON);
check('4:00 am is Tuesday', P.progressISO(P.appNow(new Date('2026-10-27T04:00:00'))), TUE);
check('11 pm is that day', P.progressISO(P.appNow(new Date('2026-10-27T23:00:00'))), TUE);
check('the night the clocks go back (1 Nov): 3:30 am is still Shabbos', P.progressISO(P.appNow(new Date('2026-11-01T03:30:00'))), '2026-10-31');

console.log('Two devices:');
const at = s => new Date(s + 'T09:00:00');
// Phone: opened Monday morning, Chumash marked. Laptop: Tehillim, Tanya and a Review on Monday night.
const phone = { lastDate: MON, done: { chumash: true }, pastDone: { [SUN]: ALL }, quizDone: {}, milestones: ['streak-3'] };
const cloud = { lastDate: MON, done: { chumash: true, tehillim: true, tanya: true }, quizDone: { tanya: { quick: { r: 3, n: 4 } } }, pastDone: { [SUN]: ALL }, milestones: ['streak-3', 'tanya-part'] };
const tue = P.syncFromCloud(phone, cloud, at(TUE));
check('Tuesday morning on the phone: Monday has everything from both', tue.pastDone[MON], { chumash: true, tehillim: true, tanya: true });
check('and Monday night\'s Review', tue.pastQuizDone[MON], { tanya: { quick: { r: 3, n: 4 } } });
check('and Tuesday starts empty', tue.done, {});
const mon = P.syncFromCloud(phone, cloud, at(MON));
check('the same evening: today has the laptop\'s marks too', mon.done, { chumash: true, tehillim: true, tanya: true });
check('a mark only this phone has (not saved yet) is kept', P.syncFromCloud({ lastDate: MON, done: { rambam: true } }, cloud, at(MON)).done.rambam, true);
check('unmarked on the other device: the cloud\'s later save wins', P.syncFromCloud({ lastDate: MON, done: { tanya: true } }, { lastDate: MON, done: { tanya: false } }, at(MON)).done.tanya, false);
check('the phone moved to Tuesday, the cloud still on Monday: both Mondays combine', P.syncFromCloud({ lastDate: TUE, done: { chumash: true }, pastDone: { [MON]: { chumash: true } } }, cloud, at(TUE)).pastDone[MON], { chumash: true, tehillim: true, tanya: true });
check('milestones from both, each once', tue.milestones, ['streak-3', 'tanya-part']);
check('the later of the two dates', P.syncFromCloud({ lastDate: TUE, done: {} }, { lastDate: MON, done: {} }, at(TUE)).lastDate, TUE);

console.log(failed ? `\n${failed} FAILED` : '\nAll new-day tests passed');
process.exit(failed ? 1 : 0);
