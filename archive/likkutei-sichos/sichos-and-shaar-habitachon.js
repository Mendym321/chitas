// The Likkutei Sichos reader (dictionary/translation mode, pasuk detection,
// sicha list and reader, footnotes) and the Sha'ar HaBitachon reader, exactly as
// they were in Chitas's index.html. See README.md for what they need around them.

// ════════════════════════════════════════════════════════════════════════════
// ZONE LS-DICT · LIKKUTEI SICHOS TRANSLATION MODE
// ════════════════════════════════════════════════════════════════════════════

let _lsDict       = null;  // { word: { translation, notes } } — loaded once
let _lsTransMode  = false; // is translation mode on?
let _lsDictWord   = null;  // word currently being added in admin modal

// ── Load dictionary from Firestore ──────────────────────────────────────────
async function _lsLoadDict() {
  if (_lsDict) return _lsDict;
  try {
    const { getApp }     = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, collection: col, getDocs: gd } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const _db   = getFirestore(getApp('[DEFAULT]'));
    const snap  = await gd(col(_db, 'lsDict'));
    _lsDict = {};
    snap.forEach(d => { _lsDict[d.id] = d.data(); });
  } catch(e) {
    console.warn('[lsDict] Load failed:', e.message);
    _lsDict = null; // reset so it retries next time
  }
  return _lsDict;
}

// ── Apply translation squiggles to rendered body ─────────────────────────────
function _lsApplyTranslations() {
  if (!_lsTransMode || !_lsDict) return;
  const wrap = document.getElementById('ls-body-wrap');
  if (!wrap) return;

  const dict  = _lsDict;
  const words = Object.keys(dict);
  if (!words.length) return;

  // Strip nikud/cantillation + replace maqaf with space for matching
  const stripNikud = s => s
    .replace(/\u05BE/g, ' ')           // maqaf → space
    .replace(/[\u0591-\u05C7]/g, ''); // strip nikud

  // Sort longest first — phrases match before component words
  const sorted = words.slice().sort((a, b) => b.length - a.length);
  const escaped = sorted.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const HE = '\u05D0-\u05EA\u05F3\u05F4';
  const re = new RegExp(
    '(?<![' + HE + '])(' + escaped.join('|') + ')(?![' + HE + '])',
    'g'
  );

  function processNode(node) {
    if (node.nodeType === 3) {
      const orig = node.textContent;
      // Strip nikud for matching — build position map orig→stripped
      let stripped = '';
      const origToStripped = []; // origToStripped[i] = position in stripped for orig[i]
      const strippedToOrig = []; // strippedToOrig[j] = position in orig for stripped[j]
      for (let i = 0; i < orig.length; i++) {
        const ch = orig[i];
        const code = ch.charCodeAt(0);
        const isNikud = (code >= 0x0591 && code <= 0x05C7);
        origToStripped.push(stripped.length);
        if (!isNikud) {
          strippedToOrig.push(i);
          stripped += ch;
        }
      }
      strippedToOrig.push(orig.length); // sentinel

      re.lastIndex = 0;
      if (!re.test(stripped)) return;
      re.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastOrig = 0, m;
      while ((m = re.exec(stripped)) !== null) {
        // Map stripped positions back to orig positions
        const origStart = strippedToOrig[m.index];
        const origEnd   = strippedToOrig[m.index + m[1].length] ?? orig.length;

        if (origStart > lastOrig) {
          frag.appendChild(document.createTextNode(orig.slice(lastOrig, origStart)));
        }
        const span = document.createElement('span');
        span.className   = 'ls-trans-word';
        span.dataset.word = m[1]; // store the dict key (no nikud)
        span.textContent  = orig.slice(origStart, origEnd); // display with nikud
        frag.appendChild(span);
        lastOrig = origEnd;
      }
      if (lastOrig < orig.length) {
        frag.appendChild(document.createTextNode(orig.slice(lastOrig)));
      }
      node.parentNode.replaceChild(frag, node);
    } else if (
      node.nodeType === 1 &&
      !['SCRIPT','STYLE','SPAN'].includes(node.tagName)
    ) {
      Array.from(node.childNodes).forEach(processNode);
    }
  }

  Array.from(wrap.childNodes).forEach(processNode);
  // Click handled by _lsWrapClick added in _lsApplyPasukSquiggles
}

// ── Remove translation squiggles ─────────────────────────────────────────────
function _lsRemoveTranslations() {
  const wrap = document.getElementById('ls-body-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('.ls-trans-word').forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  wrap.querySelectorAll('.ls-pasuk-quote').forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  wrap.normalize();
  wrap.removeEventListener('click', _lsWrapClick);
  wrap.removeEventListener('click', _lsTransWordClick);
  wrap.removeEventListener('click', _lsPasukClick);
  _lsHideTransPopup();
}

// ── Word tap handler ──────────────────────────────────────────────────────────
function _lsTransWordClick(e) {
  const span = e.target.closest('.ls-trans-word');
  if (!span) {
    // Tapped outside any word — close popup
    if (!e.target.closest('#ls-trans-popup')) _lsHideTransPopup();
    return;
  }
  e.stopPropagation();
  const word  = span.dataset.word;
  const entry = (_lsDict || {})[word];
  if (!entry) return;

  // Toggle — same span tapped again = close
  const popup = document.getElementById('ls-trans-popup');
  if (!popup) return;
  if (popup.style.display !== 'none' && popup.dataset.activeSpan === 'w:' + word + span.textContent) {
    _lsHideTransPopup(); return;
  }

  document.querySelectorAll('.ls-trans-word.active, .ls-pasuk-quote.active').forEach(s => s.classList.remove('active'));
  span.classList.add('active');
  popup.dataset.activeSpan = 'w:' + word + span.textContent;

  const isAdmin = user?.isAdmin || user?.role === 'admin';
  popup.innerHTML =
    '<div class="ls-tp-word">' + escapeHtml(word) + '</div>'
    + '<div class="ls-tp-trans">' + escapeHtml(entry.translation || '') + '</div>'
    + (entry.notes ? '<div class="ls-tp-notes">' + escapeHtml(entry.notes) + '</div>' : '')
    + (isAdmin ? '<button onclick="_lsDictModalOpen(decodeURIComponent(\'' + encodeURIComponent(word) + '\'))" style="margin-top:8px;font-size:11px;font-weight:700;color:var(--t3);background:none;border:none;cursor:pointer;font-family:inherit;padding:0;">Edit</button>' : '');

  popup.style.display = 'block';
  _positionPopup(popup, span);
}

function _lsHideTransPopup() {
  const popup = document.getElementById('ls-trans-popup');
  if (popup) { popup.style.display = 'none'; delete popup.dataset.activeSpan; }
  document.querySelectorAll('.ls-trans-word.active, .ls-pasuk-quote.active').forEach(s => s.classList.remove('active'));
}

// ── Toggle translation mode (called from settings gear) ──────────────────────
async function _lsToggleTransMode(on) {
  _lsTransMode = on;
  localStorage.setItem('ls_trans_mode', on ? '1' : '0');
  if (on) {
    if (!_lsDict) await _lsLoadDict();
    _lsApplyTranslations();
    // Apply pasuk squiggles if text map already built, else wait for async detection
    if (Object.keys(window._lsPasukTextMap || {}).length) {
      _lsApplyPasukSquiggles(window._lsCurrentFnMap || {});
    }
  } else {
    _lsRemoveTranslations();
  }
  // Rebuild settings opts so toggle reflects state
  const sid = document.getElementById('chabad-mark-btn')?.dataset?.sectionId;
  if (sid) _buildSettingsSectionOpts(sid);
}

// ── Admin: open add/edit modal ────────────────────────────────────────────────
function _lsDictModalOpen(word) {
  _lsHideTransPopup();
  _lsDictWord = word;
  const existing = (_lsDict || {})[word] || {};
  document.getElementById('ls-dict-modal-word').textContent  = word;
  document.getElementById('ls-dict-trans-input').value       = existing.translation || '';
  document.getElementById('ls-dict-notes-input').value       = existing.notes || '';
  const modal = document.getElementById('ls-dict-modal');
  if (modal) modal.style.display = 'flex';
  setTimeout(() => document.getElementById('ls-dict-trans-input')?.focus(), 200);
}

function _lsDictModalClose() {
  const modal = document.getElementById('ls-dict-modal');
  if (modal) modal.style.display = 'none';
  _lsDictWord = null;
}

async function _lsDictModalSave() {
  if (!_lsDictWord) return;
  const translation = document.getElementById('ls-dict-trans-input').value.trim();
  const notes       = document.getElementById('ls-dict-notes-input').value.trim();
  if (!translation) { fire('Please enter a translation', 'warn'); return; }

  try {
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, doc: firestoreDoc, setDoc: sd } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const _db = getFirestore(getApp('[DEFAULT]'));
    await sd(firestoreDoc(_db, 'lsDict', _lsDictWord), {
      translation,
      notes: notes || '',
      updatedAt: Date.now()
    });
    // Update local cache
    if (!_lsDict) _lsDict = {};
    _lsDict[_lsDictWord] = { translation, notes };
    fire('Saved: ' + _lsDictWord, 'gold');
    _lsDictModalClose();
    // Re-apply so new word gets squiggle immediately
    if (_lsTransMode) {
      _lsRemoveTranslations();
      _lsApplyTranslations();
    }
  } catch(e) {
    fire('Save failed: ' + e.message, 'warn');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ZONE LS-PASUK · QUOTED PASUK / RASHI DETECTION & SEFARIA TRANSLATION
// ════════════════════════════════════════════════════════════════════════════

// ── Hebrew book/parsha name → Sefaria API name ───────────────────────────────
const _SEFARIA_BOOKS = {
  // Torah — by book name
  'בראשית':'Genesis','שמות':'Exodus','ויקרא':'Leviticus','במדבר':'Numbers','דברים':'Deuteronomy',
  // Torah — by parsha name (maps to book, chapter offset handled separately)
  'בראשית':'Genesis','נח':'Genesis','לך לך':'Genesis','וירא':'Genesis','חיי שרה':'Genesis',
  'תולדות':'Genesis','ויצא':'Genesis','וישלח':'Genesis','וישב':'Genesis','מקץ':'Genesis',
  'ויגש':'Genesis','ויחי':'Genesis',
  'שמות':'Exodus','וארא':'Exodus','בא':'Exodus','בשלח':'Exodus','יתרו':'Exodus',
  'משפטים':'Exodus','תרומה':'Exodus','תצוה':'Exodus','כי תשא':'Exodus','ויקהל':'Exodus','פקודי':'Exodus',
  'ויקרא':'Leviticus','צו':'Leviticus','שמיני':'Leviticus','תזריע':'Leviticus','מצורע':'Leviticus',
  'אחרי':'Leviticus','קדושים':'Leviticus','אמור':'Leviticus','בהר':'Leviticus','בחוקותי':'Leviticus',
  'במדבר':'Numbers','נשא':'Numbers','בהעלותך':'Numbers','שלח':'Numbers','קרח':'Numbers',
  'חקת':'Numbers','בלק':'Numbers','פינחס':'Numbers','מטות':'Numbers','מסעי':'Numbers',
  'דברים':'Deuteronomy','ואתחנן':'Deuteronomy','עקב':'Deuteronomy','ראה':'Deuteronomy',
  /* 'שופטים' = the book of Judges (see Prophets below) */ 'כי תצא':'Deuteronomy','כי תבא':'Deuteronomy','נצבים':'Deuteronomy',
  'וילך':'Deuteronomy','האזינו':'Deuteronomy','וזאת הברכה':'Deuteronomy',
  // Prophets
  'יהושע':'Joshua','שופטים':'Judges','שמואל':'Samuel','מלכים':'Kings',
  'ישעיה':'Isaiah','ירמיה':'Jeremiah','יחזקאל':'Ezekiel',
  'הושע':'Hosea','יואל':'Joel','עמוס':'Amos','עובדיה':'Obadiah','יונה':'Jonah',
  'מיכה':'Micah','נחום':'Nahum','חבקוק':'Habakkuk','צפניה':'Zephaniah','חגי':'Haggai',
  'זכריה':'Zechariah','מלאכי':'Malachi',
  // Writings
  'תהלים':'Psalms','משלי':'Proverbs','איוב':'Job','שיר השירים':'Song of Songs',
  'רות':'Ruth','איכה':'Lamentations','קהלת':'Ecclesiastes','אסתר':'Esther',
  'דניאל':'Daniel','עזרא':'Ezra','נחמיה':'Nehemiah','דברי הימים':'Chronicles',
  // Talmud tractates
  'ברכות':'Berakhot','שבת':'Shabbat','עירובין':'Eruvin','פסחים':'Pesachim',
  'יומא':'Yoma','סוכה':'Sukkah','ביצה':'Beitzah','ראש השנה':'Rosh Hashanah',
  'תענית':'Taanit','מגילה':'Megillah','מועד קטן':'Moed Katan','חגיגה':'Chagigah',
  'יבמות':'Yevamot','כתובות':'Ketubot','נדרים':'Nedarim','נזיר':'Nazir',
  'סוטה':'Sotah','גיטין':'Gittin','קידושין':'Kiddushin',
  'בבא קמא':'Bava Kamma','בבא מציעא':'Bava Metzia','בבא בתרא':'Bava Batra',
  'ב״ק':'Bava Kamma','ב״מ':'Bava Metzia','ב״ב':'Bava Batra',
  'סנהדרין':'Sanhedrin','מכות':'Makkot','שבועות':'Shevuot',
  'עבודה זרה':'Avodah Zarah','הוריות':'Horayot','זבחים':'Zevachim',
  'מנחות':'Menachot','חולין':'Chullin','בכורות':'Bekhorot','ערכין':'Arakhin',
  'תמורה':'Temurah','כריתות':'Keritot','מעילה':'Meilah','נדה':'Niddah',
  // Yerushalmi
  'ירושלמי ברכות':'Jerusalem Talmud Berakhot',
  'ירושלמי שבת':'Jerusalem Talmud Shabbat',
  'ירושלמי פאה':'Jerusalem Talmud Peah',
  'ירושלמי דמאי':'Jerusalem Talmud Demai',
  'ירושלמי כלאים':'Jerusalem Talmud Kilayim',
  'ירושלמי חגיגה':'Jerusalem Talmud Chagigah',
  'ירושלמי מגילה':'Jerusalem Talmud Megillah',
  'ירושלמי קידושין':'Jerusalem Talmud Kiddushin',
  'ירושלמי סנהדרין':'Jerusalem Talmud Sanhedrin',
  'ירושלמי פסחים':'Jerusalem Talmud Pesachim',
  // Midrash Rabbah
  'בראשית רבה':'Bereishit Rabbah',
  'שמות רבה':'Shemot Rabbah',
  'ויקרא רבה':'Vayikra Rabbah',
  'במדבר רבה':'Bamidbar Rabbah',
  'דברים רבה':'Devarim Rabbah',
  'שיר השירים רבה':'Shir HaShirim Rabbah',
  'רות רבה':'Ruth Rabbah',
  'איכה רבה':'Eichah Rabbah',
  'קהלת רבה':'Kohelet Rabbah',
  'אסתר רבה':'Esther Rabbah',
  'תנחומא':'Midrash Tanchuma',
  'ילקוט שמעוני':'Yalkut Shimoni on Torah',
  // Rashi & commentaries (prefixed with book name)
  'רש"י בראשית':'Rashi on Genesis',
  'רש"י שמות':'Rashi on Exodus',
  'רש"י ויקרא':'Rashi on Leviticus',
  'רש"י במדבר':'Rashi on Numbers',
  'רש"י דברים':'Rashi on Deuteronomy',
  'רש"י תהלים':'Rashi on Psalms',
  // Halachic sources on Sefaria
  'מכילתא':'Mekhilta','ספרי':'Sifre Bamidbar','תו"כ':'Sifra',
  'ספרא':'Sifra',
  // Rambam (Mishneh Torah) — app already fetches this, just add mapping
  'רמב"ם':'Mishneh Torah',
  // Zohar
  'זוהר':'Zohar','זח"א':'Zohar','זח"ב':'Zohar','זח"ג':'Zohar',
};

// Hebrew letter → number (for chapter/verse)
const _HE_NUMS = {
  'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
  'י':10,'יא':11,'יב':12,'יג':13,'יד':14,'טו':15,'טז':16,'יז':17,'יח':18,'יט':19,
  'כ':20,'כא':21,'כב':22,'כג':23,'כד':24,'כה':25,'כו':26,'כז':27,'כח':28,'כט':29,
  'ל':30,'לא':31,'לב':32,'לג':33,'לד':34,'לה':35,'לו':36,'לז':37,'לח':38,'לט':39,
  'מ':40,'מא':41,'מב':42,'מג':43,'מד':44,'מה':45,'מו':46,'מז':47,'מח':48,'מט':49,
  'נ':50,'נא':51,'נב':52,'נג':53,'נד':54,'נה':55,'נו':56,'נז':57,'נח':58,'נט':59,
  'ס':60,'סא':61,'סב':62,'סג':63,'סד':64,'סה':65,'סו':66,'סז':67,'סח':68,'סט':69,
  'ע':70,'עא':71,'עב':72,'עג':73,'עד':74,'עה':75,'עו':76,'עז':77,'עח':78,'עט':79,
  'פ':80,'פא':81,'פב':82,'פג':83,'פד':84,'פה':85,'פו':86,'פז':87,'פח':88,'פט':89,
  'צ':90,'צא':91,'צב':92,'צג':93,'צד':94,'צה':95,'צו':96,'צז':97,'צח':98,'צט':99,
  'ק':100,'קא':101,'קב':102,'קג':103,'קד':104,'קה':105,'קו':106,'קז':107,'קח':108,'קט':109,
  'קי':110,'קיא':111,'קיב':112,'קיג':113,'קיד':114,'קטו':115,'קטז':116,'קיז':117,'קיח':118,'קיט':119,
  'קכ':120,'קכא':121,'קכב':122,'קכג':123,'קכד':124,'קכה':125,'קכו':126,'קכז':127,'קכח':128,'קכט':129,
  'קל':130,'קלא':131,'קלב':132,'קלג':133,'קלד':134,'קלה':135,'קלו':136,'קלז':137,'קלח':138,'קלט':139,
  'קמ':140,'קמא':141,'קמב':142,'קמג':143,'קמד':144,'קמה':145,'קמו':146,'קמז':147,'קמח':148,'קמט':149,'קנ':150,
};

function _heToNum(s) {
  s = (s||'').trim().replace(/[״׳]/g,'');
  if (/^\d+$/.test(s)) return parseInt(s);
  return _HE_NUMS[s] || null;
}

// Parse a footnote string for the first source reference
// Tanach: "שמות כ, ח" → {book, ch, v, key:"Exodus.20.8"}
// Talmud: "ברכות לד, ב" → {book, ch, v, key:"Berakhot.34b", isTalmud:true}
function _parsePasukRef(fnText) {
  const clean = fnText.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

  const bookNames = Object.keys(_SEFARIA_BOOKS)
    .sort((a,b) => b.length - a.length)
    .map(b => b.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
    .join('|');

  const re = new RegExp(
    '(' + bookNames + ')[\\s,]+([א-ת״׳\\d]+)[,،\\s]+([א-ת״׳\\d]+)',
    'g'
  );

  let m;
  while ((m = re.exec(clean)) !== null) {
    const bookHe = m[1];
    const book   = _SEFARIA_BOOKS[bookHe];
    const ch     = _heToNum(m[2]);
    const v      = _heToNum(m[3]);
    if (!book || !ch) continue;

    // Check if this is a Talmud tractate — Talmud uses daf+amud not chapter:verse
    const isTalmud = [..._TALMUD_TRACTATES].includes(bookHe) ||
                     [..._YERUSHALMI_TRACTATES].some(t => bookHe.startsWith(t));

    if (isTalmud) {
      // Talmud: ch = daf number, v = 1(א) or 2(ב) = amud a or b
      const amud  = (v === 1 || m[3].trim().replace(/[״׳]/g,'') === 'א') ? 'a' : 'b';
      const key   = book + '.' + ch + amud;
      return { book, ch, v: amud, key, ref: bookHe + ' ' + m[2] + m[3], isTalmud: true };
    } else {
      if (!v) continue;
      const key = book + '.' + ch + '.' + v;
      return { book, ch, v, key, ref: bookHe + ' ' + m[2] + ':' + m[3], isTalmud: false };
    }
  }
  return null;
}

// Source type detection
const _TALMUD_TRACTATES = new Set([
  'ברכות','שבת','עירובין','פסחים','יומא','סוכה','ביצה','ראש השנה','תענית',
  'מגילה','מועד קטן','חגיגה','יבמות','כתובות','נדרים','נזיר','סוטה','גיטין',
  'קידושין','בבא קמא','בבא מציעא','בבא בתרא','ב״ק','ב״מ','ב״ב',
  'סנהדרין','מכות','שבועות','עבודה זרה','הוריות','זבחים','מנחות','חולין',
  'בכורות','ערכין','תמורה','כריתות','מעילה','נדה',
]);
const _YERUSHALMI_TRACTATES = new Set(['ירושלמי']);
const _MIDRASH_SOURCES = new Set([
  'בראשית רבה','שמות רבה','ויקרא רבה','במדבר רבה','דברים רבה',
  'שיר השירים רבה','רות רבה','איכה רבה','קהלת רבה','אסתר רבה',
  'תנחומא','ילקוט שמעוני','מכילתא','ספרי','תו"כ','ספרא',
]);
const _RASHI_SOURCES  = new Set(['רש"י','פרש"י']);
const _ZOHAR_SOURCES  = new Set(['זוהר','זח"א','זח"ב','זח"ג','זהר']);
const _SKIP_SOURCES   = new Set([
  // Chabad texts — not on Sefaria, skip gracefully
  'לקו"ש','לקו"ת','תורה אור','אור התורה','שו"ע אדה"ז','תניא',
  'אגרת הקדש','ד"ה','המשך','לקוטי תורה','לקוטי שיחות',
]);

function _detectSourceType(src) {
  const clean = (src || '').replace(/<[^>]+>/g, ' ');
  if (_SKIP_SOURCES   .has([..._SKIP_SOURCES].find(s => clean.includes(s)) || '')) return 'skip';
  if ([..._SKIP_SOURCES].some(s => clean.startsWith(s))) return 'skip';
  if ([..._ZOHAR_SOURCES].some(s => clean.includes(s)))     return 'zohar';
  if ([..._RASHI_SOURCES].some(s => clean.includes(s)))     return 'rashi';
  if ([..._MIDRASH_SOURCES].some(s => clean.includes(s)))   return 'midrash';
  if (_YERUSHALMI_TRACTATES.has([..._YERUSHALMI_TRACTATES].find(s => clean.includes(s)) || '')) return 'yerushalmi';
  if ([..._TALMUD_TRACTATES].some(s => clean.includes(s)))  return 'talmud';
  return 'tanach';
}

function _isTalmudRef(src) {
  return ['talmud','yerushalmi'].includes(_detectSourceType(src));
}

// Cache of fetched pesukim
const _pasukCache = {};

async function _fetchPasuk(book, ch, v, isTalmud = false, key = null) {
  const cacheKey = key || (book + '.' + ch + '.' + v);
  if (_pasukCache[cacheKey]) return _pasukCache[cacheKey];

  const enc = encodeURIComponent(cacheKey);
  let en = '', he = '', ref = key;

  try {
    if (isTalmud) {
      // Talmud: fetch segments using v2 API (more reliable structure)
      const heRes = await fetch('https://www.sefaria.org/api/texts/' + enc + '?context=0&commentary=0').then(r=>r.json()).catch(()=>null);
      const enRes = await fetch('https://www.sefaria.org/api/texts/' + enc + '?context=0&commentary=0&lang=en').then(r=>r.json()).catch(()=>null);

      const cleanStr = s => (s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
      const stripNikud = s => cleanStr(s).replace(/[\u0591-\u05C7]/g,'').replace(/\u05BE/g,' ').trim();

      // he and text arrays are the segments
      const rawHe = Array.isArray(heRes?.he)   ? heRes.he   : [];
      const rawEn = Array.isArray(heRes?.text) ? heRes.text :
                    Array.isArray(enRes?.text)  ? enRes.text : [];

      ref = heRes?.ref || cacheKey;

      const segments = rawHe.map((h, i) => ({
        he:    stripNikud(h),
        heRaw: cleanStr(h),
        en:    cleanStr(rawEn[i] || ''),
      })).filter(s => s.he.length > 2);

      he = segments.map(s => s.heRaw).join(' ');
      en = segments.map(s => s.en).filter(Boolean).join(' ');

      const result = { he, en, ref, segments };
      _pasukCache[cacheKey] = result;
      return result;
    } else {
      // Tanach, Midrash, Rashi, etc: use ven= with keyword matching
      // Pick best English version available
      const versions = await fetch(SEFARIA + '/api/texts/versions/' + enc).then(r=>r.json()).catch(()=>[]);
      const enVersions = Array.isArray(versions) ? versions.filter(v => v.language === 'en') : [];

      // Priority: Metsudah > Soncino > Artscroll > first available
      const picked = enVersions.find(v => v.versionTitle?.toLowerCase().includes('metsudah'))
        || enVersions.find(v => v.versionTitle?.toLowerCase().includes('soncino'))
        || enVersions.find(v => v.versionTitle?.toLowerCase().includes('artscroll'))
        || enVersions[0];

      const url = picked
        ? SEFARIA + '/api/texts/' + enc + '?context=0&commentary=0&ven=' + encodeURIComponent(picked.versionTitle)
        : SEFARIA + '/api/texts/' + enc + '?context=0&commentary=0';

      const d = await fetch(url).then(r=>r.json()).catch(()=>null);
      const strip = s => (s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
      const stripHe = s => s.replace(/[\u0591-\u05AF]/g,'').replace(/<[^>]+>/g,'').trim();

      en  = Array.isArray(d?.text) ? d.text.map(strip).filter(Boolean).join(' ') : strip(d?.text);
      he  = Array.isArray(d?.he)   ? d.he.map(stripHe).filter(Boolean).join(' ') : stripHe(d?.he||'');
      ref = d?.ref || key;
    }
  } catch(e) {}

  // If no English found, note it gracefully
  if (!en && !he) return null;
  const result = { he, en, ref };
  _pasukCache[cacheKey] = result;
  return result;
}

// ── Apply pasuk squiggles to quoted text in the sicha ──────────────────────
function _lsApplyPasukSquiggles(footnoteMap) {
  if (!_lsTransMode) return;
  const wrap = document.getElementById('ls-body-wrap');
  if (!wrap) return;

  const textMap = window._lsPasukTextMap || {};
  const phrases = Object.keys(textMap);
  if (!phrases.length) { wrap.addEventListener('click', _lsWrapClick); return; }

  // Sort longest first
  phrases.sort((a, b) => b.length - a.length);
  const escaped = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const HE = '\u05D0-\u05EA';
  const re = new RegExp('(?<![' + HE + '])(' + escaped.join('|') + ')(?![' + HE + '])', 'g');

  function processNode(node) {
    if (node.nodeType === 3) {
      if (node.parentNode?.tagName === 'SPAN') return;
      const text = node.textContent;
      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const pData = textMap[m[1]];
        const span  = document.createElement('span');
        span.className       = 'ls-pasuk-quote';
        span.textContent     = m[1];
        span.dataset.lsfn    = pData?.fnNum || '';
        span.dataset.pasukSrc = encodeURIComponent(pData?.src || '');
        span.dataset.quoted  = encodeURIComponent(m[1]);
        // Cache the already-fetched pasuk so click is instant
        if (pData?.pasuk) span.dataset.pasukKey = pData.key || '';
        frag.appendChild(span);
        last = m.index + m[1].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === 1 && !['SCRIPT','STYLE','SPAN'].includes(node.tagName)) {
      Array.from(node.childNodes).forEach(processNode);
    }
  }

  Array.from(wrap.childNodes).forEach(processNode);
  // Remove before adding to prevent duplicate listeners
  wrap.removeEventListener('click', _lsWrapClick);
  wrap.addEventListener('click', _lsWrapClick);
}

function _lsWrapClick(e) {
  // Pasuk span?
  const pasukSpan = e.target.closest('.ls-pasuk-quote');
  if (pasukSpan) { _lsPasukClick(e); return; }
  // Word span?
  const wordSpan = e.target.closest('.ls-trans-word');
  if (wordSpan) { _lsTransWordClick(e); return; }
  // Popup itself?
  if (e.target.closest('#ls-trans-popup')) return;
  // Outside — close
  _lsHideTransPopup();
}

async function _lsPasukClick(e) {
  const span = e.target.closest('.ls-pasuk-quote');
  if (!span) return;
  e.stopPropagation();

  const popup = document.getElementById('ls-trans-popup');
  if (!popup) return;

  // Toggle — if already open on this span, close it
  if (popup.style.display !== 'none' && popup.dataset.activeSpan === span.dataset.lsfn + span.textContent.substring(0,10)) {
    _lsHideTransPopup();
    return;
  }

  document.querySelectorAll('.ls-pasuk-quote.active').forEach(s => s.classList.remove('active'));
  span.classList.add('active');
  popup.dataset.activeSpan = span.dataset.lsfn + span.textContent.substring(0,10);

  // Show loading
  popup.innerHTML = '<p style="color:var(--t3);font-size:var(--fs-2);">Loading...</p>';
  popup.style.display = 'block';
  _positionPopup(popup, span);

  const src = decodeURIComponent(span.dataset.pasukSrc || '');
  const sourceType = _detectSourceType(src);
  const ref = src ? _parsePasukRef(src) : null;

  if (!ref || sourceType === 'skip') {
    popup.innerHTML = '<p style="font-size:var(--fs-2);color:var(--t3);">See footnote for source</p>';
    return;
  }

  // Use cached pasuk from text detection if available — no extra fetch needed
  const textMap = window._lsPasukTextMap || {};
  const quoted  = decodeURIComponent(span.dataset.quoted || '');
  const cached  = Object.values(textMap).find(d => d.key === ref.key);
  const isTalmud = ref.isTalmud || (sourceType === 'talmud' || sourceType === 'yerushalmi');
  const pasuk = cached?.pasuk || await _fetchPasuk(ref.book, ref.ch, ref.v, isTalmud, ref.key);
  if (!pasuk) {
    popup.innerHTML = '<p style="font-size:var(--fs-2);color:var(--t3);">' + ref.ref + '</p>';
    return;
  }

  // The actual quoted text — clean it up
  const quotedText = decodeURIComponent(span.dataset.quoted || '')
    .replace(/^[„""]|["""]$/g, '')
    .replace(/\s+גו[׳']\s*$/, '')  // strip trailing גו׳
    .replace(/\s+וגו[׳']\s*$/, '') // strip trailing וגו׳
    .trim();

  // Helper: strip nikud/cantillation so we can match quoted text against nikud Hebrew
  const stripNikud = s => s.replace(/[\u0591-\u05C7]/g, '').replace(/\s+/g, ' ').trim();

  let heDisplay = pasuk.he || '';
  let enDisplay = pasuk.en || '';

  if (quotedText.length > 2 && heDisplay) {
    const qStripped  = stripNikud(quotedText);
    const heStripped = stripNikud(heDisplay);

    // Find position of quoted text in the nikud-stripped version
    const idx = heStripped.indexOf(qStripped);

    if (idx !== -1) {
      // Map that position back to the original nikud text
      // Walk both strings simultaneously
      let origIdx = 0, strippedCount = 0;
      let origStart = -1, origEnd = -1;

      for (let i = 0; i < heDisplay.length; i++) {
        const ch = heDisplay[i];
        const isNikud = ch >= '\u0591' && ch <= '\u05C7';
        if (!isNikud) {
          if (strippedCount === idx && origStart === -1) origStart = i;
          if (strippedCount === idx + qStripped.length) { origEnd = i; break; }
          strippedCount++;
        }
      }
      if (origEnd === -1) origEnd = heDisplay.length;

      if (origStart !== -1) {
        // Bold the matched portion
        heDisplay = heDisplay.slice(0, origStart)
          + '<strong style="color:var(--t1);">' + heDisplay.slice(origStart, origEnd) + '</strong>'
          + heDisplay.slice(origEnd);
      }
    } else {
      // Fallback: try first 6 chars match (handles partial quotes, gershayim differences)
      const shortQ = stripNikud(quotedText.substring(0, 6));
      const shortIdx = heStripped.indexOf(shortQ);
      if (shortIdx !== -1) {
        // Just bold the approximate region
        let origStart = -1; let sc = 0;
        for (let i = 0; i < heDisplay.length; i++) {
          const isNikud = heDisplay[i] >= '\u0591' && heDisplay[i] <= '\u05C7';
          if (!isNikud) {
            if (sc === shortIdx) { origStart = i; break; }
            sc++;
          }
        }
        if (origStart !== -1) {
          // Bold from match point for approx length of quoted text
          const boldLen = Math.min(qStripped.length * 1.5, heDisplay.length - origStart);
          heDisplay = heDisplay.slice(0, origStart)
            + '<strong style="color:var(--t1);">' + heDisplay.slice(origStart, origStart + boldLen) + '</strong>'
            + heDisplay.slice(origStart + boldLen);
        }
      }
    }
  }

  const srcLabel = { tanach:'Tanach', talmud:'Talmud Bavli', yerushalmi:'Yerushalmi', midrash:'Midrash', rashi:'Rashi', zohar:'Zohar' }[sourceType] || '';

  popup.innerHTML =
    '<p style="font-size:var(--fs-1);font-weight:700;color:#5B7DB0;margin-bottom:6px;">'
    + pasuk.ref
    + (srcLabel ? ' · <span style="color:var(--t3);">' + srcLabel + '</span>' : '')
    + '</p>'
    + (heDisplay ? '<p style="font-family:\'DachHeilig\',\'Frank Ruhl Libre\',serif;font-size:16px;line-height:1.7;direction:rtl;color:var(--t2);margin-bottom:8px;">' + heDisplay + '</p>' : '')
    + (enDisplay ? '<p style="font-size:var(--fs-2);line-height:1.6;color:var(--t2);">' + enDisplay + '</p>'
                 : '<p style="font-size:var(--fs-1);color:var(--t3);">No English translation available</p>');

  _positionPopup(popup, span);
}

// Shared popup positioner (used by both word and pasuk popups)
function _positionPopup(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  const PAD  = 10;
  const VW   = window.innerWidth;
  const VH   = window.innerHeight;
  const pw   = Math.min(280, VW - PAD * 2);
  popup.style.maxWidth = pw + 'px';
  popup.style.display  = 'block';

  const aboveTop = rect.top - popup.offsetHeight - PAD;
  const belowTop = rect.bottom + PAD;
  let top  = aboveTop >= 60 ? aboveTop : belowTop;
  let left = rect.left + rect.width / 2 - pw / 2;
  left = Math.max(PAD, Math.min(left, VW - pw - PAD));
  if (top + popup.offsetHeight > VH - PAD) top = Math.max(60, aboveTop);
  top  = Math.max(60, top);

  popup.style.top  = top + 'px';
  popup.style.left = left + 'px';
}

// ════════════════════════════════════════════════════════════════════════════
// END ZONE LS-PASUK
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// ZONE SHB · SHA'AR HABITACHON READER
// ════════════════════════════════════════════════════════════════════════════

const SHB_UNITS = [
  { id: 'intro', label: 'Introduction',  sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust,_Introduction', paragraphs: 49 },
  { id: '1',     label: 'Chapter 1',     sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust.1',            paragraphs: 2  },
  { id: '2',     label: 'Chapter 2',     sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust.2',            paragraphs: 17 },
  { id: '3',     label: 'Chapter 3',     sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust.3',            paragraphs: 64 },
  { id: '4',     label: 'Chapter 4',     sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust.4',            paragraphs: 118},
  { id: '5',     label: 'Chapter 5',     sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust.5',            paragraphs: 16 },
  { id: '6',     label: 'Chapter 6',     sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust.6',            paragraphs: 16 },
  { id: '7',     label: 'Chapter 7',     sefaria: 'Duties_of_the_Heart,_Fourth_Treatise_on_Trust.7',            paragraphs: 24 },
];

// Progress stored in user object: user.shbProgress = { unitId, scrollY, lastSeen }
function _shbGetProgress() {
  return user.shbProgress || { unitId: 'intro', scrollY: 0 };
}

function _shbSaveProgress(unitId, scrollY, syncToCloud = true) {
  user.shbProgress = { unitId, scrollY: Math.round(scrollY), lastSeen: Date.now() };
  if (syncToCloud) saveUser();
  else try { localStorage.setItem('chitas_v78', JSON.stringify(user)); } catch {}
}

function _shbSaveScroll() {
  const reader = document.getElementById('native-reader');
  if (!reader) return;
  _shbSaveProgress(_shbGetProgress().unitId, reader.scrollTop);
}

// Cache of fetched unit data
const _shbCache = {};

async function _fetchShbUnit(unit) {
  if (_shbCache[unit.id]) return _shbCache[unit.id];
  const url = SEFARIA + '/api/texts/' + encodeURIComponent(unit.sefaria) + '?context=0&commentary=0';
  const d   = await fetch(url).then(r => r.json());
  const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const he  = Array.isArray(d.he)   ? d.he.map(strip)   : [strip(d.he)];
  const en  = Array.isArray(d.text) ? d.text.map(strip) : [strip(d.text)];
  const result = { he, en };
  _shbCache[unit.id] = result;
  return result;
}

async function _openShaarHaBitachon() {
  window._readerActiveSid = 'shaarHaBitachon';
  const prog    = _shbGetProgress();
  const unitIdx = SHB_UNITS.findIndex(u => u.id === prog.unitId);
  const unit    = SHB_UNITS[unitIdx >= 0 ? unitIdx : 0];

  document.getElementById('chabad-panel-title').textContent = 'שַׁעַר הַבִּטָּחוֹן';
  document.getElementById('chabad-panel-sub').textContent   = unit.label;

  // Hide quiz button
  const quizBtn = document.getElementById('chabad-quiz-btn');
  if (quizBtn) quizBtn.style.display = 'none';

  await _shbRenderUnit(unit, unitIdx >= 0 ? unitIdx : 0, prog.scrollY);
}

async function _shbRenderUnit(unit, unitIdx, restoreScroll = 0) {
  const def    = EXTRA_TRACK_DEFS.shaarHaBitachon;
  const loadEl = document.getElementById('native-reader-loading');
  const contEl = document.getElementById('native-reader-content');
  if (loadEl) loadEl.style.display = 'block';
  if (contEl) contEl.style.display = 'none';

  document.getElementById('chabad-panel-sub').textContent = unit.label;

  const lang = localStorage.getItem('chitas_lang_extra_shaarHaBitachon') || 'both';
  let data;
  try {
    data = await _fetchShbUnit(unit);
  } catch(e) {
    if (contEl) { contEl.innerHTML = '<p style="padding:24px;color:var(--t3);text-align:center;">Could not load. Please try again.</p>'; contEl.style.display = 'block'; }
    if (loadEl) loadEl.style.display = 'none';
    return;
  }

  const isLast  = unitIdx === SHB_UNITS.length - 1;
  const isFirst = unitIdx === 0;
  const color   = def.color;

  // ── Sticky chapter nav ───────────────────────────────────────────────────
  const navBar = '<div style="position:sticky;top:0;z-index:10;background:var(--bg);border-bottom:1px solid var(--border);padding:10px 0 10px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">'
    + '<button onclick="_shbNavUnit(' + (unitIdx-1) + ')" style="background:none;border:none;color:' + (isFirst ? 'var(--border)' : 'var(--t2)') + ';font-size:var(--fs-2);font-weight:700;cursor:' + (isFirst ? 'default' : 'pointer') + ';font-family:inherit;padding:4px 0;"' + (isFirst ? ' disabled' : '') + '>← Prev</button>'
    + '<div style="text-align:center;"><p style="font-size:var(--fs-2);font-weight:800;color:var(--t1);">' + unit.label + '</p><p style="font-size:var(--fs-1);color:var(--t3);">' + (unitIdx+1) + ' of ' + SHB_UNITS.length + '</p></div>'
    + '<button onclick="_shbNavUnit(' + (unitIdx+1) + ')" style="background:none;border:none;color:' + (isLast ? 'var(--border)' : 'var(--t2)') + ';font-size:var(--fs-2);font-weight:700;cursor:' + (isLast ? 'default' : 'pointer') + ';font-family:inherit;padding:4px 0;"' + (isLast ? ' disabled' : '') + '>Next →</button>'
    + '</div>';

  // ── Lang toggle ──────────────────────────────────────────────────────────
  const langToggle = _langSeg(lang, "localStorage.setItem('chitas_lang_extra_shaarHaBitachon','LANG');openExtraReader('shaarHaBitachon')");

  // ── Chapter heading ──────────────────────────────────────────────────────
  const heading = '<div style="margin-bottom:18px;padding:10px 14px;background:' + color + '14;border-left:4px solid ' + color + ';border-radius:0 8px 8px 0;">'
    + '<p style="font-size:var(--fs-1);font-weight:700;color:' + color + '80;margin-bottom:3px;">שַׁעַר הַבִּטָּחוֹן</p>'
    + '<p style="font-size:var(--fs-4);font-weight:800;color:' + color + ';line-height:1.3;">' + unit.label + '</p>'
    + '</div>';

  // ── Paragraphs ───────────────────────────────────────────────────────────
  const HE = "'Shlomo','Taamey Frank CLM','Noto Serif Hebrew',serif";
  const count = Math.max(data.he.length, data.en.length);
  let v = '';
  for (let i = 0; i < count; i++) {
    const he = data.he[i] || '';
    const en = data.en[i] || '';
    if (!he && !en) continue;
    if (lang === 'both' && he && en) {
      v += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:14px 0;border-bottom:1px solid var(--border);align-items:start;">';
      v += '<p class="rf-body" style="--rf-sz:15px;--rf-lh:1.82;color:var(--t1);">' + en + '</p>';
      v += '<p class="rf-body" style="direction:rtl;text-align:right;font-family:' + HE + ';--rf-sz:19px;--rf-lh:1.85;color:var(--t1);">' + he + '</p>';
      v += '</div>';
    } else if (lang === 'he' || !en) {
      v += '<div style="padding:14px 0;border-bottom:1px solid var(--border);">';
      v += '<p class="rf-body" style="direction:rtl;text-align:right;font-family:' + HE + ';--rf-sz:19px;--rf-lh:1.85;color:var(--t1);">' + he + '</p>';
      v += '</div>';
    } else {
      v += '<div style="padding:14px 0;border-bottom:1px solid var(--border);">';
      v += '<p class="rf-body" style="--rf-sz:15px;--rf-lh:1.82;color:var(--t1);">' + en + '</p>';
      v += '</div>';
    }
  }

  // ── Attribution + Summary ────────────────────────────────────────────────
  const attribution = '<p style="font-size:var(--fs-1);color:var(--t3);text-align:center;margin-top:20px;padding-top:14px;border-top:1px solid var(--border);">Translation: Rabbi Yosef Sebag · <a href="https://dafyomireview.com" target="_blank" style="color:var(--t3);">dafyomireview.com</a> (CC-BY)</p>';

  // Summary card — fetched from Firebase, shown collapsed by default
  const summaryId = 'shb-summary-' + unit.id;
  const summaryPlaceholder = '<div id="' + summaryId + '" style="margin-top:20px;"></div>';

  if (contEl) {
    contEl.innerHTML = navBar + langToggle + heading + v + attribution + summaryPlaceholder;
    contEl.style.display = 'block';
    const reader = document.getElementById('native-reader');
    if (reader) requestAnimationFrame(() => { reader.scrollTop = restoreScroll > 0 ? restoreScroll : 0; });
    // Fetch summary async — don't block render
    _shbLoadSummary(unit.id, summaryId, color);
  }
  if (loadEl) loadEl.style.display = 'none';

  // ── Update top mark button (no duplicate at bottom) ───────────────────
  const markBtn   = document.getElementById('chabad-mark-btn');
  const markLabel = document.getElementById('chabad-mark-label');
  const markXp    = document.getElementById('chabad-mark-xp');
  if (markBtn) {
    markBtn.dataset.state = 'todo';
    markBtn.style.cursor = 'pointer';
    if (markLabel) markLabel.textContent = isLast ? 'Complete Book' : 'Complete ' + unit.label;
    if (markXp)    markXp.textContent    = '';
    markBtn.onclick = () => _shbCompleteUnit(unit, unitIdx);
  }
}

async function _shbLoadSummary(unitId, elId, color) {
  const el = document.getElementById(elId);
  if (!el) return;

  try {
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const _db  = getFirestore(getApp('[DEFAULT]'));
    const docId = unitId === 'intro' ? 'intro' : 'ch' + unitId;
    const snap = await getDoc(doc(_db, 'shbSummaries', docId));
    if (!snap.exists()) return;
    const { title, summary, points } = snap.data();
    if (!summary && !points?.length) return;

    // Build collapsible summary card
    const pointsHtml = (points || []).map(p =>
      '<li style="margin-bottom:8px;line-height:1.55;color:var(--t2);font-size:var(--fs-2);">' + escapeHtml(p) + '</li>'
    ).join('');

    el.innerHTML =
      '<div style="margin-top:20px;background:' + color + '12;border:1px solid ' + color + '30;border-radius:var(--r-m);overflow:hidden;">'
      + '<button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.shb-chev\').style.transform=this.nextElementSibling.style.display===\'none\'?\'rotate(0deg)\':\'rotate(180deg)\'"'
      + ' style="width:100%;padding:14px 16px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-family:inherit;">'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<div style="width:28px;height:28px;border-radius:var(--r-s);background:' + color + '22;display:flex;align-items:center;justify-content:center;">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>'
      + '</div>'
      + '<span style="font-size:var(--fs-2);font-weight:800;color:' + color + ';">Chapter Summary</span>'
      + '</div>'
      + '<svg class="shb-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" style="transition:transform .2s;transform:rotate(0deg);flex-shrink:0;"><path d="M6 9l6 6 6-6"/></svg>'
      + '</button>'
      // Collapsed by default — user taps to reveal
      + '<div style="display:none;padding:0 16px 16px;">'
      + (summary ? '<p style="font-size:var(--fs-2);line-height:1.6;color:var(--t2);margin-bottom:14px;">' + escapeHtml(summary) + '</p>' : '')
      + (pointsHtml ? '<ul style="margin:0;padding-left:18px;">' + pointsHtml + '</ul>' : '')
      + '</div>'
      + '</div>';
  } catch(e) {}
}


async function _shbNavUnit(newIdx) {
  if (newIdx < 0 || newIdx >= SHB_UNITS.length) return;
  _shbSaveScroll(); // save current position before navigating
  const unit = SHB_UNITS[newIdx];
  _shbSaveProgress(unit.id, 0); // reset scroll for new unit
  await _shbRenderUnit(unit, newIdx, 0);
}

function _shbCompleteUnit(unit, unitIdx) {
  const isLast = unitIdx === SHB_UNITS.length - 1;
  if (isLast) {
    // Completed the whole book!
    _shbSaveProgress('intro', 0); // reset to beginning
    if (!user.shbCompleted) user.shbCompleted = 0;
    user.shbCompleted++;
    saveUser();
    fire('Sha\'ar HaBitachon complete', 'done');
    closeChabadPanel();
    return;
  }
  // Advance to next unit
  const nextUnit = SHB_UNITS[unitIdx + 1];
  _shbSaveProgress(nextUnit.id, 0);
  _shbRenderUnit(nextUnit, unitIdx + 1, 0);
  // Scroll to top
  const reader = document.getElementById('native-reader');
  if (reader) reader.scrollTop = 0;
}

// ════════════════════════════════════════════════════════════════════════════
// END ZONE SHB
// ════════════════════════════════════════════════════════════════════════════

// LIKKUTEI SICHOS
// ════════════════════════════════════════════════════════════════════

// ── Parsha name → dach.dev tocByParsha key(s) ─────────────────────────────────
// Double parshas return an array so both are fetched and shown separately
const _LS_PARSHA_MAP = {
  'Bereishit':'bereishis','Noach':'noach','Lech Lecha':'lech_lecha','Vayera':'vayera',
  'Chayei Sara':'chayei_sarah','Toldot':'toldos','Vayetzei':'vayetzei','Vayishlach':'vayishlach',
  'Vayeshev':'vayeshev','Miketz':'miketz','Vayigash':'vayigash','Vayechi':'vayechi',
  'Shemot':'shemos','Vaera':'vaeira','Bo':'bo','Beshalach':'beshalach',
  'Yitro':'yisro','Mishpatim':'mishpatim','Terumah':'terumah','Tetzaveh':'tetzaveh',
  'Ki Tisa':'ki_sisa','Vayakhel':'vayakhel','Pekudei':'pekudei',
  'Vayakhel-Pekudei':['vayakhel','pekudei'],
  'Vayikra':'vayikra','Tzav':'tzav','Shemini':'shmini','Tazria':'tazria','Metzora':'metzora',
  'Tazria-Metzora':['tazria','metzora'],
  'Acharei Mot':'acharei_mos','Kedoshim':'kedoshim',
  'Acharei Mot-Kedoshim':['acharei_mos','kedoshim'],
  'Emor':'emor','Behar':'behar','Bechukotai':'bechukosai',
  'Behar-Bechukotai':['behar','bechukosai'],
  'Bamidbar':'bamidbar','Nasso':'naso',"Beha'alotcha":'behaaloscha','Shelach':'shlach',
  'Korach':'korach','Chukat':'chukas','Balak':'balak',
  'Chukat-Balak':['chukas','balak'],
  'Pinchas':'pinchas','Matot':'matos','Masei':'masei',
  'Matot-Masei':['matos','masei'],
  'Devarim':'devarim','Vaetchanan':'vaeschanan','Eikev':'eikev',"Re'eh":'reeh',
  'Shoftim':'shoftim','Ki Teitzei':'ki_seitzei','Ki Tavo':'ki_savo',
  'Nitzavim':'nitzavim','Vayeilech':'vayelech',
  'Nitzavim-Vayeilech':['nitzavim','vayelech'],
  'Haazinu':'haazinu','Vezot Haberakhah':'vzos_habrachah',
};
const _LS_PARSHA_HEB = {
  'bereishis':'בראשית','noach':'נח','lech_lecha':'לך לך','vayera':'וירא',
  'chayei_sarah':'חיי שרה','toldos':'תולדות','vayetzei':'ויצא','vayishlach':'וישלח',
  'vayeshev':'וישב','miketz':'מקץ','vayigash':'ויגש','vayechi':'ויחי',
  'shemos':'שמות','vaeira':'וארא','bo':'בא','beshalach':'בשלח',
  'yisro':'יתרו','mishpatim':'משפטים','terumah':'תרומה','tetzaveh':'תצוה',
  'ki_sisa':'כי תשא','vayakhel':'ויקהל','pekudei':'פקודי',
  'vayikra':'ויקרא','tzav':'צו','shmini':'שמיני','tazria':'תזריע','metzora':'מצורע',
  'acharei_mos':'אחרי מות','kedoshim':'קדושים','emor':'אמור','behar':'בהר','bechukosai':'בחוקותי',
  'bamidbar':'במדבר','naso':'נשא','behaaloscha':'בהעלותך','shlach':'שלח',
  'korach':'קרח','chukas':'חוקת','balak':'בלק','pinchas':'פינחס','matos':'מטות','masei':'מסעי',
  'devarim':'דברים','vaeschanan':'ואתחנן','eikev':'עקב','reeh':'ראה',
  'shoftim':'שופטים','ki_seitzei':'כי תצא','ki_savo':'כי תבוא',
  'nitzavim':'נצבים','vayelech':'וילך','haazinu':'האזינו','vzos_habrachah':'וזאת הברכה',
};
const _LS_GEM = ['','א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב','יג','יד','טו','טז','יז','יח','יט','כ','כא','כב','כג','כד','כה','כו','כז','כח','כט','ל','לא','לב','לג','לד','לה','לו','לז','לח','לט'];
const _LS_SETS = [
  {id:'1-2',heb:'א–ב',en:'1–2'},  {id:'3-4',heb:'ג–ד',en:'3–4'},
  {id:'5-9',heb:'ה–ט',en:'5–9'},  {id:'10-14',heb:'י–יד',en:'10–14'},
  {id:'15-19',heb:'טו–יט',en:'15–19'},{id:'20-24',heb:'כ–כד',en:'20–24'},
  {id:'25-29',heb:'כה–כט',en:'25–29'},{id:'30-34',heb:'ל–לד',en:'30–34'},
  {id:'35-39',heb:'לה–לט',en:'35–39'},
];

function _lsParshaKeys(parshaEn) {
  const val = _LS_PARSHA_MAP[parshaEn];
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}
function _lsParshaHeb(key) { return _LS_PARSHA_HEB[key] || key; }

// ── Preferences ───────────────────────────────────────────────────────────────
// mode: 'all' = all volumes per parsha | 'sets' = user-chosen volume sets
// sets: JSON array of set IDs e.g. ['1-2','5-9']
function _lsGetMode()   { try { return localStorage.getItem('ls_mode') || null; } catch { return null; } }
function _lsGetSets()   { try { return JSON.parse(localStorage.getItem('ls_sets') || '[]'); } catch { return []; } }
function _lsSavePrefs(mode, sets) {
  try { localStorage.setItem('ls_mode', mode); localStorage.setItem('ls_sets', JSON.stringify(sets)); } catch {}
}

// ── State ──────────────────────────────────────────────────────────────────────
let _lsSichos   = [];   // flat list currently shown
let _lsCurIdx   = 0;
let _lsFnMap    = {};
let _lsInReader = false;
// Restore translation mode preference
_lsTransMode = localStorage.getItem('ls_trans_mode') === '1';
let _lsScrollTimer = null;
let _lsActiveParshaDivs = []; // keys for current week (for grouped display)
// Expose to window so onReaderScroll (defined earlier) can access
Object.defineProperty(window, '_lsSichos',   {get:()=>_lsSichos,   set:v=>{_lsSichos=v;}});
Object.defineProperty(window, '_lsCurIdx',   {get:()=>_lsCurIdx,   set:v=>{_lsCurIdx=v;}});
Object.defineProperty(window, '_lsInReader', {get:()=>_lsInReader, set:v=>{_lsInReader=v;}});

function _lsSaveScroll(cid, pos) { try { localStorage.setItem('ls_s_'+cid, String(Math.round(pos))); } catch {} }
function _lsLoadScroll(cid)      { try { return parseInt(localStorage.getItem('ls_s_'+cid)||'0')||0; } catch { return 0; } }

// ── Firebase (dach.dev) ───────────────────────────────────────────────────────
let _lsDb = null;
async function _getLsDb() {
  if (_lsDb) return _lsDb;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const cfg = {apiKey:'AIzaSyCYqa2tVY0YaM4noiT2R_ZJbFMJVE_AuCg',authDomain:'dach-dev.firebaseapp.com',projectId:'dach-dev',storageBucket:'dach-dev.firebasestorage.app',messagingSenderId:'505952629847',appId:'1:505952629847:web:34ec779e3cda8d73385f12'};
  const existing = getApps().find(a => a.name === 'dach');
  _lsDb = getFirestore(existing || initializeApp(cfg, 'dach'));
  return _lsDb;
}
async function _lsGetDoc(path) {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  return getDoc(doc(await _getLsDb(), path));
}

// ── Entry point (called from openExtraReader) ──────────────────────────────────
async function _openLSSichaList() {
  _lsInReader = false;
  window._lsHandleClose = function() { return false; }; // X = close panel normally
  document.getElementById('ls-nav-bar')?.remove();

  // First time? Show onboarding prompt instead of list
  if (!_lsGetMode()) {
    _lsShowOnboarding();
    return;
  }

  const d = appNow(); d.setDate(d.getDate() + (dayOffset||0));
  const parshaEn   = getParshaForDate(d);
  const parshaKeys = parshaEn ? _lsParshaKeys(parshaEn) : [];
  const mode       = _lsGetMode();
  const userSets   = _lsGetSets(); // array like ['1-2','5-9']

  _lsActiveParshaDivs = parshaKeys;

  document.getElementById('chabad-panel-title').textContent = 'לקוטי שיחות';
  document.getElementById('chabad-panel-sub').textContent   = 'Sichos of the week';

  // Hide mark-done at list level
  const markBtn = document.getElementById('chabad-mark-btn');
  if (markBtn) markBtn.style.display = 'none';
  // Hide progress bar at list level (shown when entering a sicha)
  const progWrapLS = document.getElementById('reader-progress-wrap');
  if (progWrapLS) progWrapLS.style.display = 'none';

  const contEl = document.getElementById('native-reader-content');
  const loadEl = document.getElementById('native-reader-loading');
  if (loadEl) loadEl.style.display = 'none';
  if (contEl) { contEl.style.display = 'block'; contEl.dataset.sectionId = 'likkuteiSichos'; }

  if (!parshaKeys.length) {
    if (contEl) contEl.innerHTML = '<p style="padding:24px;color:var(--t3);text-align:center;">Parsha not available.</p>';
    return;
  }

  if (contEl) contEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:60px 20px;"><div class="spinner" style="border-top-color:#8E6AA3;"></div></div>';

  try {
    // Fetch each parsha separately so we can group them
    const parshaGroups = []; // [{key, heb, items:[]}]
    for (const key of parshaKeys) {
      const snap = await _lsGetDoc('books/likkuteiSichos/tocByParsha/' + key);
      if (!snap.exists()) continue;
      let items = Object.entries(snap.data())
        .sort(([a],[b]) => parseInt(a)-parseInt(b))
        .map(([,v]) => v).filter(it => it && it.title)
        .sort((a,b) => (a.vol||0)-(b.vol||0)||(a.page||0)-(b.page||0));
      // Filter by sets if in sets mode
      if (mode === 'sets' && userSets.length) {
        items = items.filter(it => {
          const v = it.vol || 0;
          return userSets.some(sid => {
            const [lo,hi] = sid.split('-').map(Number);
            return v >= lo && v <= hi;
          });
        });
      }
      if (items.length) parshaGroups.push({key, heb: _lsParshaHeb(key), items});
    }

    // Build flat list for reader navigation (across all parsha groups)
    _lsSichos = parshaGroups.flatMap(g => g.items);

    const totalCount = _lsSichos.length;
    const modeLabel  = mode === 'sets' && userSets.length
      ? 'Vols. ' + userSets.map(s => _LS_SETS.find(x=>x.id===s)?.en || s).join(', ')
      : 'All volumes';
    document.getElementById('chabad-panel-sub').textContent = parshaKeys.map(k => _lsParshaHeb(k)).join(' · ');

    // Mode/set change button
    const changeBtnHtml = '<button onclick="_lsOpenSetPicker(false)" style="display:flex;align-items:center;justify-content:space-between;margin:0 16px 14px;padding:9px 14px;border-radius:10px;background:rgba(142,106,163,.07);border:1px solid rgba(142,106,163,.2);color:var(--t1);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;width:calc(100% - 32px);">'
      + '<span style="color:var(--t3);">Showing: <b style="color:#8E6AA3;">' + modeLabel + '</b></span>'
      + '<span style="color:#8E6AA3;font-weight:700;">Change →</span>'
      + '</button>';

    // Build HTML with parsha sections
    let html = '<div style="padding:14px 16px 60px;">' + changeBtnHtml;
    parshaGroups.forEach(group => {
      // Parsha section header (only if >1 parsha)
      if (parshaGroups.length > 1) {
        html += '<div style="font-family:\'Frank Ruhl Libre\',serif;font-size:19px;font-weight:700;color:var(--t1);padding:14px 0 10px;margin-bottom:12px;border-bottom:2px solid rgba(142,106,163,.25);">'
          + group.heb + '</div>';
      }
      // Group by volume within this parsha
      const byVol = {};
      group.items.forEach(it => { const v=it.vol; if(!byVol[v]) byVol[v]=[]; byVol[v].push(it); });
      Object.keys(byVol).map(Number).sort((a,b)=>a-b).forEach(v => {
        html += '<div style="font-size:var(--fs-1);font-weight:700;color:var(--t3);padding:12px 0 7px;border-bottom:1px solid var(--border);margin-bottom:8px;">חלק ' + _LS_GEM[v] + '</div>';
        byVol[v].forEach((it, i) => {
          const cid    = it.page+'_'+it.vol;
          const saved  = _lsLoadScroll(cid);
          const inProg = saved > 50 && saved !== -1;
          const isDone = saved === -1;
          const rowIdx = _lsSichos.indexOf(it);
          html += '<div onclick="_lsOpenReader('+rowIdx+')" style="background:var(--card);border:1px solid '+(isDone?'rgba(110,145,80,.3)':inProg?'rgba(142,106,163,.4)':'var(--border)')+';border-radius:12px;padding:12px 13px;margin-bottom:7px;cursor:pointer;display:flex;align-items:flex-start;gap:10px;position:relative;overflow:hidden;" onmousedown="this.style.background=\'var(--hi)\'" onmouseup="this.style.background=\'var(--card)\'" ontouchstart="this.style.background=\'var(--hi)\'" ontouchend="this.style.background=\'var(--card)\'">'
            + (inProg ? '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#8E6AA3;border-radius:12px 0 0 12px;"></div>' : '')
            + (isDone ? '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--green);border-radius:12px 0 0 12px;"></div>' : '')
            + '<div style="width:22px;height:22px;border-radius:var(--r-s);flex-shrink:0;background:'+(isDone?'rgba(110,145,80,.1)':inProg?'rgba(142,106,163,.1)':'var(--surface)')+';border:1px solid '+(isDone?'rgba(110,145,80,.3)':inProg?'rgba(142,106,163,.3)':'var(--border)')+';display:flex;align-items:center;justify-content:center;font-size:var(--fs-1);font-weight:800;color:'+(isDone?'var(--green)':inProg?'#8E6AA3':'var(--t3)')+';margin-top:2px;direction:ltr;">'+(isDone?'✓':i+1)+'</div>'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-family:\'Frank Ruhl Libre\',serif;font-size:14px;color:var(--t1);line-height:1.4;direction:rtl;text-align:right;">'+it.title+'</div>'
            + '<div style="font-size:var(--fs-1);color:var(--t3);margin-top:3px;direction:ltr;">Vol. '+it.vol+' · pg. '+it.page+'</div>'
            + (it.summary ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;line-height:1.45;direction:rtl;text-align:right;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+it.summary+'</div>' : '')
            + (isDone ? '<div style="font-size:var(--fs-1);font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(110,145,80,.1);color:var(--green);margin-top:5px;display:inline-block;">✓ Read</div>' : '')
            + (inProg ? '<div style="font-size:var(--fs-1);font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(142,106,163,.1);color:#8E6AA3;margin-top:5px;display:inline-flex;align-items:center;gap:3px;"><svg width="7" height="8" viewBox="0 0 8 9" fill="#8E6AA3"><path d="M1 1l6 3.5L1 8V1z"/></svg>In progress</div>' : '')
            + '</div></div>';
        });
      });
    });
    html += '</div><div id="reader-bottom-sentinel" style="height:1px;"></div>';

    if (contEl) contEl.innerHTML = html;
    unlockMarkDone();

  } catch(e) {
    console.error('LS list error:', e);
    if (contEl) contEl.innerHTML = '<p style="padding:24px;color:var(--t3);text-align:center;">'+e.message+'</p>';
  }
}

// ── First-time onboarding ──────────────────────────────────────────────────────
function _lsShowOnboarding() {
  document.getElementById('chabad-panel-title').textContent = 'לקוטי שיחות';
  document.getElementById('chabad-panel-sub').textContent   = 'Set up your learning';
  const markBtn = document.getElementById('chabad-mark-btn');
  if (markBtn) markBtn.style.display = 'none';

  const contEl = document.getElementById('native-reader-content');
  const loadEl = document.getElementById('native-reader-loading');
  if (loadEl) loadEl.style.display = 'none';
  if (contEl) { contEl.style.display = 'block'; contEl.dataset.sectionId = 'likkuteiSichos'; }

  const setGrid = _LS_SETS.map(s =>
    '<button id="ls-ob-set-'+s.id+'" onclick="_lsObToggleSet(\''+s.id+'\')" style="padding:10px 6px;border-radius:10px;background:var(--card);border:1.5px solid var(--border);cursor:pointer;font-family:inherit;text-align:center;transition:all .15s;">'
    + '<div style="font-family:\'Frank Ruhl Libre\',serif;font-size:15px;font-weight:700;color:var(--t1);margin-bottom:2px;">'+s.heb+'</div>'
    + '<div style="font-size:var(--fs-1);color:var(--t3);">Vols. '+s.en+'</div>'
    + '</button>'
  ).join('');

  if (contEl) contEl.innerHTML = '<div style="padding:24px 20px 60px;">'
    + '<div style="width:48px;height:48px;border-radius:var(--r-m);background:rgba(142,106,163,.12);border:1px solid rgba(142,106,163,.25);display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:#8E6AA3;">'
    + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>'
    + '</div>'
    + '<p style="font-size:var(--fs-5);font-weight:900;color:var(--t1);margin-bottom:8px;letter-spacing:-.3px;">How do you want to learn?</p>'
    + '<p style="font-size:var(--fs-2);color:var(--t2);line-height:1.6;margin-bottom:24px;">Each week, the app shows you the Rebbe\'s sichos on that week\'s parsha. Choose what appears in your feed.</p>'
    // Option A
    + '<div id="ls-ob-all" onclick="_lsObPickMode(\'all\')" style="background:rgba(142,106,163,.08);border:1.5px solid #8E6AA3;border-radius:14px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all .15s;">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">'
    + '<div style="width:20px;height:20px;border-radius:50%;background:#8E6AA3;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>'
    + '<p style="font-size:var(--fs-3);font-weight:800;color:var(--t1);">All volumes</p>'
    + '</div>'
    + '<p style="font-size:var(--fs-1);color:var(--t2);line-height:1.5;padding-left:30px;">See every sicha across all 39 volumes for this week\'s parsha. You choose which one to learn.</p>'
    + '</div>'
    // Option B
    + '<div id="ls-ob-sets" onclick="_lsObPickMode(\'sets\')" style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;cursor:pointer;transition:all .15s;">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">'
    + '<div id="ls-ob-sets-check" style="width:20px;height:20px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;"></div>'
    + '<p style="font-size:var(--fs-3);font-weight:800;color:var(--t1);">Follow specific volumes</p>'
    + '</div>'
    + '<p style="font-size:var(--fs-1);color:var(--t2);line-height:1.5;padding-left:30px;">Pick one or more sets of volumes. Only those sichos appear each week — great for learning through a chelek systematically.</p>'
    // Set grid (hidden initially)
    + '<div id="ls-ob-setgrid" style="display:none;margin-top:14px;"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;">'+setGrid+'</div></div>'
    + '</div>'
    + '<button onclick="_lsObConfirm()" id="ls-ob-confirm" style="width:100%;padding:15px;border-radius:14px;background:#8E6AA3;border:none;color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:-.2px;">Start Learning →</button>'
    + '</div>';

  // State for onboarding
  window._lsObMode     = 'all';
  window._lsObSets     = [];
}

window._lsObPickMode = function(mode) {
  window._lsObMode = mode;
  const allCard  = document.getElementById('ls-ob-all');
  const setsCard = document.getElementById('ls-ob-sets');
  const setsCheck= document.getElementById('ls-ob-sets-check');
  const setGrid  = document.getElementById('ls-ob-setgrid');
  if (mode === 'all') {
    if (allCard)  { allCard.style.background='rgba(142,106,163,.08)'; allCard.style.borderColor='#8E6AA3'; }
    if (setsCard) { setsCard.style.background='var(--card)'; setsCard.style.borderColor='var(--border)'; }
    if (setsCheck){ setsCheck.style.background='var(--border)'; setsCheck.innerHTML=''; }
    if (setGrid)  setGrid.style.display='none';
  } else {
    if (allCard)  { allCard.style.background='var(--card)'; allCard.style.borderColor='var(--border)'; }
    // Remove checkmark from all-card
    allCard.querySelector('div').style.background='var(--border)';
    allCard.querySelector('div').innerHTML='';
    if (setsCard) { setsCard.style.background='rgba(142,106,163,.08)'; setsCard.style.borderColor='#8E6AA3'; }
    if (setsCheck){ setsCheck.style.background='#8E6AA3'; setsCheck.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>'; }
    if (setGrid)  setGrid.style.display='block';
  }
};

window._lsObToggleSet = function(id) {
  if (!window._lsObSets) window._lsObSets = [];
  const idx = window._lsObSets.indexOf(id);
  if (idx === -1) { window._lsObSets.push(id); }
  else            { window._lsObSets.splice(idx, 1); }
  // Update button style
  const btn = document.getElementById('ls-ob-set-'+id);
  const on  = window._lsObSets.includes(id);
  if (btn) {
    btn.style.background   = on ? 'rgba(142,106,163,.12)' : 'var(--card)';
    btn.style.borderColor  = on ? '#8E6AA3' : 'var(--border)';
    btn.querySelector('div').style.color = on ? '#8E6AA3' : 'var(--t1)';
  }
  // Make sure mode is 'sets'
  window._lsObPickMode('sets');
};

window._lsObConfirm = function() {
  const mode = window._lsObMode || 'all';
  const sets = (mode === 'sets' && window._lsObSets?.length) ? window._lsObSets : [];
  if (mode === 'sets' && !sets.length) {
    fire('Choose at least one set', 'xp');
    return;
  }
  _lsSavePrefs(mode, sets);
  _openLSSichaList();
};

// ── Set picker (change from sicha list) ───────────────────────────────────────
function _lsOpenSetPicker(isOnboarding) {
  const mode    = _lsGetMode() || 'all';
  const curSets = _lsGetSets();

  const setGrid = _LS_SETS.map(s => {
    const on = curSets.includes(s.id);
    return '<button id="lsp-set-'+s.id+'" onclick="_lspToggleSet(\''+s.id+'\')" style="padding:10px 6px;border-radius:10px;background:'+(on?'rgba(142,106,163,.12)':'var(--card)')+';border:1.5px solid '+(on?'#8E6AA3':'var(--border)')+';cursor:pointer;font-family:inherit;text-align:center;">'
      + '<div style="font-family:\'Frank Ruhl Libre\',serif;font-size:15px;font-weight:700;color:'+(on?'#8E6AA3':'var(--t1)')+';margin-bottom:2px;">'+s.heb+'</div>'
      + '<div style="font-size:var(--fs-1);color:var(--t3);">Vols. '+s.en+'</div>'
      + '</button>';
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'ls-set-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  modal.innerHTML = '<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:430px;padding:20px 20px 36px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<p style="font-size:var(--fs-4);font-weight:800;color:var(--t1);">Learning mode</p>'
    + '<button onclick="document.getElementById(\'ls-set-modal\').remove()" style="width:30px;height:30px;border-radius:50%;background:var(--surface);border:none;font-size:18px;cursor:pointer;color:var(--t2);">×</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;">'
    + '<button id="lsp-mode-all" onclick="_lspPickMode(\'all\')" style="padding:12px;border-radius:12px;background:'+(mode==='all'?'rgba(142,106,163,.12)':'var(--card)')+';border:1.5px solid '+(mode==='all'?'#8E6AA3':'var(--border)')+';cursor:pointer;font-family:inherit;text-align:left;transition:all .15s;">'
    + '<div style="font-size:var(--fs-2);font-weight:800;color:'+(mode==='all'?'#8E6AA3':'var(--t1)')+';margin-bottom:3px;">All volumes</div>'
    + '<div style="font-size:var(--fs-1);color:var(--t3);line-height:1.4;">Every sicha for the parsha</div>'
    + '</button>'
    + '<button id="lsp-mode-sets" onclick="_lspPickMode(\'sets\')" style="padding:12px;border-radius:12px;background:'+(mode==='sets'?'rgba(142,106,163,.12)':'var(--card)')+';border:1.5px solid '+(mode==='sets'?'#8E6AA3':'var(--border)')+';cursor:pointer;font-family:inherit;text-align:left;transition:all .15s;">'
    + '<div style="font-size:var(--fs-2);font-weight:800;color:'+(mode==='sets'?'#8E6AA3':'var(--t1)')+';margin-bottom:3px;">Follow sets</div>'
    + '<div style="font-size:var(--fs-1);color:var(--t3);line-height:1.4;">Choose volume sets below</div>'
    + '</button>'
    + '</div>'
    + '<p style="font-size:var(--fs-1);font-weight:700;color:var(--t3);margin-bottom:10px;">Select sets (tap to toggle)</p>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-bottom:18px;">' + setGrid + '</div>'
    + '<button onclick="_lspConfirm()" style="width:100%;padding:14px;border-radius:14px;background:#8E6AA3;border:none;color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;">Save →</button>'
    + '</div>';
  document.body.appendChild(modal);

  // Temp state for picker
  window._lspMode = mode;
  window._lspSets = [...curSets];
}

window._lspPickMode = function(m) {
  window._lspMode = m;
  ['all','sets'].forEach(x => {
    const b = document.getElementById('lsp-mode-'+x);
    if (!b) return;
    const on = x === m;
    b.style.background  = on ? 'rgba(142,106,163,.12)' : 'var(--card)';
    b.style.borderColor = on ? '#8E6AA3' : 'var(--border)';
    b.querySelector('div').style.color = on ? '#8E6AA3' : 'var(--t1)';
  });
};

window._lspToggleSet = function(id) {
  if (!window._lspSets) window._lspSets = [];
  const idx = window._lspSets.indexOf(id);
  if (idx === -1) window._lspSets.push(id);
  else window._lspSets.splice(idx, 1);
  const btn = document.getElementById('lsp-set-'+id);
  const on  = window._lspSets.includes(id);
  if (btn) {
    btn.style.background  = on ? 'rgba(142,106,163,.12)' : 'var(--card)';
    btn.style.borderColor = on ? '#8E6AA3' : 'var(--border)';
    btn.querySelector('div').style.color = on ? '#8E6AA3' : 'var(--t1)';
  }
  if (on) _lspPickMode('sets'); // auto-switch to sets mode
};

window._lspConfirm = function() {
  const mode = window._lspMode || 'all';
  const sets = (mode === 'sets' && window._lspSets?.length) ? window._lspSets : [];
  if (mode === 'sets' && !sets.length) { fire('Choose at least one set', 'xp'); return; }
  _lsSavePrefs(mode, sets);
  document.getElementById('ls-set-modal')?.remove();
  _openLSSichaList();
};

// ── Open sicha reader ─────────────────────────────────────────────────────────
async function _lsOpenReader(idx) {
  _lsCurIdx   = idx;
  _lsInReader = true;
  window._readerActiveSid = 'likkuteiSichos';

  // When in reader, X = go back to list
  window._lsHandleClose = function() {
    if (_lsInReader) {
      _lsInReader = false;
      _lsBackToList();
      return true;
    }
    return false;
  };

  const item = _lsSichos[idx];
  if (!item) return;

  const cid        = item.page + '_' + item.vol;
  const d          = appNow(); d.setDate(d.getDate() + (dayOffset||0));
  const parshaEn   = getParshaForDate(d);
  const parshaHeb  = parshaEn ? _lsParshaKeys(parshaEn).map(k => _lsParshaHeb(k)).join(' · ') : '';

  document.getElementById('chabad-panel-title').textContent = item.title || 'שיחה';
  document.getElementById('chabad-panel-sub').textContent   = parshaHeb + ' · חלק ' + (_LS_GEM[item.vol]||item.vol);

  // Mark-done for this sicha
  const markBtn   = document.getElementById('chabad-mark-btn');
  const markLabel = document.getElementById('chabad-mark-label');
  const markXp    = document.getElementById('chabad-mark-xp');
  const isDone    = _lsLoadScroll(cid) === -1;
  if (markBtn) {
    markBtn.style.display  = 'flex';
    markBtn.dataset.sectionId = 'likkuteiSichos';
    if (isDone) {
      markBtn.dataset.state = 'done';
      markBtn.style.cursor     = 'default';
      if (markLabel) markLabel.textContent = 'Learned';
      if (markXp)    markXp.textContent    = '';
      markBtn.onclick = null;
    } else {
      markBtn.style.background = '#8E6AA3';
      markBtn.style.border     = 'none';
      markBtn.style.color      = '#fff';
      markBtn.style.cursor     = 'pointer';
      if (markLabel) markLabel.textContent = 'Mark as learned';
      if (markXp)    markXp.textContent    = '';
      markBtn.onclick = () => {
        _lsSaveScroll(cid, -1);
        markBtn.dataset.state = 'done';
        markBtn.style.cursor     = 'default';
        if (markLabel) markLabel.textContent = 'Learned';
        markBtn.onclick = null;
        fire('Sicha marked read', 'xp');
      };
    }
  }

  // Progress bar — show and make purple
  const progWrap = document.getElementById('reader-progress-wrap');
  const progBar  = document.getElementById('reader-progress-bar');
  if (progWrap) progWrap.style.display = 'block';
  if (progBar)  { progBar.style.background = '#8E6AA3'; progBar.style.width = '0%'; }

  // Show font controls for LS reader
  const fontCtrl = document.getElementById('reader-font-controls');
  if (fontCtrl) fontCtrl.style.display = 'flex';

  // Render nav bar
  _lsRenderNavBar(parshaHeb, idx);

  const contEl = document.getElementById('native-reader-content');
  if (contEl) {
    contEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:60px 20px;"><div class="spinner" style="border-top-color:#8E6AA3;"></div></div>';
    contEl.dataset.sectionId = 'likkuteiSichos';
  }

  try {
    const snap = await _lsGetDoc('books/likkuteiSichos/sichos/' + cid);
    if (!snap.exists()) throw new Error('Sicha not found.');
    const data = snap.data();

    const fns = _lsParseFn(data.footnotes || '');
    _lsFnMap  = {};
    fns.forEach(f => _lsFnMap[f.num] = f.text);

    // ── Pre-detect pasuk text in body (before spans injected) ──────────────
    // For each footnote that has a parseable source, fetch the pasuk and
    // find its text in the sicha body — much more robust than quote detection
    window._lsQuoteMap = {};
    window._lsPasukTextMap = {}; // phrase → { fnNum, src, key }

    const rawStripped = (data.mainText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // Run async detection in background — don't block render
    (async () => {
      const strip = s => s
        .replace(/\u05BE/g, ' ')         // maqaf → space first
        .replace(/[\u0591-\u05C7]/g, '') // strip nikud/cantillation
        .replace(/\s+/g, ' ').trim();

      for (const [numStr, src] of Object.entries(_lsFnMap)) {
        const ref = _parsePasukRef(src);
        if (!ref) continue;
        if (_detectSourceType(src) === 'skip') continue;
        if (_detectSourceType(src) === 'talmud') continue;
        if (_detectSourceType(src) === 'yerushalmi') continue;

        try {
          const pasuk = await _fetchPasuk(ref.book, ref.ch, ref.v, ref.isTalmud, ref.key);
          if (!pasuk?.he) continue;

          const heClean = strip(pasuk.he);
          const words = heClean.split(' ').filter(w => w.length > 1);

          // Try 4-word windows down to 3 minimum — 2 words too generic
          let found = null;
          for (let len = 4; len >= 3; len--) {
            for (let i = 0; i <= words.length - len; i++) {
              const phrase = words.slice(i, i + len).join(' ');
              if (phrase.length < 8) continue; // min 8 chars to avoid common short phrases
              if (rawStripped.includes(phrase)) {
                found = phrase;
                break;
              }
            }
            if (found) break;
          }

          if (found) {
            window._lsPasukTextMap[found] = {
              fnNum: parseInt(numStr),
              src,
              key: ref.key,
              isTalmud: ref.isTalmud,
              pasuk // cache the already-fetched pasuk
            };
          }
        } catch(e) {}
      }

      // Now apply squiggles if translation mode is on and reader is still showing
      if (_lsTransMode && document.getElementById('ls-body-wrap')) {
        _lsApplyPasukSquiggles(_lsFnMap);
      }
    })();

    const body = _lsLinkify(data.mainText || '');

    const fnSection = fns.length
      ? '<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border);">'
        + '<div style="font-size:var(--fs-1);font-weight:700;color:var(--t3);margin-bottom:9px;">הערות ('+fns.length+')</div>'
        + fns.map(f => '<div id="ls-fn-'+f.num+'" class="ls-fn-entry">'
            + '<div class="ls-fn-entry-num">'+f.num+'</div>'
            + '<div class="ls-fn-entry-text">'+f.text+'</div>'
            + '</div>').join('')
        + '</div>'
      : '';

    // Build reader HTML — two-column layout on wide screens, single on mobile
    const html = '<div style="padding:18px 16px 100px;">'
      + '<div style="font-size:var(--fs-1);font-weight:700;color:#8E6AA3;margin-bottom:7px;">'+parshaHeb+'</div>'
      + '<div style="font-family:\'Frank Ruhl Libre\',serif;font-size:22px;font-weight:700;color:var(--t1);line-height:1.3;margin-bottom:4px;direction:rtl;">'+(item.title||'שיחה')+'</div>'
      + '<div style="font-size:var(--fs-1);color:var(--t3);margin-bottom:18px;">לקוטי שיחות · חלק '+(_LS_GEM[item.vol]||item.vol)+' · עמ׳ '+item.page+'</div>'
      // Card wraps the two-column body
      + '<div id="ls-reader-card" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 16px;">'
      + '<div id="ls-body-wrap" style="font-family:\'DachHeilig\',\'Frank Ruhl Libre\',serif;">'+body+'</div>'
      + '</div>'
      + fnSection + '</div>'
      + '<div id="reader-bottom-sentinel" style="height:1px;"></div>';

    if (contEl) {
      contEl.innerHTML = html;
      contEl.onclick = e => {
        const ref = e.target.closest('.ls-fn-ref[data-lsfn]');
        if (ref) _lsShowFnPopup(parseInt(ref.dataset.lsfn), ref);
      };
      // Always hide any lingering popup from previous sicha
      _lsHideTransPopup();
      document.getElementById('ls-fn-popup')?.remove();

      // _lsFnMap is already built above from _lsParseFn — use it directly
      window._lsCurrentFnMap = _lsFnMap;
      // Apply word translations + always attach click handler
      if (_lsTransMode) {
        _lsLoadDict().then(() => {
          _lsApplyTranslations();
          // Attach click handler immediately after word translations
          const w = document.getElementById('ls-body-wrap');
          if (w) { w.removeEventListener('click', _lsWrapClick); w.addEventListener('click', _lsWrapClick); }
        });
      }
    }

    // Apply saved font size
    const savedStep = _lsGetFontStep();
    const card = document.getElementById('ls-reader-card');
    if (card) card.style.setProperty('--ls-font-size', _LS_FONT_PX[savedStep] + 'px');
    // Sync button dim state without firing toast
    (function() {
      const s = savedStep;
      const ctrl = document.getElementById('reader-font-controls');
      if (ctrl) {
        const btns = ctrl.querySelectorAll('button');
        if (btns[0]) { btns[0].style.opacity = s === 0 ? '0.35' : '1'; btns[0].style.cursor = s === 0 ? 'default' : 'pointer'; }
        if (btns[1]) { btns[1].style.opacity = s === _LS_FONT_STEPS-1 ? '0.35' : '1'; btns[1].style.cursor = s === _LS_FONT_STEPS-1 ? 'default' : 'pointer'; }
      }
    })();

    // Restore scroll — self-contained retry loop, immune to _pendingScrollRestore clears
    const savedPos = _lsLoadScroll(cid);
    if (savedPos > 0) {
      // Use a unique token so old loops from previous sicha opens don't interfere
      const restoreToken = Date.now();
      contEl._lsRestoreToken = restoreToken;
      let att = 0;
      const tryLsRestore = () => {
        if (contEl._lsRestoreToken !== restoreToken) return; // superseded
        const reader = document.getElementById('native-reader');
        if (!reader) return;
        if (reader.scrollHeight - reader.clientHeight >= savedPos - 20) {
          reader.scrollTop = savedPos;
          return;
        }
        if (att++ < 50) requestAnimationFrame(tryLsRestore); // up to ~800ms
        else reader.scrollTop = savedPos; // give up, try anyway
      };
      requestAnimationFrame(tryLsRestore);
    }

  } catch(e) {
    console.error('LS reader error:', e);
    if (contEl) contEl.innerHTML = '<p style="padding:24px;color:var(--t3);text-align:center;">'+e.message+'</p>';
  }
}

// ── Nav bar ───────────────────────────────────────────────────────────────────
function _lsRenderNavBar(parshaHeb, idx) {
  document.getElementById('ls-nav-bar')?.remove();
  const panel = document.getElementById('chabad-panel');
  const bar   = document.createElement('div');
  bar.id = 'ls-nav-bar';
  bar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding:10px 14px 20px;display:flex;align-items:center;gap:8px;z-index:10;';
  const btn = 'flex:1;padding:11px 8px;border-radius:var(--r-s);background:var(--card);border:1px solid var(--border);color:var(--t2);font-size:var(--fs-2);font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;font-family:var(--ui-font);cursor:pointer;';
  const ctr = 'flex:2;padding:11px 8px;border-radius:var(--r-s);background:rgba(142,106,163,.1);border:1px solid rgba(142,106,163,.25);color:#8E6AA3;font-size:var(--fs-1);font-weight:700;text-align:center;font-family:var(--ui-font);cursor:pointer;';
  const hasPrev = idx > 0;
  const hasNext = idx < _lsSichos.length - 1;
  bar.innerHTML = '<button onclick="_lsNavSicha(-1)" style="'+btn+(hasPrev?'':'opacity:.3;pointer-events:none;')+'">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>Prev</button>'
    + '<button onclick="_lsBackToList()" style="'+ctr+'">'+(parshaHeb||'שיחות')+' ('+(idx+1)+'/'+_lsSichos.length+')</button>'
    + '<button onclick="_lsNavSicha(1)" style="'+btn+(hasNext?'':'opacity:.3;pointer-events:none;')+'">Next'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></button>';
  panel.appendChild(bar);
}

function _lsSaveCurrentScroll() {
  const reader = document.getElementById('native-reader');
  const it = _lsSichos[_lsCurIdx];
  if (reader && it && reader.scrollTop > 0) {
    _lsSaveScroll(it.page + '_' + it.vol, reader.scrollTop);
  }
}

function _lsNavSicha(dir) {
  _lsHideTransPopup();
  document.getElementById('ls-fn-popup')?.remove();
  _lsSaveCurrentScroll();
  _lsOpenReader(_lsCurIdx + dir);
}

function _lsBackToList() {
  _lsHideTransPopup();
  document.getElementById('ls-fn-popup')?.remove();
  _lsSaveCurrentScroll();
  _lsInReader = false;
  window._lsHandleClose = function() { return false; };
  document.getElementById('ls-nav-bar')?.remove();
  const pb = document.getElementById('reader-progress-bar');
  if (pb) pb.style.background = 'var(--gold)';
  const markBtn = document.getElementById('chabad-mark-btn');
  if (markBtn) markBtn.style.display = 'none';
  const progWrap = document.getElementById('reader-progress-wrap');
  if (progWrap) progWrap.style.display = 'none';
  const fontCtrl = document.getElementById('reader-font-controls');
  if (fontCtrl) fontCtrl.style.display = 'none';
  _openLSSichaList();
}

// ── Footnotes ─────────────────────────────────────────────────────────────────
function _lsParseFn(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const s = raw.replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'");
  return s.split(/\n+(?=\d+\))/).map(p => {
    const m = p.match(/^(\d+)\)\s*([\s\S]*)/);
    if (!m) return null;
    return {num:parseInt(m[1]),text:m[2].replace(/\n/g,' ').replace(/\s+/g,' ').trim()};
  }).filter(Boolean);
}
function _lsLinkify(text) {
  return text.replace(/<sup>(\d+)<\/sup>/g, (_,n) =>
    '<span class="ls-fn-ref" data-lsfn="'+n+'">'+n+'</span>'
  );
}
async function _lsShowFnPopup(num, el) {
  const text = _lsFnMap[num];
  if (!text) return;

  // Highlight corresponding footnote entry at bottom
  document.querySelectorAll('.ls-fn-entry.hl').forEach(e => e.classList.remove('hl'));
  const fnEntry = document.getElementById('ls-fn-'+num);
  if (fnEntry) {
    fnEntry.classList.add('hl');
    setTimeout(() => fnEntry.classList.remove('hl'), 2000);
  }

  // Mark ref active
  document.querySelectorAll('.ls-fn-ref.active').forEach(r => r.classList.remove('active'));
  el.classList.add('active');

  // Get or create popup element
  let popup = document.getElementById('ls-fn-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'ls-fn-popup';
    document.body.appendChild(popup);
  }

  // Base content
  popup.innerHTML = '<div style="font-family:var(--ui-font);font-size:var(--fs-1);font-weight:800;color:var(--gold);margin-bottom:4px;direction:ltr;text-align:left;">הערה '+num+'</div>'
    + '<div style="font-family:\'DachHeilig\',\'Frank Ruhl Libre\',serif;font-size:13px;line-height:1.5;color:var(--t2);">'+text+'</div>';

  // Position first so we can measure
  popup.style.display = 'block';
  popup.style.animation = 'none';
  void popup.offsetWidth;
  popup.style.animation = '';
  const rect = el.getBoundingClientRect();
  const pw   = Math.min(285, window.innerWidth - 16);
  popup.style.maxWidth = pw + 'px';
  const ph   = popup.offsetHeight || 70;
  let left   = rect.left + rect.width/2 - pw/2;
  left       = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top    = rect.top - ph - 10;
  if (top < 60) top = rect.bottom + 10;
  popup.style.left = left + 'px';
  popup.style.top  = top + 'px';

  // If footnote has a parseable source, fetch and append English translation
  const ref = _parsePasukRef(text);
  if (ref && _detectSourceType(text) !== 'skip') {
    // Show loading indicator
    const transDiv = document.createElement('div');
    transDiv.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:var(--fs-1);color:var(--t3);font-family:var(--ui-font);';
    transDiv.textContent = 'Loading...';
    popup.appendChild(transDiv);

    try {
      const isTalmud = ref.isTalmud || _isTalmudRef(text);
      // Use cached pasuk if available
      const cached = (window._lsPasukTextMap || {})[ref.key]?.pasuk
        || _pasukCache[ref.key];
      const pasuk = cached || await _fetchPasuk(ref.book, ref.ch, ref.v, isTalmud, ref.key);

      if (pasuk?.en) {
        const srcLabel = { tanach:'', talmud:' · Steinsaltz', yerushalmi:' · Yerushalmi', midrash:' · Midrash', rashi:' · Rashi', zohar:' · Zohar' }[_detectSourceType(text)] || '';

        // For Talmud: find the specific segment matching the footnote source context
        let displayEn = pasuk.en;
        let displayHe = '';
        if (pasuk.segments?.length) {
          // Try to match quoted text from sicha against segments
          // Use the footnote text itself to find keywords
          const fnStripped = text.replace(/<[^>]+>/g,'')
            .replace(/[\u0591-\u05C7]/g,'').replace(/\u05BE/g,' ');
          // Find segment whose Hebrew appears in the footnote context
          let bestIdx = -1;
          let bestScore = 0;
          pasuk.segments.forEach((seg, i) => {
            if (!seg.he) return;
            // Score by how many words of segment appear in footnote
            const segWords = seg.he.split(/\s+/).filter(w => w.length > 2);
            const score = segWords.filter(w => fnStripped.includes(w)).length;
            if (score > bestScore) { bestScore = score; bestIdx = i; }
          });
          if (bestIdx === -1) {
            // No match — just show first 3 segments
            const slice = pasuk.segments.slice(0, 3);
            displayEn = slice.map(s => s.en).filter(Boolean).join(' ');
            displayHe = slice.map(s => s.heRaw).filter(Boolean).join(' ');
          } else {
            // Show matched segment + 1 before + 1 after for context
            const start = Math.max(0, bestIdx - 1);
            const end   = Math.min(pasuk.segments.length, bestIdx + 2);
            const slice = pasuk.segments.slice(start, end);
            displayEn = slice.map(s => s.en).filter(Boolean).join(' ');
            displayHe = slice.map(s => s.heRaw).filter(Boolean).join(' ');
          }
        }

        transDiv.innerHTML =
          '<p style="font-size:var(--fs-1);font-weight:700;color:#5B7DB0;margin-bottom:4px;">'
          + ref.ref + srcLabel + '</p>'
          + (displayHe ? '<p style="font-family:\'DachHeilig\',\'Frank Ruhl Libre\',serif;font-size:13px;line-height:1.6;direction:rtl;color:var(--t2);margin-bottom:4px;">' + displayHe + '</p>' : '')
          + '<p style="font-size:var(--fs-1);line-height:1.55;color:var(--t1);">' + displayEn + '</p>';
        // Reposition after content added
        const ph2 = popup.offsetHeight || 70;
        let top2 = rect.top - ph2 - 10;
        if (top2 < 60) top2 = rect.bottom + 10;
        popup.style.top = top2 + 'px';
      } else {
        transDiv.remove();
      }
    } catch(e) {
      transDiv.remove();
    }
  }

  // Dismiss on next tap outside
  setTimeout(() => {
    const dm = e => {
      if (!popup.contains(e.target) && !e.target.closest('.ls-fn-ref')) {
        popup.style.display = 'none';
        el.classList.remove('active');
        document.removeEventListener('click', dm, true);
        document.removeEventListener('touchstart', dm, true);
      }
    };
    document.addEventListener('click', dm, true);
    document.addEventListener('touchstart', dm, true);
  }, 10);
}

// ── Subtitle on feed card ─────────────────────────────────────────────────────
// (Called from _loadExtraSubtitle — already wired above)

