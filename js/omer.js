// Sefiras HaOmer and Sotah. Tested by tools/test-omer.mjs.
// The Omer is counted from the night after the first day of Pesach: the night
// before 16 Nissan is night 1, the night before 5 Sivan night 49. Chabad learn
// Maseches Sotah through it: day 1 nothing, day 2 daf 2 … day 49 daf 49.
// Uses hebrewDateOf (js/tehillim.js): the phone's own Hebrew calendar.

const SEFIROS = ['Chesed', 'Gevurah', 'Tiferes', 'Netzach', 'Hod', 'Yesod', 'Malchus'];
const SEFIROS_HE = ['חֶסֶד', 'גְּבוּרָה', 'תִּפְאֶרֶת', 'נֶצַח', 'הוֹד', 'יְסוֹד', 'מַלְכוּת'];
const SEFIROS_SHEB = ["sheb'Chesed", 'shebiGevurah', "sheb'Tiferes", "sheb'Netzach", "sheb'Hod", 'shebiYesod', "sheb'Malchus"];
const SEFIROS_SHEB_HE = ['שֶׁבְּחֶסֶד', 'שֶׁבִּגְבוּרָה', 'שֶׁבְּתִפְאֶרֶת', 'שֶׁבְּנֶצַח', 'שֶׁבְּהוֹד', 'שֶׁבִּיסוֹד', 'שֶׁבְּמַלְכוּת'];

// The day of the Omer that day d is (1–49), or null outside it
function omerDay(d) {
  const h = hebrewDateOf(d);
  const n = h.month === 'Nissan' && h.day >= 16 ? h.day - 15 : h.month === 'Iyar' ? 15 + h.day : h.month === 'Sivan' && h.day <= 5 ? 44 + h.day : 0;
  return n || null;
}

// The daf of Sotah for Omer day n (day 1 has none)
function sotahDaf(n) { return n >= 2 && n <= 49 ? n : null; }

// Night n's count: { n, he, en, sefirah: { en, he }, line: { ana, sefirah, word, letter } }
// (the line is the siddur's, under the count: the word of Ana Bekoach, the
// sefirah, the word of Lamenatzeach and the letter of ישמחו for the night)
function omerCount(n) {
  if (!(n >= 1 && n <= 49)) return null;
  const inner = (n - 1) % 7, outer = Math.floor((n - 1) / 7);
  return { n, he: OMER_COUNT_HE[n - 1], en: OMER_COUNT_EN[n - 1], line: OMER_LINE[n - 1],
    sefirah: { en: SEFIROS[inner] + ' ' + SEFIROS_SHEB[outer], he: SEFIROS_HE[inner] + ' ' + SEFIROS_SHEB_HE[outer] } };
}

// What is said after counting, for night n, with the night's word marked
// (<mark>) in Lamenatzeach and Ana Bekoach, and its sefirah in Ribono shel Olam.
// Lamenatzeach: after its heading, its 49 words are the 49 nights (a maqaf
// joins two). Ana Bekoach: each line is a week, six words and then its initials.
function omerAfter(n) {
  if (!(n >= 1 && n <= 49)) return null;
  const A = OMER_AFTER_HE, mark = w => '<mark>' + w + '</mark>';
  const [head, body] = A.lamenatzeach.split(/:(.*)/s);
  let k = 0;
  const psalm = head + ':' + body.replace(/[^\s\u05BE:]+/g, w => ++k === n ? mark(w) : w);
  const week = Math.floor((n - 1) / 7), day = (n - 1) % 7;
  const ana = A.ana.map((l, i) => {
    if (i !== week) return l;
    const m = l.match(/^(.*?)\s+(\S+״\S+ \S+״\S+)$/), words = m[1];
    if (day === 6) return words + ' ' + mark(m[2]);
    let j = 0;
    return words.replace(/[^\s,.]+/g, w => j++ === day ? mark(w) : w) + ' ' + m[2];
  });
  const sefirah = SEFIROS_HE[day] + ' ' + SEFIROS_SHEB_HE[week];
  return { harachaman: A.harachaman, psalm, ana, baruchShem: A.baruchShem, ribono: A.ribono.replace('(השייכת לאותו הלילה)', mark(sefirah)) };
}

// The bracha before counting (Chabad siddur)
const OMER_BRACHA_HE = 'בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו, וְצִוָּנוּ עַל סְפִירַת הָעֹמֶר.';
const OMER_BRACHA_EN = 'Blessed are You, L-rd our G-d, King of the universe, who has made us holy with His commandments and commanded us concerning the counting of the Omer.';

// Our own English for what is said after counting
const OMER_AFTER_EN = {
  harachaman: 'May the Merciful One restore the service of the Beis HaMikdash to its place, speedily in our days. Amen, selah.',
  psalm: 'For the conductor, with instruments, a psalm, a song. G-d, be gracious to us and bless us; may He make His face shine on us, selah. So that Your way be known on earth, Your salvation among all the nations. The peoples will thank You, G-d; the peoples will thank You, all of them. Nations will rejoice and sing, for You judge the peoples justly and guide the nations on earth, selah. The peoples will thank You, G-d; the peoples will thank You, all of them. The earth has given its produce; may G-d, our G-d, bless us. May G-d bless us, and all the ends of the earth fear Him.',
  ana: [
    'Please, with the great strength of Your right hand, set free the one who is bound.',
    'Accept the song of Your people; lift us up, purify us, Awesome One.',
    'Please, Mighty One, guard like the apple of the eye those who seek Your Oneness.',
    'Bless them, purify them; grant them always the mercy of Your righteousness.',
    'Powerful Holy One, in Your great goodness lead Your people.',
    'Only One, Exalted One, turn to Your people, who remember Your holiness.',
    'Accept our plea and hear our cry, You who know what is hidden.',
  ],
  baruchShem: 'Blessed be the name of His glorious kingdom forever and ever.',
  ribono: 'Master of the world, You commanded us through Moshe Your servant to count the Omer, to purify us from our kelipos and our impurities, as You wrote in Your Torah: "You shall count for yourselves from the day after the Shabbos, from the day you bring the Omer that is waved: seven full weeks shall there be. Until the day after the seventh week you shall count fifty days," so that the souls of Your people Israel be purified of their uncleanness. And so may it be Your will, L-rd our G-d and G-d of our fathers, that in the merit of the counting of the Omer that I counted today, what I spoiled in the sefirah of tonight be repaired, and I be purified and made holy with the holiness above; and through this may great abundance flow in all the worlds, and may our nefesh, ruach and neshamah be repaired of every flaw and blemish, and may we be purified and made holy with Your supreme holiness. Amen, selah.',
};
