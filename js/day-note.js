// What kind of day it is, in a few words, for the line under the greeting on
// Today: Shabbos, Erev Shabbos, Rosh Chodesh, Yom Tov, the Chabad dates, the
// Omer, and the week's parsha. Uses the phone's own Hebrew calendar (Intl), so
// it needs no network. Diaspora Yom Tov.
// Tested by tools/test-day-note.mjs.

function _hebDay(d) {
  const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long' }).formatToParts(d);
  return { m: parts.find(p => p.type === 'month').value, n: +parts.find(p => p.type === 'day').value };
}
const _shiftDay = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Month names as Chabad spells them
const _HEB_MONTH = { Tishri: 'Tishrei', Heshvan: 'Cheshvan', Tevet: 'Teves', Shevat: 'Shvat', Nisan: 'Nissan', Tamuz: 'Tammuz' };
const _hebMonth = m => _HEB_MONTH[m] || m;

// Fixed dates, keyed "<Intl month> <day>"
const _DAY_OCCASIONS = {
  'Tishri 1': 'Rosh Hashanah', 'Tishri 2': 'Rosh Hashanah',
  'Tishri 9': 'Erev Yom Kippur', 'Tishri 10': 'Yom Kippur',
  'Tishri 14': 'Erev Sukkos', 'Tishri 15': 'Sukkos', 'Tishri 16': 'Sukkos',
  'Tishri 17': 'Chol Hamoed Sukkos', 'Tishri 18': 'Chol Hamoed Sukkos', 'Tishri 19': 'Chol Hamoed Sukkos', 'Tishri 20': 'Chol Hamoed Sukkos',
  'Tishri 21': 'Hoshana Rabbah', 'Tishri 22': 'Shemini Atzeres', 'Tishri 23': 'Simchas Torah',
  'Kislev 19': 'Yud-Tes Kislev, Rosh Hashanah of Chassidus',
  'Shevat 10': 'Yud Shvat', 'Shevat 15': "Tu B'Shvat",
  'Adar I 14': 'Purim Katan',
  'Adar 14': 'Purim', 'Adar II 14': 'Purim', 'Adar 15': 'Shushan Purim', 'Adar II 15': 'Shushan Purim',
  'Nisan 11': "Yud-Aleph Nissan, the Rebbe's birthday",
  'Nisan 14': 'Erev Pesach', 'Nisan 15': 'Pesach', 'Nisan 16': 'Pesach',
  'Nisan 17': 'Chol Hamoed Pesach', 'Nisan 18': 'Chol Hamoed Pesach', 'Nisan 19': 'Chol Hamoed Pesach', 'Nisan 20': 'Chol Hamoed Pesach',
  'Nisan 21': 'Pesach', 'Nisan 22': 'Acharon shel Pesach',
  'Iyar 14': 'Pesach Sheni', 'Iyar 18': "Lag BaOmer",
  'Sivan 5': 'Erev Shavuos', 'Sivan 6': 'Shavuos', 'Sivan 7': 'Shavuos',
  'Tamuz 3': 'Gimmel Tammuz', 'Tamuz 12': 'Yud-Beis Tammuz', 'Tamuz 13': 'Yud-Gimmel Tammuz',
  'Av 15': "Tu B'Av", 'Av 20': 'Chof Av',
  'Elul 18': 'Chai Elul', 'Elul 29': 'Erev Rosh Hashanah',
};
// Fasts: on Shabbos they move to Sunday (Taanis Esther moves back to Thursday)
const _FASTS = { 'Tishri 3': 'Tzom Gedaliah', 'Tevet 10': "Asarah B'Teves", 'Tamuz 17': 'Shivah Asar B\'Tammuz', 'Av 9': "Tishah B'Av" };

function _fastOn(d) {
  const k = h => h.m + ' ' + h.n;
  if (d.getDay() === 6) return null;
  const today = _hebDay(d);
  if (d.getDay() === 0) { const y = _hebDay(_shiftDay(d, -1)); if (_FASTS[k(y)]) return _FASTS[k(y)]; }
  if (_FASTS[k(today)]) return _FASTS[k(today)];
  // Taanis Esther: 13 Adar (Adar II in a leap year), or the Thursday before when that's Shabbos
  const esther = h => (h.m === 'Adar' || h.m === 'Adar II') && h.n === 13;
  if (esther(today) && d.getDay() !== 6) return 'Taanis Esther';
  if (d.getDay() === 4 && esther(_hebDay(_shiftDay(d, 2)))) return 'Taanis Esther';
  return null;
}

// Day of the Omer (1-49), or 0
function omerDay(d) {
  for (let i = 0; i < 49; i++) {
    const h = _hebDay(_shiftDay(d, -i));
    if (h.m === 'Nisan' && h.n === 16) return i + 1;
  }
  return 0;
}

// Chanukah: day 1-8, or 0
function _chanukahDay(d) {
  for (let i = 0; i < 8; i++) {
    const h = _hebDay(_shiftDay(d, -i));
    if (h.m === 'Kislev' && h.n === 25) return i + 1;
  }
  return 0;
}

const _ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

// The week's parsha as Chabad spells it ("Lech Lecha", "Acharei-Kedoshim")
const _PARSHA_SPELLING = {
  Bereishit: 'Bereishis', 'Chayei Sara': 'Chayei Sarah', Toldot: 'Toldos', Shemot: 'Shemos', Vaera: "Va'eira",
  Yitro: 'Yisro', 'Ki Tisa': 'Ki Sisa', Shemini: 'Shmini', 'Acharei Mot': 'Acharei', Bechukotai: 'Bechukosai',
  Nasso: 'Naso', "Beha'alotcha": "Beha'aloscha", Shelach: "Shlach", Chukat: 'Chukas', Matot: 'Matos',
  Vaetchanan: "Va'eschanan", 'Ki Teitzei': 'Ki Seitzei', 'Ki Tavo': 'Ki Savo', 'Vezot Haberakhah': "V'zos Habrachah",
};
function parshaSpelling(name) {
  return name ? name.split('-').map(p => _PARSHA_SPELLING[p] || p).join('-') : null;
}

// The parts of the line, most important first, e.g.
//   ['Erev Shabbos', 'Parshas Lech Lecha']
//   ['Rosh Chodesh Kislev', 'Parshas Toldos']
//   ['Shabbos', 'Chol Hamoed Pesach', 'Day 4 of the Omer']
// parsha: the week's parsha (Sefaria spelling, from getParshaForDate), or null
function dayNote(d, parsha) {
  const h = _hebDay(d), key = h.m + ' ' + h.n;
  const parts = [];
  const dow = d.getDay();
  if (dow === 6) parts.push('Shabbos');
  else if (dow === 5) parts.push('Erev Shabbos');

  if (h.n === 30) parts.push('Rosh Chodesh ' + _hebMonth(_hebDay(_shiftDay(d, 1)).m));
  else if (h.n === 1 && h.m !== 'Tishri') parts.push('Rosh Chodesh ' + _hebMonth(h.m));

  const ch = _chanukahDay(d);
  if (ch) parts.push(ch === 8 ? 'Zos Chanukah' : 'Chanukah, the ' + _ORD[ch] + ' light');
  const occ = _DAY_OCCASIONS[key];
  if (occ) parts.push(occ);
  const fast = _fastOn(d);
  if (fast) parts.push(fast);
  const omer = omerDay(d);
  if (omer) parts.push('Day ' + omer + ' of the Omer');

  // The parsha, unless the day is already full or it's Yom Tov itself
  const yomTov = typeof isRestDay === 'function' && isRestDay(d) && dow !== 6;
  if (parsha && parts.length < 2 && !yomTov) parts.push('Parshas ' + parshaSpelling(parsha));
  return parts;
}
