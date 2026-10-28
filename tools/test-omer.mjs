/**
 * Tests for the Omer and Sotah (js/omer.js), against Hebcal.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { HDate, OmerEvent } from '@hebcal/core';

const ctx = { Intl, Date };
vm.createContext(ctx);
for (const f of ['tehillim', 'omer-data', 'omer']) vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8'), ctx);
const { omerDay, sotahDaf, omerCount } = vm.runInContext('({ omerDay, sotahDaf, omerCount })', ctx);

let failed = 0;
function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
}
const day = s => new Date(s + 'T12:00:00');

console.log('Omer 5787:');
check('15 Nissan (Thu 22 Apr 2027): not yet', omerDay(day('2027-04-22')), null);
check('16 Nissan: day 1, no Sotah', [omerDay(day('2027-04-23')), sotahDaf(1)], [1, null]);
check('17 Nissan: day 2, daf 2', [omerDay(day('2027-04-24')), sotahDaf(2)], [2, 2]);
check('1 Iyar: day 16, daf 16', [omerDay(day('2027-05-08')), sotahDaf(16)], [16, 16]);
check('Lag BaOmer (18 Iyar): day 33', omerDay(day('2027-05-25')), 33);
check('5 Sivan (Thu 10 Jun): day 49, daf 49, the last', [omerDay(day('2027-06-10')), sotahDaf(49)], [49, 49]);
check('Shavuos: over', omerDay(day('2027-06-11')), null);
check('night 13: the words and the sefirah', [omerCount(13).en, omerCount(13).sefirah.en, omerCount(13).sefirah.he],
  ['Today is 13 days, which are 1 week and 6 days of the Omer', 'Yesod shebiGevurah', 'יְסוֹד שֶׁבִּגְבוּרָה']);
check('night 1 and night 49', [omerCount(1).he, omerCount(49).sefirah.en], ['הַיּוֹם יוֹם אֶחָד לָעֹמֶר', "Malchus sheb'Malchus"]);
check('no night 0 or 50', [omerCount(0), omerCount(50)], [null, null]);

// Every year 2026–2045: the days match Hebcal, and each sefirah is Hebcal's (in Chabad pronunciation)
console.log('Every Omer 5786–5805 against Hebcal:');
const SAY = { Malkhut: 'Malchus', Tiferet: 'Tiferes', Hod: 'Hod', Chesed: 'Chesed', Gevurah: 'Gevurah', Netzach: 'Netzach', Yesod: 'Yesod' };
const wrong = [];
for (let y = 5786; y <= 5805; y++) {
  const first = new HDate(16, 'Nisan', y);
  for (let i = -3; i < 53; i++) {
    const h = first.add(i, 'd'), want = i >= 0 && i < 49 ? i + 1 : null;
    if (omerDay(h.greg()) !== want) wrong.push(h.toString() + ': ' + omerDay(h.greg()));
  }
}
check('every day of the season, and the days around it', wrong.slice(0, 3).join(' | '), '');
const wrongSefirah = [];
for (let n = 1; n <= 49; n++) {
  const want = new OmerEvent(new HDate(1, 'Iyyar', 5787), n).sefira('translit').replace(/[A-Z][a-z]+/g, w => SAY[w] || w).replace("shebiTiferes", "sheb'Tiferes");
  if (omerCount(n).sefirah.en !== want) wrongSefirah.push(n + ': ' + omerCount(n).sefirah.en + ' not ' + want);
}
check('all 49 sefiros match Hebcal', wrongSefirah.slice(0, 3).join(' | '), '');

console.log(failed ? `\n${failed} FAILED` : '\nAll Omer tests passed');
process.exit(failed ? 1 : 0);
