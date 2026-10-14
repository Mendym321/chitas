// Split a Tanya segment (Hebrew + English) into sentence-sized pairs WITHOUT
// ever changing a word: the AI only says where each new sentence starts
// (its first few words); we cut the ORIGINAL text there. A start we can't find
// exactly is ignored. Tested by tools/test-tanya-split.mjs.

// Position of `phrase` in `text` at or after `from`, starting at a word
// boundary; -1 if not found
function findStart(text, phrase, from) {
  const p = String(phrase || '').replace(/\s+/g, ' ').trim();
  if (p.length < 2) return -1;
  let i = text.indexOf(p, from);
  while (i !== -1 && i > 0 && !/\s/.test(text[i - 1])) i = text.indexOf(p, i + 1);
  return i;
}

export function applySplits(he, en, splits) {
  he = String(he || ''); en = String(en || '');
  if (!he || !en || !Array.isArray(splits)) return [{ he, en }];
  const heCuts = [0], enCuts = [0];
  for (const sp of splits) {
    const h = findStart(he, sp?.he, heCuts[heCuts.length - 1] + 1);
    const e = findStart(en, sp?.en, enCuts[enCuts.length - 1] + 1);
    if (h > 0 && e > 0) { heCuts.push(h); enCuts.push(e); } // both found, in order
  }
  const pieces = [];
  for (let i = 0; i < heCuts.length; i++) {
    pieces.push({ he: he.slice(heCuts[i], heCuts[i + 1]).trim(), en: en.slice(enCuts[i], enCuts[i + 1]).trim() });
  }
  return pieces;
}
