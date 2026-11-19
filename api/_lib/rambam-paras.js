// The Rambam's Hebrew, split to match the paragraphs of its English translation.
//
// Touger's English breaks a long halacha into paragraphs (<br> on Sefaria);
// Sefaria's Hebrew has no breaks. So once per chapter the AI is asked where in
// the Hebrew each English paragraph begins (its first few Hebrew words), every
// answer is checked against the real Hebrew (hebrewStarts, vowels ignored), and
// the result is saved for everyone, for good. The text itself is never changed:
// it is only cut where a checked start was found.
//
// Saved as rambam_paras/{id}: { ref, halachot: { "3": { he: [pieces], en: [counts] } } }
//   he: the halacha's Hebrew in pieces (cleaned the way the app cleans it)
//   en: how many English paragraphs go with each piece (a paragraph whose start
//       wasn't found stays with the piece before it)
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { hebrewStarts } from './tanya-split.js';

export const MODEL = 'claude-opus-5-5';
export const PARAS_VERSION = 'v1';
const SEFARIA = 'https://www.sefaria.org';
const EN_VERSION = 'Mishneh Torah, trans. by Eliyahu Touger. Jerusalem, Moznaim Pub. c1986-c2007';
const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily/1.0)' } };

export const parasDocId = ref => Buffer.from(`${ref}|${PARAS_VERSION}`).toString('base64url');

// The Hebrew as the app shows it: no tags, single spaces
export const cleanHe = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// A halacha's English paragraphs, without the translator's footnotes
export function enParagraphs(s) {
  const noNotes = String(s || '').replace(/<sup[^>]*>.*?<\/sup>\s*<i class="footnote">.*?<\/i>/gs, '');
  return noNotes.split(/(?:\s*<br\s*\/?>\s*)+/i).map(p => p.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const flat = x => typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : [];

async function fetchChapter(ref) {
  const enc = encodeURIComponent(ref);
  const [en, he] = await Promise.all([
    fetch(`${SEFARIA}/api/v3/texts/${enc}?version=${encodeURIComponent('english|' + EN_VERSION)}&fill_in_missing_segments=1`, UA).then(r => r.json()).catch(() => null),
    fetch(`${SEFARIA}/api/texts/${enc}?context=0&commentary=0&lang=he`, UA).then(r => r.json()).catch(() => null),
  ]);
  const enText = flat(en?.versions?.find(v => v.language === 'en')?.text || en?.versions?.[0]?.text || []);
  return { en: enText, he: flat(he?.he || []) };
}

const AnswerSchema = z.object({
  halachot: z.array(z.object({ index: z.number().int(), starts: z.array(z.string()) })),
});

const SYSTEM = `You line up the Hebrew of the Rambam's Mishneh Torah with its English translation, so the app can show them side by side, paragraph by paragraph. You never change or translate anything.

Each halacha below has its Hebrew as one block, and its English divided into numbered paragraphs. For every English paragraph after the first, find where the Hebrew that it translates begins, and copy the first 3 to 6 Hebrew words from that point, exactly as they appear in the Hebrew (vowels may be left out). The starts must be in order, each after the one before. If an English paragraph has no clear starting point in the Hebrew (for example, it is the translator's own addition, or it continues a sentence that began in the paragraph before), give "" for it.

Answer with one entry per halacha: its index, and its starts, one for each English paragraph after the first (so a halacha with 3 paragraphs has 2 starts).`;

async function askAI(items) {
  const content = items.map(({ index, he, paras }) =>
    `[halacha ${index}]\nHE: ${he}\n` + paras.map((p, k) => `EN ${k + 1}: ${p}`).join('\n')).join('\n\n');
  const response = await new Anthropic().messages.parse({   // reads ANTHROPIC_API_KEY
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: 'low', format: zodOutputFormat(AnswerSchema) },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('no result (' + response.stop_reason + ')');
  return { ...response.parsed_output, usage: response.usage };
}

// The Hebrew of one halacha cut at the starts that were found, with how many
// English paragraphs go with each piece; null if nothing could be cut
export function cutHalacha(he, paraCount, starts) {
  const at = hebrewStarts(he, starts.slice(0, paraCount - 1));
  const cuts = [], en = [1];
  at.forEach(p => { if (p > 0) { cuts.push(p); en.push(1); } else en[en.length - 1]++; });
  if (!cuts.length) return null;
  const pieces = [0, ...cuts].map((c, k) => he.slice(c, cuts[k] ?? undefined).trim());
  return pieces.every(Boolean) ? { he: pieces, en } : null;
}

const costOf = u => u ? Math.round(((u.input_tokens || 0) * 4 + (u.output_tokens || 0) * 20) / 1e6 * 10000) / 10000 : null;

// Work out a chapter's splits (one AI call, or none if no halacha has paragraphs)
export async function prepareParas(ref) {
  const { en, he } = await fetchChapter(ref);
  if (!en.length || !he.length) throw Object.assign(new Error('no text for ' + ref), { status: 404 });
  const items = [];
  en.forEach((e, i) => { const paras = enParagraphs(e); if (paras.length > 1 && he[i]) items.push({ index: i + 1, he: cleanHe(he[i]), paras }); });
  const halachot = {};
  let usage = null;
  if (items.length) {
    const ai = await askAI(items);
    usage = ai.usage;
    for (const item of items) {
      const got = ai.halachot.find(h => h.index === item.index);
      const cut = got && cutHalacha(item.he, item.paras.length, got.starts);
      if (cut) halachot[item.index] = cut;
    }
  }
  return { ref, halachot, model: items.length ? MODEL : null, at: new Date().toISOString(),
    usage: { inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0, costUSD: costOf(usage) ?? 0 } };
}
