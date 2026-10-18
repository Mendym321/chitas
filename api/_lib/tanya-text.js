// Sefaria's Tanya HTML → plain text for the guide.
//  - The translator's footnotes are KEPT: each note's text is pushed onto
//    `notes` and a marker FN_OPEN + index + FN_CLOSE is left in its place
//    (the app turns these into tappable numbers, same as in Rambam).
//  - A hagahah (the Alter Rebbe's note) starts with <small>; its "הגהה" /
//    "NOTE:" label is dropped because the app labels it itself.
// Tested by tools/test-tanya-split.mjs.

export const FN_OPEN = '', FN_CLOSE = '';

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', thinsp: ' ' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m);
}
const plain = s => decode(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/[\s ]+/g, ' ').trim();

// Index just past the </i> that closes an <i> opened before `from` (they can nest)
function closeOfI(s, from) {
  let depth = 1, j = from;
  while (j < s.length && depth > 0) {
    const o = s.indexOf('<i', j), c = s.indexOf('</i>', j);
    if (o !== -1 && (c === -1 || o < c)) { depth++; j = o + 2; }
    else if (c !== -1) { depth--; j = c + 4; }
    else return s.length;
  }
  return j;
}

export function cleanTanyaHtml(html, notes) {
  const s = String(html || '');
  let out = '', i = 0;
  while (i < s.length) {
    const head = s.slice(i, i + 200);
    const mk = head.match(/^<sup\b[^>]*class="[^"]*\bfootnote-marker\b[^"]*"[^>]*>[\s\S]*?<\/sup>/);
    if (mk) { i += mk[0].length; continue; }
    const fn = head.match(/^<i\b[^>]*class="(?:[^"]*\s)?footnote(?:\s[^"]*)?"[^>]*>/);
    if (fn) {
      const end = closeOfI(s, i + fn[0].length);
      const text = plain(s.slice(i + fn[0].length, end - 4));
      if (notes && text) { notes.push(text); out += FN_OPEN + (notes.length - 1) + FN_CLOSE; }
      i = end; continue;
    }
    out += s[i++];
  }
  return plain(out.replace(/<small>\s*הגהה\s*<br\s*\/?>/i, '<small>').replace(/<small>\s*NOTE:\s*/i, '<small>'));
}

export function isHagahahHtml(he, en) {
  return /^\s*<small>/i.test(he || '') || /^\s*<small>/i.test(en || '') || /^\s*הגהה/.test(plain(he || ''));
}

// The same text without footnote markers (what the AI reads)
export const withoutNotes = s => String(s || '').replace(new RegExp(FN_OPEN + '\\d+' + FN_CLOSE, 'g'), '').replace(/\s+/g, ' ').trim();
