/**
 * Tests for js/reminders.js: when reminders go off.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { Intl, Date, Math };
vm.createContext(ctx);
for (const f of ['../js/holidays-data.js', '../js/progress.js', '../js/tehillim.js', '../js/omer-data.js', '../js/omer.js', '../js/reminders.js'])
  vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const { reminderPlans, reminderNudge } = vm.runInContext('({ reminderPlans, reminderNudge })', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const at = s => new Date(s);   // local time, like the phone
const pad = n => String(n).padStart(2, '0');
const when = r => r.at.getFullYear() + '-' + pad(r.at.getMonth() + 1) + '-' + pad(r.at.getDate()) + ' ' + pad(r.at.getHours()) + ':' + pad(r.at.getMinutes());
const show = p => p.map(r => when(r) + ' ' + (r.sections ? r.sections.join('+') : 'omer ' + r.omer));

console.log('Reminders:');
// Mon 26 Oct 2026, 06:00. Shabbos is the 31st; no Yom Tov in these two weeks
const MON = at('2026-10-26T06:00:00');
const MY = { tanya: '07:00', tehillim: '08:30', chumash: '08:30', rambam: '15:00' };
const plan = show(reminderPlans(MY, MON));
check('each section at its own time; the same time comes as one', plan.slice(0, 3), ['2026-10-26 07:00 tanya', '2026-10-26 08:30 chumash+tehillim', '2026-10-26 15:00 rambam']);
check('Friday: morning ones go, an afternoon one would ring on Shabbos, so it doesn\'t', plan.filter(p => p.startsWith('2026-10-30')), ['2026-10-30 07:00 tanya', '2026-10-30 08:30 chumash+tehillim']);
check('never on Shabbos', plan.some(p => p.startsWith('2026-10-31')), false);
check('Sunday as usual', plan.filter(p => p.startsWith('2026-11-01')).length, 3);
check('not for a section learned today', show(reminderPlans(MY, MON, { tanya: true })).filter(p => p.startsWith('2026-10-26')), ['2026-10-26 08:30 chumash+tehillim', '2026-10-26 15:00 rambam']);
check('not once its time has passed', show(reminderPlans(MY, at('2026-10-26T10:00:00'))).filter(p => p.startsWith('2026-10-26')), ['2026-10-26 15:00 rambam']);
check('each has its own id (the date, then which one)', reminderPlans(MY, MON).slice(0, 3).map(r => r.id), [2026102600, 2026102601, 2026102602]);
check('a section with no time (or a bad one) has none', show(reminderPlans({ tanya: '', rambam: '25:00' }, MON)), []);
check('nothing chosen: nothing', reminderPlans({}, MON), []);
check('the old "all four at 20:00" still works: one reminder a day', show(reminderPlans({ chumash: '20:00', tehillim: '20:00', tanya: '20:00', rambam: '20:00' }, MON))[0], '2026-10-26 20:00 chumash+tehillim+tanya+rambam');

// Sukkos 5787: Yom Tov 26–27 Sep 2026, Shemini Atzeres / Simchas Torah 3–4 Oct
const SUKKOS = show(reminderPlans({ rambam: '21:00', tanya: '09:00' }, at('2026-09-24T06:00:00')));
check('the day before Yom Tov: the morning one goes, the evening one doesn\'t', SUKKOS.filter(p => p.startsWith('2026-09-25')), ['2026-09-25 09:00 tanya']);
check('never on Yom Tov', SUKKOS.some(p => /2026-09-2[67]|2026-10-0[34]/.test(p)), false);
check('chol hamoed is a normal day', SUKKOS.includes('2026-09-28 21:00 rambam'), true);

console.log('The Omer reminder:');
// Sefirah 5787: night 1 is the night after 15 Nissan (Thu 22 Apr 2027, Yom Tov)
const OM = show(reminderPlans({ omer: '20:30' }, at('2027-04-20T06:00:00')));
check('not before Sefirah, and not on the first night (Yom Tov)', OM.filter(p => p < '2027-04-23'), []);
check('Friday night is Shabbos: no reminder; Sunday night counts 4', OM.slice(0, 2), ['2027-04-25 20:30 omer 4', '2027-04-26 20:30 omer 5']);
check('off unless chosen', reminderPlans(MY, at('2027-04-25T06:00:00')).some(r => r.omer), false);

console.log('A reminder that doesn\'t fit:');
const past = {}; for (let k = 1; k <= 10; k++) { const d = new Date(2026, 9, 26 - k); past[d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())] = { tanya: true, chumash: true, tehillim: true }; }
check('Rambam not learned in the last 7 learning days: ask about it', reminderNudge(MY, past, MON), 'rambam');
check('learned once in that week: no question', reminderNudge(MY, { ...past, '2026-10-22': { tanya: true, chumash: true, tehillim: true, rambam: true } }, MON), null);
check('only sections with a reminder', reminderNudge({ tanya: '07:00' }, past, MON), null);

console.log(failed ? `\n${failed} reminder test(s) failed` : '\nAll reminder tests passed');
process.exit(failed ? 1 : 0);
