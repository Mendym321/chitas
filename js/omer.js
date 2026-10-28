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

// Night n's count: { n, he, en, sefirah: { en, he } }
function omerCount(n) {
  if (!(n >= 1 && n <= 49)) return null;
  const inner = (n - 1) % 7, outer = Math.floor((n - 1) / 7);
  return { n, he: OMER_COUNT_HE[n - 1], en: OMER_COUNT_EN[n - 1],
    sefirah: { en: SEFIROS[inner] + ' ' + SEFIROS_SHEB[outer], he: SEFIROS_HE[inner] + ' ' + SEFIROS_SHEB_HE[outer] } };
}

// The bracha before counting (Chabad siddur)
const OMER_BRACHA_HE = 'בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו, וְצִוָּנוּ עַל סְפִירַת הָעֹמֶר.';
const OMER_BRACHA_EN = 'Blessed are You, L-rd our G-d, King of the universe, who has made us holy with His commandments and commanded us concerning the counting of the Omer.';
