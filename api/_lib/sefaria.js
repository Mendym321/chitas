// Fetch plain English text from Sefaria for the quiz (and anything else that
// needs the exact words the reader showed).
const SEFARIA = 'https://www.sefaria.org';

// Sefaria HTML → plain text, dropping translator footnotes (they can nest <i>)
export function cleanSefariaHtml(s) {
  if (!s) return '';
  let out = '', i = 0;
  const skipClose = from => {
    let depth = 1, j = from;
    while (j < s.length && depth > 0) {
      const o = s.indexOf('<i', j), c = s.indexOf('</i>', j);
      if (o !== -1 && (c === -1 || o < c)) { depth++; j = o + 2; }
      else if (c !== -1) { depth--; j = c + 4; }
      else break;
    }
    return j;
  };
  while (i < s.length) {
    const fn = s.slice(i, i + 200).match(/^<i\b[^>]*class="footnote"[^>]*>/);
    if (fn) { i = skipClose(i + fn[0].length); continue; }
    const mk = s.slice(i, i + 200).match(/^<sup\b[^>]*class="footnote-marker"[^>]*>[^<]*<\/sup>/);
    if (mk) { i += mk[0].length; continue; }
    out += s[i++];
  }
  return out.replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function flat(x) {
  if (!x) return [];
  if (typeof x === 'string') return [x];
  if (Array.isArray(x)) return x.flatMap(flat);
  return [];
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Sefaria ' + r.status);
  return r.json();
}

// English segments of a ref (one string per verse / halacha)
export async function englishSegments(ref) {
  const d = await getJson(`${SEFARIA}/api/v3/texts/${encodeURIComponent(ref)}?version=english&fill_in_missing_segments=1`);
  const v = (d.versions || []).find(x => x.language === 'en') || d.versions?.[0];
  return flat(v?.text).map(cleanSefariaHtml).filter(Boolean);
}

// A Tanya portion exactly as the reader slices it (same slug + 1-based verses)
export async function tanyaSegments(chapterSlug, startVerse, endVerse) {
  const d = await getJson(`${SEFARIA}/api/texts/${encodeURIComponent(chapterSlug)}?lang=en&context=0&commentary=0`);
  const all = flat(d.text);
  return all.slice(startVerse - 1, endVerse || all.length).map(cleanSefariaHtml).filter(Boolean);
}
