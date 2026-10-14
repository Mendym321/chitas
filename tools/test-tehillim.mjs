/**
 * Tests for the daily Tehillim cycle. Loads the SAME js/tehillim.js the app uses.
 * Run:  cd tools && npm test
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { HDate } from '@hebcal/core';

const ctx = { Intl, Date };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/tehillim.js', import.meta.url), 'utf8'), ctx);
const getTehillimForDate = vm.runInContext('getTehillimForDate', ctx);

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

console.log(failed ? `\n${failed} FAILED` : '\nAll Tehillim tests passed');
process.exit(failed ? 1 : 0);
