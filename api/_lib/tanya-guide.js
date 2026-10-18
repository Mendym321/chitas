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
const CACHE_VERSION = 'v8';          // v8 = smaller pieces, short lead-in and synopsis, safer numbering

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

1. PIECES ("segments"). Today's portion comes in segments labelled [segment 1 of N], [segment 2 of N], and so on; "index" is that number (1 to N), whatever the chapter's own numbering. List EVERY segment, in order. Cut each one into small pieces so a beginner can take it in one breath: a piece is one step of the argument, usually one clause, about 5 to 15 English words (two lines on a phone). Cut at sentence ends, semicolons, colons and dashes, and before a new step such as "therefore", "for", "however", "that is", "this means", "as is written", "but", "rather", a quoted verse or a new example, wherever BOTH languages have a matching break. Never leave a piece longer than about 20 English words if there is any matching break inside it; never cut a piece shorter than about 4 words, and never cut inside a quotation. For each cut give the first 3 to 6 words of the new piece, copied exactly from the text, in Hebrew ("he") and in the English that translates it ("en"). The text before the first cut is the segment's first piece.

2. HEADINGS. To show the flow, give a short heading (2 to 6 plain English words, sentence case, no final period) where a new step of the argument begins: for example "The question", "Love is not enough on its own", "A proof from the verse", "Back to the main point". Put it on the segment ("heading", for a step that starts with the segment) or on a cut ("heading" in that split). Use one roughly every 3 to 6 pieces; use "" everywhere else.

3. "chapterIntro": only when the portion starts at the beginning of the chapter. At most 2 short sentences, under 35 words in all: where the previous chapter left off and what this chapter takes up, leading into today (e.g. "Today he begins by..."). Otherwise "".

4. "recap": only when the portion starts in the middle of the chapter. At most 2 short sentences, under 35 words in all: the thread so far, leading into where today picks up (e.g. "Today he answers by..."). Otherwise "".

5. "summary": the synopsis, read after the text. At most 2 short sentences, under 30 words in all: where today's portion landed.

HOW TO WRITE THE GUIDE. Its only job is to help the reader follow the flow of today's Tanya. Write the way a good teacher speaks to a student: plain, warm, everyday English, short sentences (under 20 words). Use the text's own key terms only when needed, and then say what they mean in a few plain words in passing. Headings are plain English, with no untranslated Hebrew words. Stay precise and faithful to the text: no forward references to later portions, no invented sources, no sermonizing.`;

async function askAI({ book, chapterNum, startVerse, heSegs, enSegs, before, previous, feedback }) {
  const parts = [`${book}, chapter ${chapterNum}. ${startVerse > 1 ? "Today's portion starts in the middle of the chapter." : "Today's portion starts at the beginning of the chapter."}`];
  if (previous) parts.push(`For context, the end of the previous chapter (English):\n${previous}`);
  if (before) parts.push(`For context, the chapter so far, before today's portion (English):\n${before}`);
  const n = heSegs.length;
  parts.push(`Today's portion (${n} segments):\n\n` + heSegs.map((he, i) => `[segment ${i + 1} of ${n}]\nHE: ${he}\nEN: ${enSegs[i] || ''}`).join('\n\n'));
  if (feedback) parts.push(feedback);
  const response = await new Anthropic().messages.parse({  // reads ANTHROPIC_API_KEY
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'low', format: zodOutputFormat(GuideSchema) },
    messages: [{ role: 'user', content: parts.join('\n\n') }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('no result (' + response.stop_reason + ')');
  return { ...response.parsed_output, usage: response.usage };
}

// What one run cost, from the tokens it used (Opus 5.5: $4 per million in, $20 per million out)
const costOf = u => u ? Math.round(((u.input_tokens || 0) * 4 + (u.output_tokens || 0) * 20) / 1e6 * 10000) / 10000 : null;

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

// The AI's segment for each of today's segments. It's asked to number them 1..N;
// if it numbered them by the chapter instead (startVerse, startVerse+1, ...) or
// just listed them in order, they're still lined up correctly.
export function segmentsInOrder(aiSegs, n, startVerse) {
  const list = (aiSegs || []).filter(x => Number.isInteger(x?.index));
  const fits = off => list.length && list.every(x => x.index - off >= 1 && x.index - off <= n);
  const off = fits(0) ? 0 : fits(startVerse - 1) ? startVerse - 1 : null;
  if (off !== null) { const by = {}; list.forEach(x => { by[x.index - off] = x; }); return Array.from({ length: n }, (_, i) => by[i + 1] || {}); }
  return Array.from({ length: n }, (_, i) => list.length === n ? list[i] : {});
}

// Cut the ORIGINAL text at the starts the AI found (unknown starts are ignored)
export function assemble(ai, heSegs, enSegs, hagahah, startVerse) {
  const segs = segmentsInOrder(ai.segments, heSegs.length, startVerse);
  const blocks = [];
  heSegs.forEach((he, i) => {
    const seg = segs[i] || {};
    applySplits(he, enSegs[i], seg.splits || []).forEach((p, k) => {
      if (!p.he && !p.en) return;
      const heading = k === 0 ? String(seg.heading || '').trim() : p.heading;
      blocks.push({ he: p.he, en: p.en, isHagahah: hagahah[i], ...(heading && !hagahah[i] ? { heading } : {}) });
    });
  });
  return blocks;
}

const words = s => withoutNotes(s).split(/\s+/).filter(Boolean).length;
// Higher is better: small pieces, and some headings
export function score(blocks) {
  const body = blocks.filter(b => !b.isHagahah);
  if (!body.length) return 0;
  const avg = body.reduce((t, b) => t + words(b.en), 0) / body.length;
  return (body.some(b => b.heading) ? 1 : 0) + 20 / Math.max(avg, 1);
}
export const looksGood = blocks => {
  const body = blocks.filter(b => !b.isHagahah);
  return body.length > 0 && body.some(b => b.heading) && body.reduce((t, b) => t + words(b.en), 0) / body.length <= 22;
};
const addUsage = (a = {}, b = {}) => ({ input_tokens: (a.input_tokens || 0) + (b.input_tokens || 0), output_tokens: (a.output_tokens || 0) + (b.output_tokens || 0) });

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
  const ask = feedback => askAI({ book, chapterNum, startVerse, heSegs, enSegs: enSegs.map(withoutNotes), before, previous, feedback });
  let ai = await ask();
  let blocks = assemble(ai, heSegs, enSegs, hagahah, startVerse);
  // Quality check: pieces still long, or no headings → ask once more, keep the better one
  if (!looksGood(blocks)) {
    const again = await ask('A first try came back with pieces that were too long or without headings. Please list every segment with its cuts (pieces of about 5 to 15 English words) and headings.').catch(() => null);
    if (again) {
      const b2 = assemble(again, heSegs, enSegs, hagahah, startVerse);
      ai = { ...(score(b2) > score(blocks) ? again : ai), usage: addUsage(ai.usage, again.usage) };
      if (score(b2) > score(blocks)) blocks = b2;
    }
  }

  const guide = {
    slug: chapterSlug, startVerse, endVerse: endVerse ?? 'end',
    intro: startVerse === 1 ? String(ai.chapterIntro || '').trim() : '',
    recap: startVerse > 1 ? String(ai.recap || '').trim() : '',
    summary: String(ai.summary || '').trim(),
    notes, blocks, model: MODEL, generatedAt: new Date().toISOString(),
    // Kept so the real cost can be checked in Firebase (collection tanya_enhanced)
    usage: { inputTokens: ai.usage?.input_tokens ?? null, outputTokens: ai.usage?.output_tokens ?? null, costUSD: costOf(ai.usage) },
  };
  await cacheDoc.set(guide);   // if saving fails, this counts as a failed run (no paying again right away)
  return guide;
}
