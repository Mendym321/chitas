// Chumash schedule — which parsha and aliyah to learn on a given day.
// Data (PARSHA_SCHEDULE, PARSHA_ALIYOT) comes from js/chumash-data.js,
// which must be loaded first. Tested by tools/test-chumash.mjs.

// Given any date, return the parsha name for that week's Chumash
function getParshaForDate(d) {
  // Find the upcoming Shabbos (Saturday) — Chitas reads toward next Shabbos
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const shabbos = new Date(d);
  shabbos.setDate(d.getDate() + (6 - dow));
  const iso = shabbos.getFullYear() + '-'
    + String(shabbos.getMonth()+1).padStart(2,'0') + '-'
    + String(shabbos.getDate()).padStart(2,'0');
  return PARSHA_SCHEDULE[iso] || null;
}

// Get the aliyah ref for a given date: Sunday = aliyah 1 … Shabbos = aliyah 7
function getChumashAliyaRef(d) {
  const parsha = getParshaForDate(d);
  if (!parsha) return null;
  const aliyot = PARSHA_ALIYOT[parsha];
  if (!aliyot) return null;
  return aliyot[d.getDay()] || null;
}
