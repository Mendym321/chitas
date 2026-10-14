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
