/**
 * Tests for js/reminders.js — when the daily reminder goes off.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
for (const f of ['../js/holidays-data.js', '../js/progress.js', '../js/reminders.js'])
  vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const reminderPlan = vm.runInContext('reminderPlan', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const at = s => new Date(s);   // local time, like the phone
const pad = n => String(n).padStart(2, '0');
const show = p => p.map(r => r.at.getFullYear() + '-' + pad(r.at.getMonth() + 1) + '-' + pad(r.at.getDate()) + ' ' + pad(r.at.getHours()) + ':' + pad(r.at.getMinutes()));

console.log('Reminders:');
// Mon 26 Oct 2026, 10:00. Shabbos is the 31st; no Yom Tov in these two weeks
const MON = at('2026-10-26T10:00:00');
const plan = show(reminderPlan('20:00', MON, false));

check('two weeks ahead, today first', plan.slice(0, 4), ['2026-10-26 20:00', '2026-10-27 20:00', '2026-10-28 20:00', '2026-10-29 20:00']);
check('Friday evening comes at midday instead', plan[4], '2026-10-30 12:00');
check('never on Shabbos', plan.some(p => p.startsWith('2026-10-31')), false);
check('Sunday back at the usual time', plan[5], '2026-11-01 20:00');
check('12 reminders in 14 days (two Shabbosim)', plan.length, 12);
check('a morning time stays as it is on Friday', show(reminderPlan('07:30', MON, false)).find(p => p.startsWith('2026-10-30')), '2026-10-30 07:30');
check('not today when today is done', show(reminderPlan('20:00', MON, true))[0], '2026-10-27 20:00');
check('not today when the time has passed', show(reminderPlan('08:00', MON, false))[0], '2026-10-27 08:00');
check('each day has its own id (the date)', reminderPlan('20:00', MON, false)[0].id, 20261026);
check('a bad time plans nothing', reminderPlan('25:00', MON, false), []);
check('no time plans nothing', reminderPlan('', MON, false), []);

// Sukkos 5787: Yom Tov 26–27 Sep 2026, Shemini Atzeres / Simchas Torah 3–4 Oct
const SUKKOS = show(reminderPlan('21:00', at('2026-09-24T09:00:00'), false));
check('the day before Yom Tov comes at midday', SUKKOS[1], '2026-09-25 12:00');
check('never on Yom Tov', SUKKOS.some(p => /2026-09-2[67]|2026-10-0[34]/.test(p)), false);
check('chol hamoed is a normal day', SUKKOS.includes('2026-09-28 21:00'), true);

console.log(failed ? `\n${failed} reminder test(s) failed` : '\nAll reminder tests passed');
process.exit(failed ? 1 : 0);
