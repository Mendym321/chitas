/**
 * Tests for the Sefer HaMitzvos cycle (js/sefer-hamitzvos.js) against Hebcal.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { seferHaMitzvot } = await import(new URL('./node_modules/@hebcal/learning/dist/esm/seferHaMitzvotBase.js', import.meta.url));

const ctx = { Intl, Date, Math };
vm.createContext(ctx);
for (const f of ['sefer-hamitzvos-data', 'sefer-hamitzvos']) vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8'), ctx);
const { shmReading, shmSubtitle } = vm.runInContext('({ shmReading, shmSubtitle })', ctx);

let failed = 0;
function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
}
const day = s => new Date(s + 'T12:00:00');
const ids = r => r.items.map(i => i.id || i.other).join(', ');

console.log('Sefer HaMitzvos:');
check('Wed 28 Oct 2026 is day 268: N251 (as on Chabad.org)', [shmReading(day('2026-10-28')).day, ids(shmReading(day('2026-10-28')))], [268, 'N251']);
check('the order is kept: day 13 (Wed 20 Jan 2027) is N10, N47 … P186, N23, N24', [shmReading(day('2027-01-20')).day, ids(shmReading(day('2027-01-20')))], [13, 'N10, N47, N60, N6, N5, N2, N3, N4, N15, P186, N23, N24']);
check('days that are not mitzvos are named: day 2', shmReading(day('2027-01-09')).items[0].en, 'Principles 1–3');
check('the Today line', shmSubtitle(day('2026-10-28')), 'Negative Commandment 251');
check('day 339 on Thu 7 Jan 2027, then day 1: the Rambam\'s introduction', [shmReading(day('2027-01-07')).day, shmReading(day('2027-01-08')).day, shmReading(day('2027-01-08')).items[0].en], [339, 1, 'The Rambam\'s introduction']);

console.log('Every day 2026–2045 against Hebcal:');
const wrong = [];
for (let d = day('2026-01-01'); d < day('2046-01-01'); d.setDate(d.getDate() + 1)) {
  const mine = shmReading(new Date(d));
  const want = seferHaMitzvot(new Date(d));
  if (mine.day !== want.day || ids(mine) !== want.reading.split(', ').join(', ') || !!mine.note !== !!want.note) wrong.push(d.toDateString());
}
check('the day, its mitzvos in order, and the notes on varying editions', wrong.slice(0, 3).join(', '), '');

console.log(failed ? `\n${failed} FAILED` : '\nAll Sefer HaMitzvos tests passed');
process.exit(failed ? 1 : 0);
