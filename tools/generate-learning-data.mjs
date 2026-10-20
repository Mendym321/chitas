/**
 * Generates ../js/learning-data.js — the numbers behind "Your learning":
 *  - pesukim per chapter of the five books of the Torah (to count pesukim learned)
 *  - halachos learned each day on the 3-chapter and 1-chapter Rambam tracks
 *  - which book of Mishneh Torah each day is in, on both tracks (for milestones)
 * Sources: tools/data/*.json (from Sefaria's public export) + @hebcal/learning.
 * Run:  cd tools && node generate-learning-data.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { HDate } from '@hebcal/core';
import { dailyRambam3, dailyRambam1 } from '@hebcal/learning';

const torah = JSON.parse(readFileSync(new URL('./data/torah-lengths.json', import.meta.url))).books;
const rambam = JSON.parse(readFileSync(new URL('./data/rambam-lengths.json', import.meta.url))).books;

const START = new Date(2025, 0, 1), END = new Date(2046, 11, 31);
const missing = new Set();
// Hebcal and Sefaria sometimes differ in capitals ("within their" / "within Their")
const byLower = Object.fromEntries(Object.entries(rambam).map(([k, v]) => [k.toLowerCase(), v]));
// perek is a number (13), a range ("8-9"), or chapter:verse range ("1:1-4:8").
// Books without chapters (the lists of mitzvos, the introduction) count each item as one.
function count(name, perek) {
  const ch = byLower[name.toLowerCase()];
  if (!ch) return null;
  const m = String(perek).match(/^(\d+)(?::\d+)?(?:-(\d+)(?::\d+)?)?$/);
  if (!m) return null;
  const from = +m[1], to = m[2] ? +m[2] : from;
  const flat = ch.every(n => n === 0); // a list, not chapters
  let n = 0;
  for (let c = from; c <= to; c++) {
    if (flat) n += 1;
    else if (ch[c - 1]) n += ch[c - 1];
    else return null;
  }
  return n;
}
const halachos = list => [].concat(list).reduce((n, { name, perek }) => {
  const c = count(name, perek);
  if (c === null) { missing.add(name + ' ' + perek); return n; }
  return n + c;
}, 0);

// The 14 books of Mishneh Torah (book 0 = the introduction and lists of mitzvos)
const RAMBAM_BOOKS = [
  ['Introduction', ['Transmission of the Oral Law', 'Positive Mitzvot', 'Negative Mitzvot', 'Overview of Mishneh Torah Contents']],
  ['Sefer HaMada', ['Foundations of the Torah', 'Human Dispositions', 'Torah Study', 'Foreign Worship and Customs of the Nations', 'Repentance']],
  ['Sefer Ahavah', ['Reading the Shema', 'Prayer and the Priestly Blessing', 'Tefillin, Mezuzah and the Torah Scroll', 'Fringes', 'Blessings', 'Circumcision', 'The Order of Prayer']],
  ['Sefer Zemanim', ['Sabbath', 'Eruvin', 'Rest on the Tenth of Tishrei', 'Rest on a Holiday', 'Leavened and Unleavened Bread', 'Shofar, Sukkah and Lulav', 'Sheqel Dues', 'Sanctification of the New Month', 'Fasts', 'Scroll of Esther and Hanukkah']],
  ['Sefer Nashim', ['Marriage', 'Divorce', 'Levirate Marriage and Release', 'Virgin Maiden', 'Woman Suspected of Infidelity']],
  ['Sefer Kedushah', ['Forbidden Intercourse', 'Forbidden Foods', 'Ritual Slaughter']],
  ['Sefer Hafla\'ah', ['Oaths', 'Vows', 'Nazariteship', 'Appraisals and Devoted Property']],
  ['Sefer Zeraim', ['Diverse Species', 'Gifts to the Poor', 'Heave Offerings', 'Tithes', "Second Tithes and Fourth Year's Fruit", 'First Fruits and other Gifts to Priests Outside the Sanctuary', 'Sabbatical Year and the Jubilee']],
  ['Sefer Avodah', ['The Chosen Temple', 'Vessels of the Sanctuary and Those who Serve Therein', 'Admission into the Sanctuary', 'Things Forbidden on the Altar', 'Sacrificial Procedure', 'Daily Offerings and Additional Offerings', 'Sacrifices Rendered Unfit', 'Service on the Day of Atonement', 'Trespass']],
  ['Sefer Korbanos', ['Paschal Offering', 'Festival Offering', 'Firstlings', 'Offerings for Unintentional Transgressions', 'Offerings for Those with Incomplete Atonement', 'Substitution']],
  ['Sefer Taharah', ['Defilement by a Corpse', 'Red Heifer', 'Defilement by Leprosy', 'Those Who Defile Bed or Seat', 'Other Sources of Defilement', 'Defilement of Foods', 'Vessels', 'Immersion Pools']],
  ['Sefer Nezikin', ['Damages to Property', 'Theft', 'Robbery and Lost Property', 'One Who Injures a Person or Property', 'Murderer and the Preservation of Life']],
  ['Sefer Kinyan', ['Sales', 'Ownerless Property and Gifts', 'Neighbors', 'Agents and Partners', 'Slaves']],
  ['Sefer Mishpatim', ['Hiring', 'Borrowing and Deposit', 'Creditor and Debtor', 'Plaintiff and Defendant', 'Inheritances']],
  ['Sefer Shoftim', ['The Sanhedrin and the Penalties within their Jurisdiction', 'Testimony', 'Rebels', 'Mourning', 'Kings and Wars']],
];
const bookOf = {};
RAMBAM_BOOKS.forEach(([, names], i) => names.forEach(n => { bookOf[n.toLowerCase()] = i; }));

const r3 = [], r1 = [], b3 = [], b1 = [];
const book = list => { const items = [].concat(list); const i = bookOf[items[items.length - 1].name.toLowerCase()];
  if (i === undefined) { missing.add('book of ' + items[items.length - 1].name); return 0; } return i; };
for (let d = new Date(START); d <= END; d.setDate(d.getDate() + 1)) {
  const hd = new HDate(d);
  r3.push(halachos(dailyRambam3(hd)));
  r1.push(halachos(dailyRambam1(hd)));
  b3.push(book(dailyRambam3(hd)));
  b1.push(book(dailyRambam1(hd)));
}
// Each book's run of days: [first day index, last day index, book] (a day
// belongs to the book its last chapter is in)
const spans = days => { const out = []; let s = 0;
  for (let i = 1; i <= days.length; i++) if (i === days.length || days[i] !== days[s]) { out.push([s, i - 1, days[s]]); s = i; }
  return out; };
if (missing.size) { console.error('No halacha count for:', [...missing].slice(0, 20)); process.exit(1); }

const out = `// GENERATED by tools/generate-learning-data.mjs — do not edit by hand.
// Pesukim per chapter (Torah) and halachos learned per day (Rambam tracks),
// from Sefaria's public export and Hebcal. Used by js/learning-stats.js.
const TORAH_CHAPTER_LENGTHS = ${JSON.stringify(torah)};
const RAMBAM_DAILY_HALACHOS = {
  start: '2025-01-01',
  // one number per day from the start date
  three: '${r3.join(',')}',
  one: '${r1.join(',')}',
};
// The books of Mishneh Torah, and the days each one runs on each track
// (day indexes from RAMBAM_DAILY_HALACHOS.start): [first, last, book]
const RAMBAM_BOOK_NAMES = ${JSON.stringify(RAMBAM_BOOKS.map(([n]) => n))};
const RAMBAM_BOOK_SPANS = { three: ${JSON.stringify(spans(b3))}, one: ${JSON.stringify(spans(b1))} };
`;
writeFileSync(new URL('../js/learning-data.js', import.meta.url), out);
console.log('Wrote js/learning-data.js:', r3.length, 'days;', (out.length / 1024).toFixed(0) + ' KB');
