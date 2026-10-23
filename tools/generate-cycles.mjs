/**
 * Generates the schedules behind "More learning":
 *  - ../data/cycles.json: each day's Daf Yomi, Nach Yomi and Kitzur Shulchan
 *    Aruch Yomi, as Sefaria refs, from START to END
 *  - ../data/likkutei-torah.json: the maamarim of Likkutei Torah / Torah Ohr
 *    for each parsha (the app's parsha names), with their opening words and
 *    about how long they take
 * Sources: @hebcal/learning (the schedules), tools/data/kitzur-lengths.json and
 * tools/data/chassidus-index.json (from Sefaria's public export).
 * Run:  cd tools && node generate-cycles.mjs   (again before END comes)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { HDate } from '@hebcal/core';
import { DafYomi, DafYomiEvent, NachYomiIndex, kitzurShulchanAruch } from '@hebcal/learning';
import AMUDIM from './node_modules/@hebcal/learning/dist/esm/amudim.json.js';

const START = new Date(2026, 8, 1), END = new Date(2030, 8, 30);
const seifim = JSON.parse(readFileSync(new URL('./data/kitzur-lengths.json', import.meta.url))).seifim;
const index = JSON.parse(readFileSync(new URL('./data/chassidus-index.json', import.meta.url))).books;

// Kinnim and Middos have no Gemara: their pages in the Vilna Shas are the
// Mishnah (with commentaries), and Daf Yomi learns those pages. Which mishnayos
// are on each daf, read off the Vilna pages (Me'ilah 22 to Middos 37). Sefaria
// gives whole mishnayos, so where a daf starts or ends inside one, the note says where.
// Several refs are joined by "|".
const NO_GEMARA = 'This masechta has no Gemara: the daf is its Mishnah.';
const MISHNAH_DAYS = {
  'Meilah 22': { ref: 'Meilah 22a|Mishnah Kinnim 1:1-4', note: 'Me\'ilah ends on 22a, and Kinnim begins: all of its first perek is on this daf.' },
  'Kinnim 23': { ref: 'Mishnah Kinnim 2:1-3:1', note: NO_GEMARA + ' The daf ends partway through 3:1, before "שתים לזו ושתים לזו".' },
  'Kinnim 24': { ref: 'Mishnah Kinnim 3:1-6', note: NO_GEMARA + ' The daf starts partway through 3:1, at "שתים לזו ושתים לזו", and ends partway through 3:6, before "בן עזאי אומר".' },
  'Kinnim 25': { ref: 'Mishnah Kinnim 3:6', note: NO_GEMARA + ' The daf starts partway through 3:6, at "בן עזאי אומר", and finishes Kinnim.' },
  'Midot 34': { ref: 'Mishnah Middot 1:1-2:2', note: NO_GEMARA },
  'Midot 35': { ref: 'Mishnah Middot 2:3-3:1', note: NO_GEMARA },
  'Midot 36': { ref: 'Mishnah Middot 3:2-4:2', note: NO_GEMARA },
  'Midot 37': { ref: 'Mishnah Middot 4:3-5:4', note: NO_GEMARA },
};

// [the daf as Hebcal names it ("Bechorot 35"), the Sefaria ref of both sides ("Bekhorot 35a-35b"), a note?].
// Hebcal's link gives Sefaria's name for the masechta (and Shekalim's Yerushalmi halachos).
function daf(d) {
  const y = new DafYomi(d), name = y.getName(), blatt = y.getBlatt();
  const label = name + ' ' + blatt;
  if (MISHNAH_DAYS[label]) return [label, MISHNAH_DAYS[label].ref, MISHNAH_DAYS[label].note];
  if (name === 'Kinnim' || name === 'Midot') throw new Error('No mishnayos for ' + label);
  const url = new DafYomiEvent(new HDate(d)).url();
  if (!url.includes('sefaria.org/')) throw new Error('No Sefaria link for ' + label);
  const ref = decodeURIComponent(url.split('sefaria.org/')[1].split('?')[0]).replace(/_/g, ' ');
  const m = ref.match(/^(.+)\.(\d+)a$/);
  if (!m) return [label, ref];                          // Shekalim: already a range of halachos
  // A masechta with an odd number of amudim ends on an amud aleph (Berachos 64a)
  const amudim = AMUDIM[name], last = 1 + Math.ceil(amudim / 2);
  const onlyA = +m[2] === last && amudim % 2 === 1;
  return [label, m[1] + ' ' + m[2] + 'a' + (onlyA ? '' : '-' + m[2] + 'b')];
}

// Typos in Hebcal's Adar II table (the days around each show what's meant)
const ADAR_II_FIXES = {
  '{"b":"11:1","e":"17:7"}': { b: '17:1', e: '17:7' },
  '{"b":"17","e":"8:18"}': { b: '17:8', e: '18:2' },
  '{"b":"50:1","e":"10"}': { b: '50:1', e: '50:10' },
  '{"b":"55:2","e":"56"}': { b: '55:2', e: '56:4' },
};
// "10:20" + "10:E" → "10:20-26"; "11:1" + "11:11" → "11:1-11"; "6:1" + "7:2" → "6:1-7:2"
function kitzur(hd) {
  let r = kitzurShulchanAruch(hd, 'B');   // Adar II of a leap year: brachos and tefillah, from the Kitzur itself
  if (!r) return null;
  r = ADAR_II_FIXES[JSON.stringify(r)] || r;
  if (r.b === 'Klalim') return 'Klalim';    // 15 Elul, between the end of the book and siman 128: not on Sefaria
  const [bs, bf] = r.b.split(':').map(Number);
  if (!bs || !bf) throw new Error('Odd Kitzur reading ' + JSON.stringify(r) + ' on ' + hd);
  if (!r.e) return bs + ':' + bf;
  let [es, ef] = r.e.split(':');
  es = +es;
  ef = ef === 'E' ? seifim[es - 1] : +ef;
  if (!es || !ef) throw new Error('Odd Kitzur reading ' + JSON.stringify(r) + ' on ' + hd);
  return es === bs ? bs + ':' + bf + '-' + ef : bs + ':' + bf + '-' + es + ':' + ef;
}

const nach = new NachYomiIndex();
const days = [];
for (let d = new Date(START); d <= END; d.setDate(d.getDate() + 1)) {
  const hd = new HDate(d), n = nach.lookup(d);
  const [label, ref, note] = daf(d);
  days.push([label, ref, n.k + ' ' + n.v, kitzur(hd), ...(note ? [note] : [])]);   // a note only on the odd days
}
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
writeFileSync(new URL('../data/cycles.json', import.meta.url),
  JSON.stringify({ start: iso(START), end: iso(END), days }));

// The week's maamarim: the app's parsha name → the section of Torah Ohr or Likkutei Torah
const TO = { Bereishit: 'Bereshit', Noach: 'Noach', 'Lech Lecha': 'Lech Lecha', Vayera: 'Vayera', 'Chayei Sara': 'Chayei Sara',
  Toldot: 'Toldot', Vayetzei: 'Vayetzei', Vayishlach: 'Vayishlach', Vayeshev: 'Vayeshev', Miketz: 'Miketz', Vayigash: 'Vayigash',
  Vayechi: 'Vayechi', Shemot: 'Shemot', Vaera: 'Vaera', Bo: 'Bo', Beshalach: 'Beshalach', Yitro: 'Yitro', Mishpatim: 'Mishpatim',
  Terumah: 'Terumah', Tetzaveh: 'Tetzaveh', 'Ki Tisa': 'Ki Tisa', Vayakhel: 'Vayakhel' };
const LT = { Beshalach: 'Beshalach', Pekudei: 'Pekudei', Vayikra: 'Vayikra', Tzav: 'Tzav', Shemini: 'Shmini', Tazria: 'Tazria',
  Metzora: 'Metzora', 'Acharei Mot': 'Achrei Mot', Kedoshim: 'Kedoshim', Emor: 'Emor', Behar: 'Behar', Bechukotai: 'Bechukotai',
  Bamidbar: 'Bamidbar', Nasso: 'Nasso', "Beha'alotcha": "Beha'alotcha", Shelach: "Sh'lach", Korach: 'Korach', Chukat: 'Chukat',
  Balak: 'Balak', Pinchas: 'Pinchas', Matot: 'Matot', Masei: 'Masei', Devarim: 'Devarim', Vaetchanan: 'Vaetchanan', Eikev: 'Eikev',
  "Re'eh": "Re'eh", 'Ki Teitzei': 'Ki Teitzei', 'Ki Tavo': 'Ki Tavo', Nitzavim: 'Nitzavim',
  Vayeilech: 'Shabbat Shuvah',            // read on Shabbos Shuvah when it stands alone
  Haazinu: "Ha'Azinu", 'Vezot Haberakhah': "V'Zot HaBerachah" };
// Shoftim has no section of its own in Likkutei Torah
const ALL = [...new Set([...Object.keys(TO), ...Object.keys(LT), 'Shoftim'])];
const COMBINED = ['Vayakhel-Pekudei', 'Tazria-Metzora', 'Acharei Mot-Kedoshim', 'Behar-Bechukotai', 'Chukat-Balak', 'Matot-Masei', 'Nitzavim-Vayeilech'];
const pieces = (book, node) => (index[book][node] || []).map((m, i) => ({ r: book + ', ' + node + ' ' + (i + 1), t: m.t, m: Math.max(5, Math.round(m.w / 100 / 5) * 5) }));
const forParsha = p => [...(TO[p] ? pieces('Torah Ohr', TO[p]) : []), ...(LT[p] ? pieces('Likkutei Torah', LT[p]) : [])];
const weeks = {};
for (const p of ALL) weeks[p] = forParsha(p);
for (const c of COMBINED) {
  const parts = c === 'Acharei Mot-Kedoshim' ? ['Acharei Mot', 'Kedoshim'] : c.split('-');
  // Nitzavim-Vayeilech comes before Rosh Hashanah: Shabbos Shuvah is the next week's
  weeks[c] = c === 'Nitzavim-Vayeilech' ? forParsha('Nitzavim') : parts.flatMap(forParsha);
}
for (const [node, list] of Object.entries(index['Likkutei Torah']))
  if (!Object.values(LT).includes(node) && !['Rosh Hashanah', 'Yom Kippur', 'Sukkot', 'Shemini Atzeret', 'Shir HaShirim'].includes(node)) throw new Error('Unmapped section ' + node);
writeFileSync(new URL('../data/likkutei-torah.json', import.meta.url), JSON.stringify(weeks));

console.log('days', days.length, 'from', iso(START), 'to', iso(END));
console.log('parshiyos', Object.keys(weeks).length, 'empty:', Object.entries(weeks).filter(([, v]) => !v.length).map(([k]) => k));
