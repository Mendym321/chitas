/**
 * Tests for js/account-merge.js — signing in after using the app signed out.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { Intl, Date };
vm.createContext(ctx);
for (const f of ['holidays-data', 'progress', 'account-merge'])
  vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8'), ctx);
const merge = vm.runInContext('mergeGuestIntoAccount', ctx);

let failed = 0;
function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const TODAY = new Date('2026-10-14T12:00:00');
const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true };

console.log('Signing in after using the app signed out:');
const guest = { started: true, xp: 70, lastDate: '2026-10-14', done: { chumash: true, tehillim: true }, pastDone: { '2026-10-13': ALL }, tehillimPeople: [{ label: 'Savta', heDay: 5, heMonth: 'Nissan', heYear: 5700 }] };

const fresh = merge(guest, null, TODAY);
check('new account → keeps everything from the phone', [fresh.xp, fresh.pastDone['2026-10-13'], fresh.done], [70, ALL, { chumash: true, tehillim: true }]);

const remote = { uid: 'u1', name: 'Mendy', rambamTrack: '1', xp: 500, lastDate: '2026-10-12', done: ALL, pastDone: { '2026-10-11': ALL },
  tehillimPeople: [{ label: 'Savta', heDay: 5, heMonth: 'Nissan', heYear: 5700 }, { label: 'Zaidy', heDay: 1, heMonth: 'Av', heYear: 5690 }] };
const m = merge(guest, remote, TODAY);
check('days from both are kept (incl. the account\'s unarchived Oct 12)', Object.keys(m.pastDone).sort(), ['2026-10-11', '2026-10-12', '2026-10-13']);
check('today = what was done on the phone today', m.done, { chumash: true, tehillim: true });
check('points add up when the days are different', m.xp, 570);
check('account settings win (track, name)', [m.rambamTrack, m.name, m.uid], ['1', 'Mendy', 'u1']);
check('Tehillim names combined without duplicates', m.tehillimPeople.map(p => p.label), ['Savta', 'Zaidy']);

const sameDay = merge(
  { xp: 50, lastDate: '2026-10-14', done: ALL, pastDone: {} },
  { uid: 'u1', xp: 30, lastDate: '2026-10-14', done: { chumash: true, tehillim: true, tanya: false }, pastDone: {} }, TODAY);
check('same section marked on both today → its points counted once', sameDay.xp, 60); // 50 + 30 − 2×10
check('…and all 4 are done today', Object.keys(sameDay.done).filter(k => sameDay.done[k]).length, 4);

console.log(failed ? `\n${failed} FAILED` : '\nAll account-merge tests passed');
process.exit(failed ? 1 : 0);
