// Split a Tanya segment (Hebrew + English) into small pairs WITHOUT ever
// changing a word: the AI only says where each new piece starts (its first
// few words); we cut the ORIGINAL text there. A start we can't find is ignored.
// Tested by tools/test-tanya-split.mjs.
//
// Matching ignores what the AI might copy slightly differently: Hebrew vowels
// and cantillation, punctuation and quote styles, upper/lower case, and the
// footnote markers (FN_OPEN n FN_CLOSE) we keep in the English.

import { FN_OPEN, FN_CLOSE } from './tanya-text.js';

const MARK = /[֑-ֽֿ-ׇ]/;            // vowels + cantillation (not maqaf)
const SPACE = /[\s־‐-―-]/;               // maqaf and dashes count as a space
const DROP = /[^\p{L}\p{N}]/u;                          // anything else that isn't a letter/number

// The text reduced to letters, numbers and single spaces, with `map[i]` = the
// position in the original text of skeleton character i
function skeleton(text) {
  let s = '', map = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === FN_OPEN) { const j = text.indexOf(FN_CLOSE, i); if (j !== -1) { i = j; continue; } }
    if (MARK.test(ch)) continue;
    if (SPACE.test(ch)) { if (s && s[s.length - 1] !== ' ') { s += ' '; map.push(i); } continue; }
    if (DROP.test(ch)) continue;
    s += ch.toLowerCase(); map.push(i);
  }
  return { s, map };
}

// Where a piece starting with `phrase` begins in `text`, searching after
// position `from`: at a word boundary, and moved back over an opening quote
// or bracket so it stays with its words. -1 if not found.
function findStart(text, sk, phrase, from) {
  const p = skeleton(String(phrase || '')).s.trim();
  if (p.length < 2) return -1;
  let k = sk.s.indexOf(p);
  while (k !== -1) {
    let at = sk.map[k];
    if ((k === 0 || sk.s[k - 1] === ' ') && at > from) {
      while (at > 0 && /[“"'‘(\[״]/.test(text[at - 1])) at--;
      return at;
    }
    k = sk.s.indexOf(p, k + 1);
  }
  return -1;
}

export function applySplits(he, en, splits) {
  he = String(he || ''); en = String(en || '');
  if (!he || !en || !Array.isArray(splits)) return [{ he, en }];
  const heSk = skeleton(he), enSk = skeleton(en);
  const cuts = [{ h: 0, e: 0, heading: '' }];
  for (const sp of splits) {
    const last = cuts[cuts.length - 1];
    const h = findStart(he, heSk, sp?.he, last.h);
    const e = findStart(en, enSk, sp?.en, last.e);
    if (h > 0 && e > 0) cuts.push({ h, e, heading: String(sp?.heading || '').trim() }); // both found, in order
  }
  return cuts.map((c, i) => {
    const piece = { he: he.slice(c.h, cuts[i + 1]?.h).trim(), en: en.slice(c.e, cuts[i + 1]?.e).trim() };
    if (c.heading) piece.heading = c.heading;
    return piece;
  });
}
