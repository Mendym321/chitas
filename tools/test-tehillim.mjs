/**
 * Tests for the daily Tehillim cycle. Loads the SAME js/tehillim.js the app uses.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { HDate, HebrewCalendar } from '@hebcal/core';

const ctx = { Intl, Date };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/tehillim.js', import.meta.url), 'utf8'), ctx);
const getTehillimForDate = vm.runInContext('getTehillimForDate', ctx);
const [personalTehillimChapter, hebrewDateOf, hebrewMonthsOf, hebrewMonthDays, elulTehillim, elulTehillimCount] = vm.runInContext('[personalTehillimChapter, hebrewDateOf, hebrewMonthsOf, hebrewMonthDays, elulTehillim, elulTehillimCount]', ctx);

let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const day = s => new Date(s + 'T12:00:00');

console.log('Tehillim — Chabad.org verified:');
check('1 Cheshvan 5787 (Oct 12 2026) → 1–9', getTehillimForDate(day('2026-10-12')).ref, 'Psalms.1-9');

console.log('Tehillim — cycle rules:');
check('2 Cheshvan → 10–17',        getTehillimForDate(day('2026-10-13')).ref, 'Psalms.10-17');
check('label reads nicely',        getTehillimForDate(day('2026-10-12')).label, 'Psalms 1–9');
check('29 Teves 5787 (29-day month) → 140–150 (verified on Chabad.org)',
                                   getTehillimForDate(day('2027-01-08')).ref, 'Psalms.140-150');

// Every day: the app's Hebrew day must match Hebcal's, and short months finish the book
// Stops before 5806, where the browser's Hebrew calendar has a known bug (see js/tehillim.js)
console.log('Every day Oct 2025 – Aug 2045:');
let wrongDay = [], unfinished = [];
for (let d = day('2025-10-01'); d < day('2045-09-01'); d.setDate(d.getDate() + 1)) {
  const t = getTehillimForDate(new Date(d));
  const h = new HDate(new Date(d));
  if (t.day !== h.getDate()) wrongDay.push(d.toDateString());
  const lastDayOfMonth = h.getDate() === h.daysInMonth();
  if (lastDayOfMonth && !t.ref.endsWith('-150')) unfinished.push(d.toDateString());
}
check('Hebrew day matches Hebcal', wrongDay.slice(0, 3).join(', '), '');
check('last day of every month reaches Psalm 150', unfinished.slice(0, 3).join(', '), '');

console.log('Personal Tehillim:');
const REBBE = { heDay: 11, heMonth: 'Nissan', heYear: 5662 }, REBBETZIN = { heDay: 25, heMonth: 'Adar', heYear: 5661 };
check('the Rebbe on 17 Cheshvan 5787 → 125', personalTehillimChapter(REBBE, day('2026-10-28')), 125);
check('the Rebbe from 11 Nissan 5787 → 126', personalTehillimChapter(REBBE, day('2027-04-18')), 126);
check('the Rebbe the day before → still 125', personalTehillimChapter(REBBE, day('2027-04-17')), 125);
check('the Rebbetzin now → 126', personalTehillimChapter(REBBETZIN, day('2026-10-28')), 126);
check('the Rebbetzin on 25 Adar I 5787 (leap year) → still 126', personalTehillimChapter(REBBETZIN, day('2027-03-04')), 126);
check('the Rebbetzin on 25 Adar II 5787 → 127', personalTehillimChapter(REBBETZIN, day('2027-04-03')), 127);
check('older spellings still work (Hebcal\'s "Nisan")', personalTehillimChapter({ ...REBBE, heMonth: 'Nisan' }, day('2026-10-28')), 125);
check('a birthday still to come → no chapter', personalTehillimChapter({ heDay: 1, heMonth: 'Nissan', heYear: 5787 }, day('2026-10-28')), null);
check('not filled in → no chapter', personalTehillimChapter({ heDay: 3, heMonth: '', heYear: 5750 }, day('2026-10-28')), null);
check('born 1 Dec 1989 → 3 Kislev 5750', JSON.stringify(hebrewDateOf(day('1989-12-01'))), JSON.stringify({ day: 3, month: 'Kislev', year: 5750 }));
check('a leap year lists Adar I and Adar II', hebrewMonthsOf(5787).filter(m => m.startsWith('Adar')).join(), 'Adar I,Adar II');
check('an ordinary year lists one Adar', hebrewMonthsOf(5786).filter(m => m.startsWith('Adar')).join(), 'Adar');
check('Tevet has 29 days, Shevat 30', [hebrewMonthDays('Tevet'), hebrewMonthDays('Shevat')].join(), '29,30');

// Against Hebcal's own birthday rules, for 3000 birthdays 1900–2026 on 40 days 2026–2044
console.log('3000 birthdays checked against Hebcal:');
let seed = 7; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
const wrong = [];
for (let i = 0; i < 3000; i++) {
  const born = new Date(1900 + rnd(127), rnd(12), 1 + rnd(28), 12);
  const on = new Date(2026 + rnd(18), rnd(12), 1 + rnd(28), 12);
  const hOn = new HDate(on), hBorn = new HDate(born);
  const bday = HebrewCalendar.getBirthdayOrAnniversary(hOn.getFullYear(), born);
  let want = hOn.getFullYear() - hBorn.getFullYear() + (hOn.abs() >= bday.abs() ? 1 : 0);
  want = want < 1 ? null : Math.min(want, 150);
  const b = hebrewDateOf(born), got = personalTehillimChapter({ heDay: b.day, heMonth: b.month, heYear: b.year }, on);
  if (got !== want) wrong.push(born.toDateString() + ' on ' + on.toDateString() + ': ' + got + ' not ' + want);
}
check('every chapter matches Hebcal', wrong.slice(0, 3).join(' | '), '');

console.log('Elul:');
const elul = s => { const e = elulTehillim(day(s)); return e && e.groups.map(g => (g.when ? g.when + ' ' : '') + g.from + '–' + g.to).join(', '); };
check('30 Av 5787 (first day of Rosh Chodesh): nothing yet', elul('2027-09-02'), null);
check('1 Elul 5787 (Fri 3 Sep 2027): 1–3', elul('2027-09-03'), '1–3');
check('2 Elul: 4–6', elul('2027-09-04'), '4–6');
check('29 Elul: 85–87', elul('2027-10-01'), '85–87');
check('1 Tishrei (Rosh Hashanah): 88–90', elul('2027-10-02'), '88–90');
check('9 Tishrei: 112–114', elul('2027-10-10'), '112–114');
check('Yom Kippur: the last 36 in four nines', elul('2027-10-11'), 'Before Kol Nidrei 115–123, Before going to sleep 124–132, After Musaf 133–141, After Ne\'ilah 142–150');
check('11 Tishrei: over', elul('2027-10-12'), null);
check('label for the Today line', elulTehillim(day('2027-09-04')).label, 'Elul 4–6');

// Every year 2026–2045: the season is 1 Elul – 10 Tishrei by Hebcal, and says all 150 once
const wrongSeason = [];
for (let y = 5787; y <= 5805; y++) {
  const start = new HDate(1, 'Elul', y).greg(), end = new HDate(10, 'Tishrei', y + 1).greg();
  const said = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) elulTehillim(new Date(d)).groups.forEach(g => { for (let c = g.from; c <= g.to; c++) said.push(c); });
  const before = new Date(start); before.setDate(before.getDate() - 1);
  const after = new Date(end); after.setDate(after.getDate() + 1);
  if (said.join() !== Array.from({ length: 150 }, (_, i) => i + 1).join() || elulTehillim(before) || elulTehillim(after)) wrongSeason.push(y);
}
check('5787–5805: each season says 1–150 once, in order, and nothing outside it', wrongSeason.join(), '');
check('counted: 3 a day, 36 on Yom Kippur', [elulTehillimCount(day('2027-09-04')), elulTehillimCount(day('2027-10-11')), elulTehillimCount(day('2027-11-01'))].join(), '3,36,0');

console.log(failed ? `\n${failed} FAILED` : '\nAll Tehillim tests passed');
process.exit(failed ? 1 : 0);
