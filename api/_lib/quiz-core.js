// Quiz rules that don't need the internet — so they can be tested
// (tools/test-quiz-core.mjs). Used by api/quiz.js.

export const LEVELS = {
  quick: { count: 4, min: 3, label: 'Quick review' },
  deep:  { count: 6, min: 4, label: 'Deep dive' },
};

const CHUMASH_REF = /^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy) \d{1,3}:\d{1,3}-\d{1,3}:\d{1,3}$/;
const RAMBAM_REF  = /^Mishneh Torah, [A-Za-z' ,\-]{2,60} \d{1,3}$/;
export const TANYA_SLUG = /^Tanya,[A-Za-z_;,.'\- ]{2,80}\.\d{1,3}$/;

// Check what the app asked for. Returns { section, level, refs, key } or { error }.
// `key` identifies the exact passage + level, so everyone shares one cached quiz.
export function validateQuizRequest(body) {
  const b = body || {};
  const level = b.level;
  if (!LEVELS[level]) return { error: 'level must be "quick" or "deep"' };
  if (b.section === 'chumash') {
    const refs = b.refs;
    if (!Array.isArray(refs) || refs.length < 1 || refs.length > 2 || !refs.every(r => CHUMASH_REF.test(r)))
      return { error: 'bad Chumash ref' };
    return { section: 'chumash', level, refs, key: 'chumash|' + refs.join('|') + '|' + level };
  }
  if (b.section === 'rambam') {
    const refs = b.refs;
    if (!Array.isArray(refs) || refs.length < 1 || refs.length > 3 || !refs.every(r => RAMBAM_REF.test(r)))
      return { error: 'bad Rambam ref' };
    return { section: 'rambam', level, refs, key: 'rambam|' + refs.join('|') + '|' + level };
  }
  if (b.section === 'tanya') {
    const t = b.tanya || {};
    const start = Number(t.startVerse), end = t.endVerse == null ? null : Number(t.endVerse);
    if (!TANYA_SLUG.test(t.chapterSlug || '') || !Number.isInteger(start) || start < 1 || start > 200 ||
        (end !== null && (!Number.isInteger(end) || end < start || end > 200)))
      return { error: 'bad Tanya portion' };
    const tanya = { chapterSlug: t.chapterSlug, startVerse: start, endVerse: end };
    return { section: 'tanya', level, tanya, key: 'tanya|' + t.chapterSlug + '|' + start + '-' + (end ?? 'end') + '|' + level };
  }
  return { error: 'unknown section' };
}

// Lowercase, straight quotes, letters/numbers only — so a quote still matches
// the text when only punctuation or spacing differs
export function normalizeForMatch(s) {
  return String(s || '').toLowerCase()
    .replace(/[‘’`]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Keep only questions that are well-formed AND whose supporting quote really
// appears in the passage (so every answer is grounded in today's text).
// Options are shuffled here, so the right answer isn't always "A".
export function checkQuestions(raw, sourceText, level, random = Math.random) {
  const src = normalizeForMatch(sourceText);
  const seen = new Set();
  const good = [];
  for (const q of raw || []) {
    const question = String(q?.question || '').trim();
    const options = (q?.options || []).map(o => String(o || '').trim());
    const correct = q?.correctIndex;
    const quote = String(q?.quote || '').trim();
    const explanation = String(q?.explanation || '').trim();
    if (!question || !explanation || options.length !== 4 || options.some(o => !o)) continue;
    if (new Set(options.map(normalizeForMatch)).size !== 4) continue;          // duplicate options
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) continue;
    const nq = normalizeForMatch(quote);
    if (nq.split(' ').length < 3 || !src.includes(nq)) continue;              // not really in the text
    if (seen.has(normalizeForMatch(question))) continue;
    seen.add(normalizeForMatch(question));

    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    good.push({ q: question, options: order.map(i => options[i]), answer: order.indexOf(correct), explanation, quote });
  }
  return good.slice(0, LEVELS[level].count);
}
