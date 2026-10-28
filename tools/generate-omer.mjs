/**
 * Writes js/omer-data.js: the 49 counts of the Omer in Hebrew and English,
 * from Hebcal, in the spelling of the Chabad siddur (לָעֹמֶר, שְׁלֹשָׁה; no
 * meteg marks). Read every line after running it.
 *
 * Run:  cd tools && node generate-omer.mjs
 */
import { writeFileSync } from 'node:fs';
import { OmerEvent, HDate } from '@hebcal/core';

const clean = s => s.normalize('NFC')
  .replace(/ֽ/g, '')                        // meteg
  .replace(/לָעוֹמֶר/g, 'לָעֹמֶר')
  .replace(/שְׁלוֹשָׁה/g, 'שְׁלֹשָׁה')
  .replace(/שְׁלוֹשִׁים/g, 'שְׁלֹשִׁים');

const he = [], en = [];
for (let n = 1; n <= 49; n++) {
  const e = new OmerEvent(new HDate(1, 'Iyyar', 5787), n);
  he.push(clean(e.getTodayIs('he')));
  en.push(e.getTodayIs('en').replace(/^Today is (\d+) days?/, (_, k) => 'Today is ' + k + (k === '1' ? ' day' : ' days')));
}
writeFileSync(new URL('../js/omer-data.js', import.meta.url),
  '// The count of the Omer, each night (made by tools/generate-omer.mjs from Hebcal,\n'
  + '// in the spelling of the Chabad siddur). OMER_COUNT_HE[n - 1] is night n.\n'
  + 'const OMER_COUNT_HE = ' + JSON.stringify(he, null, 1) + ';\n'
  + 'const OMER_COUNT_EN = ' + JSON.stringify(en, null, 1) + ';\n');
console.log(he.join('\n'));
