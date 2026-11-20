// The Rambam's Hebrew, split to match the paragraphs of its English translation,
// and the chapter's guide (a line on the chapter, headings, and a few
// plain-words notes after the halachos that are hard to follow). One AI call
// per chapter, saved for everyone, for good.
//
// Touger's English breaks a long halacha into paragraphs (<br> on Sefaria);
// Sefaria's Hebrew has no breaks. So once per chapter the AI is asked where in
// the Hebrew each English paragraph begins (its first few Hebrew words), every
// answer is checked against the real Hebrew (hebrewStarts, vowels ignored), and
// the result is saved for everyone, for good. The text itself is never changed:
// it is only cut where a checked start was found.
//
// Saved as rambam_paras/{id}: { ref, halachot: { "3": { he: [pieces], en: [counts] } },
//   guide: { about, heads: [[n, heading]], notes: { "6": { text, term } } } }
//   he: the halacha's Hebrew in pieces (cleaned the way the app cleans it)
//   en: how many English paragraphs go with each piece (a paragraph whose start
//       wasn't found stays with the piece before it)
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { hebrewStarts } from './tanya-split.js';

export const MODEL = 'claude-opus-5-5';
export const PARAS_VERSION = 'v2';   // v2 = with the chapter's guide
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
  about: z.string(),
  heads: z.array(z.object({ index: z.number().int(), heading: z.string() })),
  notes: z.array(z.object({ index: z.number().int(), text: z.string(), term: z.string() })),
});

const SYSTEM = `You help people who learn the Rambam's Mishneh Torah every day, many of them beginners, read today's chapter. The app shows the Hebrew and its English translation side by side. You never change or translate the text; you line it up, and write a light guide around it.

1. LINING UP ("halachot"). Each halacha has its Hebrew as one block and its English divided into numbered paragraphs. For every English paragraph after the first, find where the Hebrew that it translates begins, and copy the first 3 to 6 Hebrew words from that point, exactly as they appear in the Hebrew (vowels may be left out). The starts must be in order, each after the one before. If an English paragraph has no clear starting point in the Hebrew (the translator's own addition, or a sentence carried over from the paragraph before), give "" for it. List every halacha: its index and its starts, one for each English paragraph after the first (none for a halacha with one paragraph).

2. "about": one line, under 35 words, on what the chapter covers, its topics in order (for example "The mitzvah to pay a worker on time, for his life depends on it; when it applies, hiring through an agent, and settling disputes over wages.").

3. "heads": short headings, 2 to 7 plain English words, at the halachos where a new topic begins, roughly every 2 to 4 halachos, the first at halacha 1 (for example "Pay on time", "When it doesn't apply", "Disputes over wages").

4. "notes": plain words after the halachos that are hard to follow, the way the explanatory notes in a good edition help. A note says the ruling of that halacha in plain words, with its reason only if the text gives one: "With witnesses to the hiring, on payday: the worker swears and is paid, since the employer is busy and may forget. Without witnesses, or after payday: the employer is believed, with an oath." Write one only where a halacha is hard to follow: several cases or conditions, a long list, or a ruling that's easy to lose. Usually 3 to 6 in a chapter; none for a halacha that is already clear, and never just the halacha again in other words. One or two plain sentences, under 45 words, warm and direct. Stay strictly with the text: say what it rules, never add opinions, sources, practical rulings for today, or anything it doesn't say. "term": when that halacha uses a technical term the translation doesn't explain (sh'vuat hesset, miggo, chazakah, k'nas), give it with a short meaning, the first time it comes up in the chapter ("Sh'vuat hesset: a lighter oath the Sages added, for claims the Torah's oath doesn't cover."); otherwise "".`;

async function askAI(items) {
  const content = items.map(({ index, he, paras }) =>
    `[halacha ${index}]\nHE: ${he}\n` + paras.map((p, k) => `EN ${k + 1}: ${p}`).join('\n')).join('\n\n');
  const response = await new Anthropic().messages.parse({   // reads ANTHROPIC_API_KEY
    model: MODEL,
    max_tokens: 8000,
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

// A guide from the AI, kept only where it fits the chapter (real halacha numbers, sensible lengths)
export function cleanGuide(ai, count) {
  const ok = n => Number.isInteger(n) && n >= 1 && n <= count;
  const txt = (x, max) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const notes = {};
  (ai.notes || []).forEach(n => { const text = txt(n.text, 400); if (ok(n.index) && text) notes[n.index] = { text, term: txt(n.term, 200) }; });
  return {
    about: txt(ai.about, 300),
    heads: (ai.heads || []).filter(h => ok(h.index) && txt(h.heading, 80)).map(h => [h.index, txt(h.heading, 80)]),
    notes,
  };
}

// Work out a chapter's splits and guide (one AI call)
export async function prepareParas(ref) {
  const { en, he } = await fetchChapter(ref);
  if (!en.length || !he.length) throw Object.assign(new Error('no text for ' + ref), { status: 404 });
  const items = en.map((e, i) => ({ index: i + 1, he: cleanHe(he[i]), paras: enParagraphs(e) })).filter(x => x.he && x.paras.length);
  const ai = await askAI(items);
  const halachot = {};
  for (const item of items.filter(x => x.paras.length > 1)) {
    const got = ai.halachot.find(h => h.index === item.index);
    const cut = got && cutHalacha(item.he, item.paras.length, got.starts);
    if (cut) halachot[item.index] = cut;
  }
  return { ref, halachot, guide: cleanGuide(ai, en.length), model: MODEL, at: new Date().toISOString(),
    usage: { inputTokens: ai.usage?.input_tokens ?? 0, outputTokens: ai.usage?.output_tokens ?? 0, costUSD: costOf(ai.usage) ?? 0 } };
}
