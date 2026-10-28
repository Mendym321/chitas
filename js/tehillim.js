// Daily Tehillim — the monthly cycle (whole Tehillim every Hebrew month).
// Tested by tools/test-tehillim.mjs. Day 1 = 1–9 verified on Chabad.org.

// Hebrew day of month → Sefaria ref
const TEHILLIM_DAYS = {
  1:'Psalms.1-9',     2:'Psalms.10-17',    3:'Psalms.18-22',    4:'Psalms.23-28',
  5:'Psalms.29-34',   6:'Psalms.35-38',    7:'Psalms.39-43',    8:'Psalms.44-48',
  9:'Psalms.49-54',   10:'Psalms.55-59',   11:'Psalms.60-65',   12:'Psalms.66-68',
  13:'Psalms.69-71',  14:'Psalms.72-76',   15:'Psalms.77-78',   16:'Psalms.79-82',
  17:'Psalms.83-87',  18:'Psalms.88-89',   19:'Psalms.90-96',   20:'Psalms.97-103',
  21:'Psalms.104-105',22:'Psalms.106-107', 23:'Psalms.108-112', 24:'Psalms.113-118',
  25:'Psalms.119:1-96', 26:'Psalms.119:97-176', 27:'Psalms.120-134',
  28:'Psalms.135-139',29:'Psalms.140-144', 30:'Psalms.145-150',
};

// Uses the browser's built-in Hebrew calendar. Known issue: it is wrong for
// Hebrew year 5806 only (Nov 2045 – 2046) — checked against Hebcal for 1950–2150.
// Before then, replace this with a Hebcal-based date if the app is still around.
function _hebrewDayOfMonth(d) {
  return parseInt(new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' }).format(d), 10);
}

// → { day, ref, label }  e.g. { day: 1, ref: 'Psalms.1-9', label: 'Psalms 1–9' }
function getTehillimForDate(d) {
  const day = _hebrewDayOfMonth(d);
  const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);
  // A 29-day month: on the 29th, also say day 30's chapters to finish Tehillim
  const shortMonthEnd = day === 29 && _hebrewDayOfMonth(tomorrow) === 1;
  const ref = shortMonthEnd ? 'Psalms.140-150' : TEHILLIM_DAYS[Math.min(day, 30)];
  const label = ref.replace('Psalms.', 'Psalms ').replace('-', '–');
  return { day, ref, label };
}

// How many chapters a day's Tehillim is ('Psalms.10-17' → 8). The two days
// that split Psalm 119 count as half a chapter each.
function tehillimChapterCount(ref) {
  const m = String(ref).match(/^Psalms\.(\d+)(?::\d+)?-(\d+)(?::\d+)?$/);
  if (!m) return 0;
  if (ref.includes(':')) return 0.5;
  return +m[2] - +m[1] + 1;
}

// ── Personal Tehillim ─────────────────────────────────────────────────────────
// Each person says the chapter for the year of life they're in: on their Hebrew
// birthday they move to the next one (the Rebbe, born 11 Nissan 5662, says 125
// from 11 Nissan 5786). Worked out on the phone with the browser's Hebrew
// calendar, so it needs no internet and gives an answer at once.

// The months in their order in the year. A leap year has Adar I and Adar II;
// another year's single Adar takes Adar II's place.
const HEBREW_MONTHS = ['Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar I', 'Adar II', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul'];
// Any spelling (the browser's, Hebcal's, ours) → ours
const _HE_MONTH = { tishri: 'Tishrei', tishrei: 'Tishrei', heshvan: 'Cheshvan', cheshvan: 'Cheshvan', marcheshvan: 'Cheshvan', kislev: 'Kislev', tevet: 'Tevet', teves: 'Tevet',
  shevat: 'Shevat', "sh'vat": 'Shevat', shvat: 'Shevat', adar: 'Adar', 'adar i': 'Adar I', 'adar ii': 'Adar II', nisan: 'Nissan', nissan: 'Nissan',
  iyar: 'Iyar', iyyar: 'Iyar', sivan: 'Sivan', tamuz: 'Tammuz', tammuz: 'Tammuz', av: 'Av', elul: 'Elul' };
function hebrewMonthName(s) { return _HE_MONTH[String(s || '').trim().toLowerCase()] || null; }

function isHebrewLeapYear(y) { return (7 * y + 1) % 19 < 7; }

// The months of a year, as a birthday picker lists them
function hebrewMonthsOf(year) {
  const leap = isHebrewLeapYear(year);
  return HEBREW_MONTHS.flatMap(m => m === 'Adar I' ? [leap ? 'Adar I' : 'Adar'] : m === 'Adar II' && !leap ? [] : [m]);
}
// Months that always have 29 days (Cheshvan and Kislev vary, so they allow 30)
function hebrewMonthDays(month) {
  return ['Tevet', 'Adar', 'Adar II', 'Iyar', 'Tammuz', 'Elul'].includes(hebrewMonthName(month)) ? 29 : 30;
}

// A day on the phone's calendar → { day, month, year }, e.g. { day: 3, month: 'Kislev', year: 5750 }.
// (The browser's Hebrew calendar: see the note on 5806 above.)
function hebrewDateOf(d) {
  const p = {};
  new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return { day: parseInt(p.day, 10), month: hebrewMonthName(p.month), year: parseInt(p.year, 10) };
}

// Where a month falls in `year` (1 = Tishrei). A birthday in Adar of an
// ordinary year is kept in Adar II in a leap year; Adar I and Adar II are both
// plain Adar in an ordinary year.
function _hebrewMonthPlace(month, year) {
  const m = hebrewMonthName(month);
  if (m === 'Adar') return 7;
  if (m === 'Adar I') return isHebrewLeapYear(year) ? 6 : 7;
  return HEBREW_MONTHS.indexOf(m) + 1;
}

// The chapter a person born on { heDay, heMonth, heYear } says on day `d`;
// null if the birthday isn't complete or hasn't happened yet. A birthday on the
// 30th of a month that has 29 days that year moves on with the next month.
function personalTehillimChapter(birth, d) {
  const day = parseInt(birth?.heDay, 10), year = parseInt(birth?.heYear, 10), month = hebrewMonthName(birth?.heMonth);
  if (!day || !year || !month) return null;
  const now = hebrewDateOf(d);
  const here = _hebrewMonthPlace(now.month, now.year), theirs = _hebrewMonthPlace(month, now.year);
  const reached = here > theirs || (here === theirs && now.day >= day);
  const chapter = now.year - year + (reached ? 1 : 0);
  return chapter < 1 ? null : Math.min(chapter, 150);
}

// ── Elul ─────────────────────────────────────────────────────────────────────
// From 1 Elul to 9 Tishrei, three more chapters each day (1–3, 4–6 … 112–114),
// and on Yom Kippur the last 36 in four nines (Hayom Yom, 1 Elul). Elul always
// has 29 days, so the day fixes the chapters.
const ELUL_YK_TIMES = ['Before Kol Nidrei', 'Before going to sleep', 'After Musaf', 'After Ne\'ilah'];

// → null outside the season, else { label, groups: [{ when, from, to }] }
function elulTehillim(d) {
  const h = hebrewDateOf(d);
  const n = h.month === 'Elul' ? h.day : h.month === 'Tishrei' && h.day <= 9 ? 29 + h.day : 0;
  if (n) return { label: 'Elul ' + (3 * n - 2) + '–' + 3 * n, groups: [{ when: '', from: 3 * n - 2, to: 3 * n }] };
  if (h.month === 'Tishrei' && h.day === 10)
    return { label: 'Yom Kippur 115–150', groups: ELUL_YK_TIMES.map((when, i) => ({ when, from: 115 + 9 * i, to: 123 + 9 * i })) };
  return null;
}
// How many chapters that adds on day d (0 outside the season)
function elulTehillimCount(d) {
  const e = elulTehillim(d);
  return e ? e.groups.reduce((n, g) => n + g.to - g.from + 1, 0) : 0;
}
