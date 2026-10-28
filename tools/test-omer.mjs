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
const { omerDay, sotahDaf, omerCount, omerAfter } = vm.runInContext('({ omerDay, sotahDaf, omerCount, omerAfter })', ctx);

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
check('night 13: the English and the sefirah', [omerCount(13).en, omerCount(13).sefirah.en, omerCount(13).sefirah.he],
  ['Today is 13 days, which are 1 week and 6 days of the Omer', 'Yesod shebiGevurah', 'יְסוֹד שֶׁבִּגְבוּרָה']);
check('night 1 and night 49, in the siddur\'s words', [omerCount(1).he, omerCount(49).sefirah.en], ['הַיּוֹם יוֹם אֶחָד לָעֹֽמֶר'.normalize('NFC'), "Malchus sheb'Malchus"]);
check('night 7\'s line: Ana Bekoach, sefirah, Lamenatzeach, letter', omerCount(7).line, { ana: 'אב״ג ית״ץ', sefirah: 'מלכות שבחסד', word: 'סלה', letter: 'י' });
check('the source\'s two typos are fixed (nights 25, 39)', [omerCount(25).he.includes('חֲמִשָּׁה וְעֶשְׂרִים'.normalize('NFC')), omerCount(39).he.includes('חֲמִשָּׁהּ'.normalize('NFC'))], [true, false]);

// After counting: each night's marked word is the one the siddur names for it
console.log('After counting, every night:');
const plain = s => s.replace(/[\u0591-\u05C7,.]/g, '');
const marked = s => [...s.matchAll(/<mark>(.*?)<\/mark>/g)].map(m => plain(m[1]));
const off = [];
for (let n = 1; n <= 49; n++) {
  const a = omerAfter(n), l = omerCount(n).line;
  const got = [marked(a.psalm), marked(a.ana.join(' ')), marked(a.ribono)];
  const nov = s => s.replace(/ו/g, '');   // the line spells some words with a vav, the text without (גדולת / גְּדֻלַּת, ברב / בְּרוֹב)
  if (nov(got[0].join()) !== nov(l.word) || nov(got[1].join()) !== nov(l.ana) || got[2].join() !== plain(omerCount(n).sefirah.he) || plain(omerCount(n).sefirah.he) !== l.sefirah)
    off.push(n + ': ' + JSON.stringify(got) + ' vs ' + JSON.stringify(l));
}
check('Lamenatzeach, Ana Bekoach and the sefirah in Ribono shel Olam: one mark each, the right one', off.slice(0, 2).join(' | '), '');
const verse = 'ישמחו וירננו לאמים כי תשפוט עמים מישור ולאמים בארץ תנחם סלה'.replace(/ /g, '');
check('the letters spell ישמחו… in order', Array.from({ length: 49 }, (_, i) => omerCount(i + 1).line.letter).join(''), verse);
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
