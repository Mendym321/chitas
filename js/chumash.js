// Chumash schedule — which parsha and aliyah to learn on a given day.
// Data (PARSHA_SCHEDULE, PARSHA_ALIYOT, CHUMASH_DAY_OVERRIDES) comes from
// js/chumash-data.js, which must be loaded first. Tested by tools/test-chumash.mjs.

function _chumashISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// The parsha of the WEEK (Sun–Shabbos). Also used by Likkutei Sichos etc.
function getParshaForDate(d) {
  // Find the upcoming Shabbos (Saturday) — Chitas reads toward next Shabbos
  const shabbos = new Date(d);
  shabbos.setDate(d.getDate() + (6 - d.getDay()));
  return PARSHA_SCHEDULE[_chumashISO(shabbos)] || null;
}

// The aliyah ref(s) to learn on this day: Sunday = aliyah 1 … Shabbos = aliyah 7.
// May contain several refs joined by "|" (e.g. Simchas Torah).
function getChumashAliyaRef(d) {
  const override = CHUMASH_DAY_OVERRIDES[_chumashISO(d)];
  if (override) return override;
  const parsha = getParshaForDate(d);
  const aliyot = parsha && PARSHA_ALIYOT[parsha];
  return (aliyot && aliyot[d.getDay()]) || null;
}

// Short label for the home screen, e.g. "Noach · Aliya 4"
function getChumashDayLabel(d) {
  const ref = getChumashAliyaRef(d);
  if (ref && ref.includes('|')) return 'Vezot Haberakhah & Bereishit';
  const isVezos = /^Deuteronomy 3[34]:/.test(ref || ''); // Vezos Habracha = Deut. 33–34
  const parsha = isVezos ? 'Vezot Haberakhah' : getParshaForDate(d);
  const aliya = d.getDay() === 6 ? 'Shabbos' : 'Aliya ' + (d.getDay() + 1);
  return parsha ? parsha + ' · ' + aliya : aliya;
}

// The day's place in the parsha, for the reader's heading and its guide line:
// { parsha: "Vayera", aliyah: 3 } (Shabbos = 7). null on days with no single
// parsha (Simchas Torah's Vezos Habracha + Bereishis).
function getChumashDay(d) {
  const ref = getChumashAliyaRef(d);
  if (!ref || ref.includes('|')) return null;
  const parsha = /^Deuteronomy 3[34]:/.test(ref) ? 'Vezot Haberakhah' : getParshaForDate(d);
  return parsha ? { parsha, aliyah: d.getDay() + 1, ref } : null;
}
