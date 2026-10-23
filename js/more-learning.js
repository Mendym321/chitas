// "More learning": the daily and weekly learning beyond Chitas. Which piece
// each cycle has on a day, named the way the app names things. The schedules
// are in data/cycles.json and data/likkutei-torah.json (made by
// tools/generate-cycles.mjs); these functions only read them.

// Hebcal's names → the app's (Ashkenazi) spelling
const MASECHTOS = {
  Berachot: 'Berachos', Shabbat: 'Shabbos', Eruvin: 'Eruvin', Pesachim: 'Pesachim', Shekalim: 'Shekalim',
  Yoma: 'Yoma', Sukkah: 'Sukkah', Beitzah: 'Beitzah', 'Rosh Hashana': 'Rosh Hashanah', Taanit: 'Taanis',
  Megillah: 'Megillah', 'Moed Katan': 'Moed Katan', Chagigah: 'Chagigah', Yevamot: 'Yevamos', Ketubot: 'Kesubos',
  Nedarim: 'Nedarim', Nazir: 'Nazir', Sotah: 'Sotah', Gitin: 'Gittin', Kiddushin: 'Kiddushin',
  'Baba Kamma': 'Bava Kamma', 'Baba Metzia': 'Bava Metzia', 'Baba Batra': 'Bava Basra', Sanhedrin: 'Sanhedrin',
  Makkot: 'Makkos', Shevuot: 'Shevuos', 'Avodah Zarah': 'Avodah Zarah', Horayot: 'Horayos', Zevachim: 'Zevachim',
  Menachot: 'Menachos', Chullin: 'Chullin', Bechorot: 'Bechoros', Arachin: 'Arachin', Temurah: 'Temurah',
  Keritot: 'Kerisos', Meilah: "Me'ilah", Kinnim: 'Kinnim', Tamid: 'Tamid', Midot: 'Middos', Niddah: 'Niddah',
};
const NACH_BOOKS = {
  Joshua: 'Yehoshua', Judges: 'Shoftim', 'I Samuel': 'Shmuel I', 'II Samuel': 'Shmuel II', 'I Kings': 'Melachim I',
  'II Kings': 'Melachim II', Isaiah: 'Yeshayahu', Jeremiah: 'Yirmiyahu', Ezekiel: 'Yechezkel', Hosea: 'Hoshea',
  Joel: 'Yoel', Amos: 'Amos', Obadiah: 'Ovadiah', Jonah: 'Yonah', Micah: 'Michah', Nahum: 'Nachum', Nachum: 'Nachum',
  Habakkuk: 'Chavakuk', Zephaniah: 'Tzefaniah', Haggai: 'Chaggai', Zechariah: 'Zechariah', Malachi: 'Malachi',
  Psalms: 'Tehillim', Proverbs: 'Mishlei', Job: 'Iyov', 'Song of Songs': 'Shir HaShirim', Ruth: 'Rus',
  Lamentations: 'Eichah', Ecclesiastes: 'Koheles', Esther: 'Esther', Daniel: 'Daniel', Ezra: 'Ezra',
  Nehemiah: 'Nechemiah', 'I Chronicles': 'Divrei HaYamim I', 'II Chronicles': 'Divrei HaYamim II',
};

const _lastSpace = s => { const i = s.lastIndexOf(' '); return [s.slice(0, i), s.slice(i + 1)]; };

// "Bechorot 35" → "Bechoros 35"
function dafLabel(hebcalName) {
  const [name, daf] = _lastSpace(hebcalName);
  return (MASECHTOS[name] || name) + ' ' + daf;
}
// "Jeremiah 41" → "Yirmiyahu 41"
function nachLabel(ref) {
  const [book, ch] = _lastSpace(ref);
  return (NACH_BOOKS[book] || book) + ' ' + ch;
}
// "10:20-26" → "Siman 10:20–26"; "25:1-26:2" → "Simanim 25:1–26:2"; "Klalim" → "Klalim"
function kitzurLabel(reading) {
  if (reading === 'Klalim') return 'Klalim';
  const [from, to] = reading.split('-');
  const two = to && to.includes(':') && to.split(':')[0] !== from.split(':')[0];
  return (two ? 'Simanim ' : 'Siman ') + from + (to ? '–' + to : '');
}

// The day's piece of each daily cycle: { daf, nach, kitzur }, each { label, ref, note? }
// (ref null when there's no text to show), or null outside the schedule's dates
function cycleDay(cycles, iso) {
  if (!cycles || iso < cycles.start || iso > cycles.end) return null;
  const n = Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(cycles.start + 'T12:00:00Z')) / 864e5);
  const row = cycles.days[n];
  if (!row) return null;
  const [dafName, dafRef, nachRef, kitzur, note] = row;
  return {
    // ref may be several, joined by "|" (Me'ilah 22 is also Kinnim's first perek)
    daf: { label: dafLabel(dafName), ref: dafRef, note: note || null },
    nach: { label: nachLabel(nachRef), ref: nachRef },
    kitzur: kitzur == null ? null
      : { label: kitzurLabel(kitzur), ref: kitzur === 'Klalim' ? null : 'Kitzur Shulchan Arukh ' + kitzur },
  };
}

// The Shabbos that ends the week a date is in (weeks run Sunday to Shabbos)
function weekShabbos(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + (6 - d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

// The week's maamarim for a parsha (the app's name, e.g. "Tazria-Metzora"):
// [{ ref, title, mins, book }]; which books they're from: "Torah Ohr", "Likkutei Torah", or both
function maamarimFor(weeks, parsha) {
  return ((weeks && weeks[parsha]) || []).map(m => ({ ref: m.r, title: m.t, mins: m.m, book: m.r.split(',')[0] }));
}
function maamarimBooks(list) {
  return [...new Set(list.map(m => m.book))].join(' and ');
}
