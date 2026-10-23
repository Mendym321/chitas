/**
 * Tests for js/more-learning.js and the schedules it reads (data/cycles.json,
 * data/likkutei-torah.json): known days with known right answers.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/more-learning.js', import.meta.url), 'utf8'), ctx);
const M = vm.runInContext('({ cycleDay, weekShabbos, maamarimFor, maamarimBooks, dafLabel, nachLabel, kitzurLabel, hebNumeral })', ctx);
const cycles = JSON.parse(readFileSync(new URL('../data/cycles.json', import.meta.url)));
const weeks = JSON.parse(readFileSync(new URL('../data/likkutei-torah.json', import.meta.url)));

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const day = iso => JSON.parse(JSON.stringify(M.cycleDay(cycles, iso)));

console.log('Daily cycles');
check('12 Cheshvan 5787: Bechoros 35, Yirmiyahu 41, Kitzur 10:20 to the end of the siman', day('2026-10-23'), {
  daf: { label: 'Bechoros 35', ref: 'Bekhorot 35a-35b', note: null },
  nach: { label: 'Yirmiyahu 41', ref: 'Jeremiah 41' },
  kitzur: { label: 'Siman 10:20–26', ref: 'Kitzur Shulchan Arukh 10:20-26' },
});
check('a Kitzur reading across two simanim', day('2026-11-21').kitzur, { label: 'Simanim 25:1–26:2', ref: 'Kitzur Shulchan Arukh 25:1-26:2' });
check('Berachos ends on 64a: no amud beis', cycles.days.some(r => r[1] === 'Berakhot 64a') && !cycles.days.some(r => r[1] === 'Berakhot 64a-64b'), true);
check('Me\'ilah 22 is also the first perek of Kinnim (Vilna page)', day('2027-03-12').daf.ref, 'Meilah 22a|Mishnah Kinnim 1:1-4');
check('Kinnim is learned from the Mishnah, page by page', ['2027-03-13', '2027-03-14', '2027-03-15'].map(i => day(i).daf.ref),
  ['Mishnah Kinnim 2:1-3:1', 'Mishnah Kinnim 3:1-6', 'Mishnah Kinnim 3:6']);
check('where a daf starts inside a mishnah, the note says where', day('2027-03-15').daf.note.includes('בן עזאי אומר'), true);
check('Middos, page by page', ['2027-03-24', '2027-03-25', '2027-03-26', '2027-03-27'].map(i => day(i).daf.ref),
  ['Mishnah Middot 1:1-2:2', 'Mishnah Middot 2:3-3:1', 'Mishnah Middot 3:2-4:2', 'Mishnah Middot 4:3-5:4']);
check('an ordinary daf has no note', day('2027-03-16').daf, { label: 'Tamid 26', ref: 'Tamid 26a-26b', note: null });
check('Shekalim is the Yerushalmi', day('2028-08-25').daf.ref, 'Jerusalem Talmud Shekalim.1.1.10-4.1');
check('Nach Yomi includes Tehillim', day('2027-03-16').nach.label, 'Tehillim 18');
check('Adar II of a leap year: Kitzur on brachos (Hebcal typo fixed)', day('2027-03-18').kitzur.ref, 'Kitzur Shulchan Arukh 17:8-18:2');
check('30 Cheshvan has no Kitzur reading', day('2026-11-10').kitzur, null);
check('15 Elul is Klalim, with no text', day('2027-09-17').kitzur, { label: 'Klalim', ref: null });
check('every day of the schedule is there', cycles.days.length, Math.round((Date.parse(cycles.end) - Date.parse(cycles.start)) / 864e5) + 1);
check('outside the schedule: nothing', [M.cycleDay(cycles, '2026-08-31'), M.cycleDay(cycles, '2030-10-01')], [null, null]);
check('Nach Yomi goes one chapter a day', [day('2026-10-24').nach.label, day('2026-10-25').nach.label], ['Yirmiyahu 42', 'Yirmiyahu 43']);

check('daf numbers in Hebrew letters', [2, 15, 16, 35, 64, 100, 119, 142, 176].map(M.hebNumeral), ['ב', 'טו', 'טז', 'לה', 'סד', 'ק', 'קיט', 'קמב', 'קעו']);

console.log('Weekly Likkutei Torah');
check('the week ends on Shabbos', [M.weekShabbos('2026-10-18'), M.weekShabbos('2026-10-23'), M.weekShabbos('2026-10-24')], ['2026-10-24', '2026-10-24', '2026-10-24']);
const lech = M.maamarimFor(weeks, 'Lech Lecha');
check('Lech Lecha: six maamarim of Torah Ohr', [lech.length, M.maamarimBooks(lech)], [6, 'Torah Ohr']);
check('a maamar opening in brackets gets its words as a title', lech[1].title, 'אנכי מגן לך');
const tm = M.maamarimFor(weeks, 'Tazria-Metzora');
check('Tazria-Metzora: both parshiyos', [tm.length, tm[0].ref, tm[tm.length - 1].ref], [26, 'Likkutei Torah, Tazria 1', 'Likkutei Torah, Metzora 20']);
check('Beshalach: Torah Ohr and Likkutei Torah', M.maamarimBooks(M.maamarimFor(weeks, 'Beshalach')), 'Torah Ohr and Likkutei Torah');
check('Vayeilech on its own: the Shabbos Shuvah maamarim', M.maamarimFor(weeks, 'Vayeilech')[0].ref, 'Likkutei Torah, Shabbat Shuvah 1');
check('Nitzavim-Vayeilech: Nitzavim (Shabbos Shuvah is the next week)', M.maamarimFor(weeks, 'Nitzavim-Vayeilech').length, M.maamarimFor(weeks, 'Nitzavim').length);
check('Shoftim has none', M.maamarimFor(weeks, 'Shoftim'), []);
check('every maamar has a title and a time', Object.values(weeks).flat().every(m => m.t.length > 3 && m.m >= 5), true);

if (failed) { console.log('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll passed');
