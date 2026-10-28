/**
 * Writes js/omer-data.js from the Chabad siddur (Tehillas Hashem, as on
 * Sefaria), kept in tools/data/sefirah-tehillas-hashem.txt: each night's count
 * and its line (the word of Ana Bekoach, the sefirah, the word of Lamenatzeach,
 * the letter), and what is said after counting. The English counts come from
 * Hebcal. Two typos in the source are fixed (night 25 חֲמִשָׁה, night 39
 * חֲמִשָּׁהּ → חֲמִשָּׁה). tools/test-omer.mjs checks the words line up.
 *
 * Run:  cd tools && node generate-omer.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { OmerEvent, HDate } from '@hebcal/core';

const src = readFileSync(new URL('./data/sefirah-tehillas-hashem.txt', import.meta.url), 'utf8').normalize('NFC').split('\n').map(l => l.trim());
const plain = s => s.replace(/[֑-ׇ]/g, '');
const fix = s => s.replace('חֲמִשָׁה'.normalize('NFC'), 'חֲמִשָּׁה'.normalize('NFC')).replace('חֲמִשָּׁהּ'.normalize('NFC'), 'חֲמִשָּׁה'.normalize('NFC'));

const he = [], line = [], en = [];
src.forEach((l, i) => {
  const m = l.match(/^(\d+)\. (.*?):?$/);
  if (!m) return;
  he.push(fix(m[2]));
  const t = src[i + 1].split(/\s+/);
  line.push({ ana: plain(t.slice(0, -4).join(' ')), sefirah: plain(t.slice(-4, -2).join(' ')), word: plain(t.at(-2)), letter: t.at(-1) });
  en.push(new OmerEvent(new HDate(1, 'Iyyar', 5787), +m[1]).getTodayIs('en'));
});
const after = src.slice(src.findIndex(l => l.startsWith('הָרַחֲמָן'))).filter(Boolean);
const AFTER = {
  harachaman: after[0],
  lamenatzeach: after[1],
  ana: after.slice(2, 9),
  baruchShem: after[9],
  ribono: after[10],
};
writeFileSync(new URL('../js/omer-data.js', import.meta.url),
  '// Sefiras HaOmer in the Chabad siddur (Tehillas Hashem): made by tools/generate-omer.mjs\n'
  + '// from tools/data/sefirah-tehillas-hashem.txt. Night n is [n - 1].\n'
  + 'const OMER_COUNT_HE = ' + JSON.stringify(he, null, 1) + ';\n'
  + '// Under each count: the word of Ana Bekoach, the sefirah, the word of Lamenatzeach, the letter\n'
  + 'const OMER_LINE = ' + JSON.stringify(line) + ';\n'
  + 'const OMER_COUNT_EN = ' + JSON.stringify(en, null, 1) + ';\n'
  + '// After counting\n'
  + 'const OMER_AFTER_HE = ' + JSON.stringify(AFTER, null, 1) + ';\n');
console.log(he.length, line.length, after.length, line[6], line[48]);
