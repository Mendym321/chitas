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
import { HDate, Sedra } from '@hebcal/core';
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
  shabbosim.push({ iso: iso(d), chag: res.chag, hebcal: res.parsha, name: res.chag ? null : appName(res.parsha) });
}

// A Shabbos that is Yom Tov has no weekly parsha. That week, Chitas learns the
// NEXT regular parsha (it is then learned again the following week).
// ⚠️ Holiday weeks are listed by the generator — verify them on Chabad.org.
const schedule = {};
const holidayWeeks = [];
for (let i = 0; i < shabbosim.length; i++) {
  const s = shabbosim[i];
  if (s.name) { schedule[s.iso] = s.name; continue; }
  const next = shabbosim.slice(i + 1).find(x => x.name);
  if (!next) continue;
  schedule[s.iso] = next.name;
  holidayWeeks.push(`${s.iso}  (${s.hebcal.join(' ')})  → ${next.name}`);
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

// ── 3. Write the file ───────────────────────────────────────────────────────
const out = `// ⚠️ GENERATED FILE — do not edit by hand.
// Source: tools/generate-chumash-data.mjs (Hebcal ${FIRST_HEBREW_YEAR}–${LAST_HEBREW_YEAR}, Diaspora)
// To update: cd tools && npm run generate

// Shabbos date → parsha learned that week (Sun–Shabbos)
const PARSHA_SCHEDULE = ${JSON.stringify(schedule)};

// Parsha → 7 aliyos (index 0 = Sunday … index 6 = Shabbos)
const PARSHA_ALIYOT = ${JSON.stringify(aliyot, null, 1)};
`;
writeFileSync(new URL('../js/chumash-data.js', import.meta.url), out);

console.log(`Wrote js/chumash-data.js: ${Object.keys(schedule).length} weeks, ${Object.keys(aliyot).length} parshiyos`);
console.log(`\nHoliday weeks (learn next parsha) — verify on Chabad.org:\n  ` + holidayWeeks.slice(0, 12).join('\n  '));
