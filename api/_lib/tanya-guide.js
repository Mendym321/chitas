// The Tanya guide for one daily portion: the text cut into small Hebrew/English
// pairs, with a chapter intro (first day of a chapter), a "so far" recap
// (other days), a summary of today, short headings that show the flow, and
// the translator's footnotes.
//
// The text itself is NEVER rewritten: the AI only says where each piece starts
// and we cut the original Sefaria text there (tanya-split.js). Everything the
// AI writes (intro, recap, summary, headings) is shown in the app as the guide,
// separate from the text.
//
// Prepared once per portion, the first time anyone opens it, then saved in
// Firestore for good and shared by everyone (see /api/tanya-enhance).
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { applySplits } from './tanya-split.js';
import { cleanTanyaHtml, isHagahahHtml, withoutNotes } from './tanya-text.js';

export const MODEL = 'claude-opus-5-5';
const SEFARIA = 'https://www.sefaria.org';
const CACHE_VERSION = 'v5';          // v5 = small pieces, intro/recap, headings, footnotes

export function guideDocId(slug, startVerse, endVerse) {
  return Buffer.from(`slug:${slug}|${startVerse}|${endVerse ?? 'end'}|${CACHE_VERSION}`).toString('base64url');
}

function flatRaw(x) {
  if (!x) return [];
  if (typeof x === 'string') return [x];
  if (Array.isArray(x)) return x.flatMap(flatRaw);
  return [];
}

// A whole chapter, raw HTML, fetched the same way the app does (url slug first)
export async function fetchChapter(chapterSlug) {
  const get = ref => fetch(`${SEFARIA}/api/texts/${encodeURIComponent(ref)}?lang=bi&context=0&commentary=0`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily/1.0)' } }).then(r => r.json()).catch(() => null);
  let d = await get(chapterSlug);
  if (!d?.he?.length && !d?.text?.length) d = await get(chapterSlug.replace(/_/g, ' ').replace(/\.(\d+)$/, ' $1'));
  return { allHe: flatRaw(d?.he || []), allEn: flatRaw(d?.text || []) };
}

// ── What the AI is asked ──────────────────────────────────────────────────────
const GuideSchema = z.object({
  chapterIntro: z.string(),
  recap: z.string(),
  summary: z.string(),
  segments: z.array(z.object({
    index: z.number().int(),
    heading: z.string(),
    splits: z.array(z.object({ he: z.string(), en: z.string(), heading: z.string() })),
  })),
});

const SYSTEM = `You prepare the daily Tanya portion for people who learn it every day, many of them beginners. The reader shows the Hebrew and its English translation side by side, in small pieces, with a light guide around it. You never change the text; you only say where pieces start and write the guide.

1. PIECES ("segments"). The portion comes in numbered segments. Cut each segment into small pieces, as small as still reads naturally: a piece is one step of the argument, usually one clause. Cut at sentence ends, semicolons and colons, and before a new step such as "therefore", "for", "however", "this means", "as is written", a quoted verse or a new example, wherever BOTH languages have a matching break. Aim for 6 to 20 English words per piece; never cut a piece shorter than about 5 words, and never cut inside a quotation. For each cut give the first 3 to 6 words of the new piece, copied exactly from the text, in Hebrew ("he") and in the English that translates it ("en"). The text before the first cut is the first piece. List every segment, with an empty "splits" if it needs none.

2. HEADINGS. To show the flow, give a short heading (2 to 6 plain English words, sentence case, no final period) where a new step of the argument begins: for example "The question", "Love is not enough on its own", "A proof from the verse", "Back to the main point". Put it on the segment ("heading", for a step that starts with the segment) or on a cut ("heading" in that split). Use one roughly every 3 to 6 pieces; use "" everywhere else.

3. "chapterIntro": only when the portion starts at the beginning of the chapter: 2 to 3 sentences on what this chapter is about and how it continues from the previous one. Otherwise "".

4. "recap": only when the portion starts in the middle of the chapter: 1 to 2 sentences on what the chapter has said so far, so today's portion makes sense. Otherwise "".

5. "summary": 2 to 3 sentences on what today's portion says, in the order it says it.

Write the guide in plain, warm English for a beginner, in the spirit of Lessons in Tanya: precise, faithful to the text, no forward references to later portions, no invented sources. Hebrew terms (like "kelipah", "Ein Sof", "bittul") are fine with a 2 to 4 word explanation the first time.`;

async function askAI({ book, chapterNum, startVerse, heSegs, enSegs, before, previous }) {
  const parts = [`${book}, chapter ${chapterNum}. ${startVerse > 1 ? `Today's portion starts in the middle of the chapter, at segment ${startVerse}.` : "Today's portion starts at the beginning of the chapter."}`];
  if (previous) parts.push(`For context, the end of the previous chapter (English):\n${previous}`);
  if (before) parts.push(`For context, the chapter so far, before today's portion (English):\n${before}`);
  parts.push("Today's portion:\n\n" + heSegs.map((he, i) => `[${i + 1}]\nHE: ${he}\nEN: ${enSegs[i] || ''}`).join('\n\n'));
  const response = await new Anthropic().messages.parse({  // reads ANTHROPIC_API_KEY
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'low', format: zodOutputFormat(GuideSchema) },
    messages: [{ role: 'user', content: parts.join('\n\n') }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('no result (' + response.stop_reason + ')');
  return response.parsed_output;
}

// ── Read, or prepare, the guide for one portion ───────────────────────────────
// A portion is { chapterSlug, startVerse, endVerse } (endVerse null = to the end
// of the chapter). Guides are saved by these text coordinates, not by date, so
// a portion that comes round again (next year, or the same range in another
// cycle) is never prepared twice.
const guideDoc = (db, p) => db.collection('tanya_enhanced').doc(guideDocId(p.chapterSlug, p.startVerse, p.endVerse));

export async function readGuide(db, p) {
  try {
    const hit = await guideDoc(db, p).get();
    if (hit.exists && hit.data().blocks?.length) return hit.data();
  } catch (e) { console.warn('tanya cache read:', e.message); }
  return null;
}

const PREPARING_FOR = 5 * 60 * 1000;   // longer than a run can last (maxDuration)
const WAIT_AFTER_FAILURE = 10 * 60 * 1000;

// Start preparing a portion, one run at a time (a lock in Firestore):
//   { state: 'started', done }   done = promise of the guide (saved when it resolves)
//   { state: 'busy' }            someone else is preparing it right now
//   { state: 'failed', error }   the last try failed a few minutes ago; not retried
//                                yet, so a lasting problem can't keep costing money
export async function startPreparing(db, p, { force = false } = {}) {
  const lock = db.collection('tanya_locks').doc(guideDocId(p.chapterSlug, p.startVerse, p.endVerse));
  try { await lock.create({ at: Date.now(), state: 'preparing' }); }
  catch {
    const held = (await lock.get().catch(() => null))?.data?.();
    const age = Date.now() - (held?.at || 0);
    if (!force && held?.state === 'preparing' && age < PREPARING_FOR) return { state: 'busy' };
    if (!force && held?.state === 'failed' && age < WAIT_AFTER_FAILURE) return { state: 'failed', error: held.error || 'failed' };
    await lock.set({ at: Date.now(), state: 'preparing' });
  }
  const done = generate(db, guideDoc(db, p), p.chapterSlug, p.startVerse, p.endVerse).then(
    async guide => { await lock.delete().catch(() => {}); return guide; },
    async err => { console.error('tanya guide:', err.message); await lock.set({ at: Date.now(), state: 'failed', error: err.message }).catch(() => {}); throw err; });
  return { state: 'started', done };
}

async function generate(db, cacheDoc, chapterSlug, startVerse, endVerse) {
  const { allHe, allEn } = await fetchChapter(chapterSlug);
  const s = startVerse - 1, e = endVerse ?? Math.max(allHe.length, allEn.length);
  const rawHe = allHe.slice(s, e), rawEn = allEn.slice(s, e);
  if (!rawHe.length && !rawEn.length) throw Object.assign(new Error('no text for that portion'), { status: 404 });

  const notes = [], heSegs = [], enSegs = [], hagahah = [];
  for (let i = 0; i < Math.max(rawHe.length, rawEn.length); i++) {
    hagahah.push(isHagahahHtml(rawHe[i], rawEn[i]));
    heSegs.push(cleanTanyaHtml(rawHe[i]));
    enSegs.push(cleanTanyaHtml(rawEn[i], notes));
  }

  const chapterNum = +chapterSlug.match(/\.(\d+)$/)[1];
  const before = allEn.slice(0, s).map(x => cleanTanyaHtml(x)).join(' ');
  let previous = '';
  if (startVerse === 1 && chapterNum > 1) {
    const prev = await fetchChapter(chapterSlug.replace(/\.\d+$/, '.' + (chapterNum - 1)));
    previous = prev.allEn.slice(-3).map(x => cleanTanyaHtml(x)).join(' ');
  }
  const book = chapterSlug.replace(/\.\d+$/, '').replace(/_/g, ' ');  // e.g. "Tanya, Part IV; Iggeret HaKodesh"
  const ai = await askAI({ book, chapterNum, startVerse, heSegs, enSegs: enSegs.map(withoutNotes), before, previous });
  const byIndex = {};
  for (const seg of ai.segments || []) byIndex[seg.index] = seg;

  // Cut the ORIGINAL text at the starts the AI found (unknown starts are ignored)
  const blocks = [];
  heSegs.forEach((he, i) => {
    const seg = byIndex[i + 1] || {};
    applySplits(he, enSegs[i], seg.splits || []).forEach((p, k) => {
      if (!p.he && !p.en) return;
      const heading = k === 0 ? String(seg.heading || '').trim() : p.heading;
      blocks.push({ he: p.he, en: p.en, isHagahah: hagahah[i], ...(heading && !hagahah[i] ? { heading } : {}) });
    });
  });

  const guide = {
    slug: chapterSlug, startVerse, endVerse: endVerse ?? 'end',
    intro: startVerse === 1 ? String(ai.chapterIntro || '').trim() : '',
    recap: startVerse > 1 ? String(ai.recap || '').trim() : '',
    summary: String(ai.summary || '').trim(),
    notes, blocks, model: MODEL, generatedAt: new Date().toISOString(),
  };
  await cacheDoc.set(guide);   // if saving fails, this counts as a failed run (no paying again right away)
  return guide;
}
