// Sefer HaMitzvos: the daily mitzvos, a 339-day cycle that runs with the
// 3-chapter Rambam. It began on Sunday 29 April 1984 (27 Nissan 5744) and has
// no skipped days. The days are in js/sefer-hamitzvos-data.js (from Hebcal);
// tools/test-sefer-hamitzvos.mjs checks every day against Hebcal.

// The day of the cycle (1–339) for the date d is on the phone
function shmDay(d) {
  const days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1984, 3, 29)) / 864e5);
  return ((days % 339) + 339) % 339 + 1;
}

// Days where some printed schedules swap two negative mitzvos (as Hebcal notes)
const SHM_NOTES = { 140: [148, 149, 161], 161: [149, 148, 140], 258: [296, 295, 259], 259: [295, 296, 258] };

// Names for the days that aren't mitzvos
const SHM_OTHER = {
  'Maimonides’ Introduction to Sefer Hamitzvot': ['The Rambam\'s introduction', 'הקדמת הרמב"ם'],
  'Principle 1-3': ['Principles 1–3', 'שרשים א–ג'], 'Principle 4-9': ['Principles 4–9', 'שרשים ד–ט'], 'Principle 10-14': ['Principles 10–14', 'שרשים י–יד'],
  'Nusach HaTefila': ['The text of the prayers', 'נוסח התפילה'], 'Order of Prayer': ['The order of prayer', 'סדר התפילה'],
  'Text of the Haggadah': ['The text of the Haggadah', 'נוסח ההגדה'],
  'Laws of Megillah and Chanukah Chapters 1-2': ['Laws of Megillah and Chanukah, chapters 1–2', 'הלכות מגילה וחנוכה פרקים א–ב'],
  'Laws of Megillah and Chanukah Chapters 3-4': ['Laws of Megillah and Chanukah, chapters 3–4', 'הלכות מגילה וחנוכה פרקים ג–ד'],
};

// → { day, items: [{ id: 'N251', positive: false, n: 251, en: 'Negative Commandment 251' } | { other, en, he }], note }
function shmReading(d) {
  const day = shmDay(d);
  const items = SHM_CYCLE[day - 1].split(', ').map(p => {
    const m = p.match(/^([PN])(\d+)$/);
    if (m) return { id: p, positive: m[1] === 'P', n: +m[2], en: (m[1] === 'P' ? 'Positive' : 'Negative') + ' Commandment ' + m[2] };
    const [en, he] = SHM_OTHER[p] || [p, ''];
    return { other: p, en, he };
  });
  const nt = SHM_NOTES[day];
  const note = nt ? 'Some printed schedules have Negative Commandment ' + nt[0] + ' today instead of ' + nt[1] + ' (and ' + nt[1] + ' on day ' + nt[2] + ').' : '';
  return { day, items, note };
}

// For the Today tile: "Negative Commandment 251", or "3 mitzvos"
function shmSubtitle(d) {
  const { items } = shmReading(d);
  return items.length === 1 ? items[0].en : items.every(i => i.id) ? items.length + ' mitzvos' : items.map(i => i.en).join(', ');
}
