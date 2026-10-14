/**
 * Generates ../js/chumash-data.js — which parsha is learned each week, and
 * the 7 aliyos of every parsha — from the Hebcal libraries.
 *
 * Why generated instead of typed by hand: the old hand-typed table had 41
 * wrong aliyah ranges and ran out in Sept 2027. Hebcal matched Chabad.org on
 * every date we spot-checked (see test-chumash.mjs).
 *
 * Run:  cd tools && npm install && npm run generate
 */
import { writeFileSync } from 'node:fs';
import { HDate, Sedra, months } from '@hebcal/core';
import { getLeyningForParsha } from '@hebcal/leyning';

const FIRST_HEBREW_YEAR = 5786; // Sept 2025
const LAST_HEBREW_YEAR  = 5806; // through Sept 2046

// Hebcal spelling → the spelling the rest of the app already uses
// (getParshaForDate's result is also used by Likkutei Sichos, subtitles, etc.)
const APP_NAME = {
  'Bereshit': 'Bereishit',
  'Lech-Lecha': 'Lech Lecha',
  'Shmini': 'Shemini',
  'Achrei Mot': 'Acharei Mot',
  "Sh'lach": 'Shelach',
  "Ha'azinu": 'Haazinu',
};
const appName = hebcalParts => hebcalParts.map(p => APP_NAME[p] || p).join('-');

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// ── 1. Every Shabbos → parsha (Diaspora) ────────────────────────────────────
const start = new HDate(1, 'Tishrei', FIRST_HEBREW_YEAR).onOrAfter(6).greg();
const end   = new HDate(1, 'Tishrei', LAST_HEBREW_YEAR + 1).greg();

const shabbosim = [];
for (let d = new Date(start); d < end; d.setDate(d.getDate() + 7)) {
  const hd = new HDate(new Date(d));
  const res = new Sedra(hd.getFullYear(), false).lookup(hd);
  shabbosim.push({ iso: iso(d), hdate: hd, hebcal: res.parsha, name: res.chag ? null : appName(res.parsha) });
}

// A Shabbos that is Yom Tov has no weekly parsha. Chabad custom (verified on
// Chabad.org, Oct 2026):
//  • Shabbos is Yom Kippur / Sukkos / Shemini Atzeres → learn VEZOS HABRACHA
//  • Any other Yom Tov (Rosh Hashana, Pesach, Shavuos) → learn the NEXT parsha
//    (it is then learned again the following week)
const VEZOS = 'Vezot Haberakhah';
const schedule = {};
const holidayWeeks = [];
for (let i = 0; i < shabbosim.length; i++) {
  const s = shabbosim[i];
  if (s.name) { schedule[s.iso] = s.name; continue; }
  const isTishreiAfterRoshHashana = s.hdate.getMonth() === months.TISHREI && s.hdate.getDate() >= 10;
  const name = isTishreiAfterRoshHashana ? VEZOS : shabbosim.slice(i + 1).find(x => x.name)?.name;
  if (!name) continue;
  schedule[s.iso] = name;
  holidayWeeks.push(`${s.iso}  (${s.hebcal.join(' ')})  → ${name}`);
}

// ── 2. Every parsha (single + combined) → 7 aliyah refs ─────────────────────
const aliyot = {};
for (const parts of new Set(shabbosim.filter(s => s.name).map(s => s.hebcal.join('|')))) {
  const hebcalParts = parts.split('|');
  const leyning = getLeyningForParsha(hebcalParts.join('-'));
  aliyot[appName(hebcalParts)] = [1, 2, 3, 4, 5, 6, 7].map(n => {
    const a = leyning.fullkriyah[String(n)];
    return `${a.k} ${a.b}-${a.e}`; // e.g. "Genesis 1:1-2:3"
  });
}

aliyot[VEZOS] = [1, 2, 3, 4, 5, 6, 7].map(n => {
  const a = getLeyningForParsha(VEZOS).fullkriyah[String(n)];
  return `${a.k} ${a.b}-${a.e}`;
});

// ── 3. Simchas Torah (Diaspora, 23 Tishrei) — day-by-day exceptions ─────────
// On Simchas Torah: finish ALL of Vezos Habracha, then Bereishis from the
// start through that weekday's aliyah (verified for a Sunday on Chabad.org).
// Earlier days of that same week are still Vezos Habracha.
// Multiple refs are joined with "|".
const dayOverrides = {};
for (let y = FIRST_HEBREW_YEAR; y <= LAST_HEBREW_YEAR; y++) {
  const st = new HDate(23, months.TISHREI, y).greg();
  const dow = st.getDay();
  const bereishisEnd = aliyot.Bereishit[dow].split('-')[1]; // e.g. "2:3"
  dayOverrides[iso(st)] = 'Deuteronomy 33:1-34:12|Genesis 1:1-' + bereishisEnd;
  for (let back = 1; back <= dow; back++) {
    const d = new Date(st); d.setDate(st.getDate() - back);
    dayOverrides[iso(d)] = aliyot[VEZOS][d.getDay()];
  }
}

// ── 4. Write the file ───────────────────────────────────────────────────────
const out = `// ⚠️ GENERATED FILE — do not edit by hand.
// Source: tools/generate-chumash-data.mjs (Hebcal ${FIRST_HEBREW_YEAR}–${LAST_HEBREW_YEAR}, Diaspora)
// To update: cd tools && npm run generate

// Shabbos date → parsha learned that week (Sun–Shabbos)
const PARSHA_SCHEDULE = ${JSON.stringify(schedule)};

// Parsha → 7 aliyos (index 0 = Sunday … index 6 = Shabbos)
const PARSHA_ALIYOT = ${JSON.stringify(aliyot, null, 1)};

// Specific days that don't follow the weekly pattern (Simchas Torah week)
const CHUMASH_DAY_OVERRIDES = ${JSON.stringify(dayOverrides, null, 1)};
`;
writeFileSync(new URL('../js/chumash-data.js', import.meta.url), out);

console.log(`Wrote js/chumash-data.js: ${Object.keys(schedule).length} weeks, ${Object.keys(aliyot).length} parshiyos`);
console.log(`\nHoliday weeks:\n  ` + holidayWeeks.slice(0, 12).join('\n  '));
console.log(`\nSimchas Torah overrides (first years):`);
Object.entries(dayOverrides).slice(0, 8).forEach(([d, r]) => console.log('  ' + d + '  ' + r));
