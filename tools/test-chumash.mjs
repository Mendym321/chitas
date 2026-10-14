/**
 * Tests for the Chumash schedule. Loads the SAME js/chumash-data.js and
 * js/chumash.js files the app uses, then checks known answers.
 *
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the app's files into a sandbox, like the browser does with <script> tags
const ctx = {};
vm.createContext(ctx);
for (const f of ['../js/chumash-data.js', '../js/chumash.js']) {
  vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
}
const { getChumashAliyaRef, getParshaForDate, getChumashDayLabel } =
  vm.runInContext('({ getChumashAliyaRef, getParshaForDate, getChumashDayLabel })', ctx);

let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const day = s => new Date(s + 'T12:00:00');

// ── Verified by hand on Chabad.org (Oct 2026) ───────────────────────────────
console.log('Chabad.org verified dates:');
check('Dec 5 2026  Vayeshev 7',   getChumashAliyaRef(day('2026-12-05')), 'Genesis 40:1-40:23');
check('Feb 21 2027 Ki Tisa 1',    getChumashAliyaRef(day('2027-02-21')), 'Exodus 30:11-31:17');
check('Mar 22 2027 Tzav 2',       getChumashAliyaRef(day('2027-03-22')), 'Leviticus 6:12-7:10');
check('Jun 17 2027 Nasso 5',      getChumashAliyaRef(day('2027-06-17')), 'Numbers 7:1-7:41');
check('Sep 7 2027  Ki Teitzei 3', getChumashAliyaRef(day('2027-09-07')), 'Deuteronomy 22:8-23:7');

console.log('Chabad.org verified holiday weeks:');
check('Sep 8 2026  Rosh Hashana week → Haazinu 3',   getChumashAliyaRef(day('2026-09-08')), 'Deuteronomy 32:13-32:18');
check('Sep 22 2026 after Yom Kippur → Vezos 3',      getChumashAliyaRef(day('2026-09-22')), 'Deuteronomy 33:13-33:17');
check('Sep 29 2026 Sukkos week → Vezos 3',           getChumashAliyaRef(day('2026-09-29')), 'Deuteronomy 33:13-33:17');
check('Apr 20 2027 Pesach week → Acharei 3',         getChumashAliyaRef(day('2027-04-20')), 'Leviticus 16:25-16:34');
check('Oct 4 2026  Simchas Torah → all Vezos + Bereishis 1',
      getChumashAliyaRef(day('2026-10-04')), 'Deuteronomy 33:1-34:12|Genesis 1:1-2:3');
check('Oct 15 2025 Wednesday Simchas Torah → Vezos 4-7 + Bereishis 1-4',
      getChumashAliyaRef(day('2025-10-15')), 'Deuteronomy 33:18-34:12|Genesis 1:1-4:18');
check('Oct 5 2026  day after → Bereishis 2',         getChumashAliyaRef(day('2026-10-05')), 'Genesis 2:4-2:19');
check('label on Sukkos week', getChumashDayLabel(day('2026-09-29')), 'Vezot Haberakhah · Aliya 3');

// ── Safety rules for every single day ───────────────────────────────────────
console.log('Every day Oct 2025 – Aug 2046:');
const ONE = '(Genesis|Exodus|Leviticus|Numbers|Deuteronomy) \\d+:\\d+-\\d+:\\d+';
const RANGE = new RegExp('^' + ONE + '(\\|' + ONE + ')*$'); // several refs joined by "|"

let missing = [], badFormat = [];
for (let d = day('2025-10-01'); d < day('2046-08-01'); d.setDate(d.getDate() + 1)) {
  const ref = getChumashAliyaRef(d);
  if (!ref) missing.push(d.toDateString());
  else if (!RANGE.test(ref)) badFormat.push(ref);
}
check('has a Chumash portion', missing.slice(0, 3).join(', '), '');
check('every ref is "Book ch:v-ch:v" (or several joined by |)', badFormat.slice(0, 3).join(', '), '');

// The parsha name is shared with other features (Likkutei Sichos, subtitles)
check('uses app spelling ("Bereishit")', getParshaForDate(day('2026-10-10')), 'Bereishit');

console.log(failed ? `\n${failed} FAILED` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
