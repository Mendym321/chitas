/**
 * Tests for js/day-note.js — the line under the greeting on Today.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { Intl, Date };
vm.createContext(ctx);
for (const f of ['holidays-data', 'progress', 'day-note'])
  vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8'), ctx);
const { dayNote, omerDay, parshaSpelling } = vm.runInContext('({ dayNote, omerDay, parshaSpelling })', ctx);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const day = s => new Date(s + 'T12:00:00');
const note = (s, parsha = null) => [...dayNote(day(s), parsha)];

check('an ordinary Monday: just the parsha', note('2026-10-19', 'Lech Lecha'), ['Parshas Lech Lecha']);
check('Friday', note('2026-10-23', 'Lech Lecha'), ['Erev Shabbos', 'Parshas Lech Lecha']);
check('Shabbos', note('2026-10-24', 'Lech Lecha'), ['Shabbos', 'Parshas Lech Lecha']);
check('Rosh Chodesh, day 30', note('2026-11-10', 'Chayei Sara'), ['Rosh Chodesh Kislev', 'Parshas Chayei Sarah']);
check('Rosh Chodesh, day 1', note('2026-11-11', 'Toldot'), ['Rosh Chodesh Kislev', 'Parshas Toldos']);
check('no Rosh Chodesh on Rosh Hashanah', note('2026-09-12'), ['Shabbos', 'Rosh Hashanah']);
check('Yud-Tes Kislev', note('2026-11-29', 'Vayishlach'), ['Yud-Tes Kislev, Rosh Hashanah of Chassidus', 'Parshas Vayishlach']);
check('Chanukah', note('2026-12-07', 'Miketz'), ['Chanukah, the third light', 'Parshas Miketz']);
check('Zos Chanukah', note('2026-12-12', 'Miketz'), ['Shabbos', 'Zos Chanukah']);
check('Yom Tov: no parsha', note('2027-04-22', 'Acharei Mot'), ['Pesach']);
check('the Omer starts on the second day', note('2027-04-23', 'Acharei Mot'), ['Erev Shabbos', 'Pesach', 'Day 1 of the Omer']);
check('the Omer', omerDay(day('2027-05-25')), 33);
check('Lag BaOmer', note('2027-05-25', 'Emor'), ["Lag BaOmer", 'Day 33 of the Omer']);
check('a fast on Shabbos moves to Sunday (17 Tammuz 5789)', [note('2029-06-30').includes("Shivah Asar B'Tammuz"), note('2029-07-01').includes("Shivah Asar B'Tammuz")], [false, true]);
check('Gimmel Tammuz', note('2027-07-08').includes('Gimmel Tammuz'), true);
check('Chabad spelling of double parshas', parshaSpelling('Acharei Mot-Kedoshim'), 'Acharei-Kedoshim');
check('leap year Purim is in Adar II', note('2027-03-23').includes('Purim'), true);
check('Purim Katan', note('2027-02-21').includes('Purim Katan'), true);

console.log(failed ? `\n${failed} FAILED` : '\nAll day-note tests passed');
process.exit(failed ? 1 : 0);
