// The Tanya guide for one daily portion: the text cut into small Hebrew/English
// pairs, with a chapter intro (first day of a chapter), a "so far" recap
// (other days), a summary of today, a few plain-words bridges that help follow the argument (older guides: headings), and
// the translator's footnotes.
//
// The text itself is NEVER rewritten: the AI only says where each piece starts
// and we cut the original Sefaria text there (tanya-split.js). Everything the
// AI writes (intro, recap, summary, headings) is shown in the app as the guide,
// separate from the text.
//
// Prepared once per portion, the first time anyone opens it, then saved in
// Firestore for good and shared by everyone (see /api/tanya-enhance).
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { applySplits } from './tanya-split.js';
import { cleanTanyaHtml, isHagahahHtml, withoutNotes } from './tanya-text.js';
import { writtenGuide } from './tanya-written.js';

export const MODEL = 'claude-opus-5-5';
const SEFARIA = 'https://www.sefaria.org';
const CACHE_VERSION = 'v11';         // v11 = bridges in place of headings (Dec 2026); v8 = headings. Guides are saved by text, so a portion that comes round next year is read, not prepared again: change this only when the guide's format changes (v9, guiding notes, was tried and dropped)

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
    title: z.string(),
    bridge: z.string(),
    splits: z.array(z.object({ he: z.string(), en: z.string(), title: z.string(), bridge: z.string() })),
  })),
});

const SYSTEM = `You prepare the daily Tanya portion for people who learn it every day, many of them beginners. The reader shows the Hebrew and its English translation side by side, in small pieces, with a light guide around it. You never change the text; you only say where pieces start and write the guide.

1. PIECES ("segments"). Today's portion comes in segments labelled [segment 1 of N], [segment 2 of N], and so on; "index" is that number (1 to N), whatever the chapter's own numbering. List EVERY segment, in order. Cut each one into small pieces so a beginner can take it in one breath: a piece is one step of the argument, usually one clause, about 5 to 15 English words (two lines on a phone). Cut at sentence ends, semicolons, colons and dashes, and before a new step such as "therefore", "for", "however", "that is", "this means", "as is written", "but", "rather", a quoted verse or a new example, wherever BOTH languages have a matching break. Never leave a piece longer than about 20 English words if there is any matching break inside it; never cut a piece shorter than about 4 words, and never cut inside a quotation. For each cut give the first 3 to 6 words of the new piece, copied exactly from the text, in Hebrew ("he") and in the English that translates it ("en"). The text before the first cut is the segment's first piece.

2. BRIDGES. Between the pieces, add a few short bridges: plain-English explanation, shown in a shaded box, that helps a beginner follow the argument, the way the explanatory notes in a good translation do. A bridge either sums up in plain words what the last few pieces established ("Two problems with the oath, then: it seems to contradict the Mishnah, and seeing yourself as wicked should lead either to sadness or to not caring at all."), or says what the next pieces set out to do or ask, when the text doesn't make that obvious ("Before he can answer, he needs to say what 'tzaddik,' 'rasha' and 'beinoni' actually mean."). Give context a beginner lacks only when the argument depends on it ("Rabbah was one of the great sages of the Talmud. If even he could think of himself as a beinoni, a beinoni must be someone on a very high level."). Stay strictly inside the text: explain what it says; never add ideas, sources, opinions or lessons it doesn't contain. One or two plain sentences, under 40 words, warm and direct. Don't overdo it: one bridge per real step of the argument, usually 3 to 6 in a portion, none where the text is already clear, and never just the next piece in other words. Put a bridge on the segment ("bridge", when it comes just before the segment's start) or on a cut ("bridge" in that split), so it stands just before the piece it leads into; use "" everywhere else.

2b. TITLES. Where a new step of the argument begins, give a short title: 2 to 6 plain English words, sentence case, no final period, e.g. "The question", "Two kinds of love", "A proof from the verse", "Back to the main point". It stands above the piece as a small heading, so the reader sees the shape of the portion at a glance. Usually 3 to 6 in a portion, roughly every 3 to 6 pieces. Put it on the segment ("title") or on a cut ("title" in that split); a title and a bridge may stand at the same piece (the bridge comes first, then the title, just above the text). Use "" everywhere else.

3. "chapterIntro": only when the portion starts at the beginning of the chapter. At most 2 short sentences, under 35 words in all: where the previous chapter left off and what this chapter takes up, leading into today (e.g. "Today he begins by..."). Otherwise "".

4. "recap": only when the portion starts in the middle of the chapter. At most 2 short sentences, under 35 words in all: the thread so far, leading into where today picks up (e.g. "Today he answers by..."). Otherwise "".

5. "summary": the synopsis, read after the text. At most 2 short sentences, under 30 words in all: where today's portion landed.

HOW TO WRITE THE GUIDE. Its only job is to help the reader follow the flow of today's Tanya. Write the way a good teacher speaks to a student: plain, warm, everyday English, short sentences (under 20 words). Use the text's own key terms only when needed, and then say what they mean in a few plain words in passing. Bridges and titles are plain English, with no untranslated Hebrew words. Stay precise and faithful to the text: no forward references to later portions, no invented sources, no sermonizing.`;

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

// A written guide's fingerprint: when the written words change, the saved copy
// is made again from them (no AI), not kept
const writtenRev = w => w ? createHash('sha1').update(JSON.stringify(w)).digest('hex').slice(0, 12) : '';

export async function readGuide(db, p) {
  try {
    const hit = await guideDoc(db, p).get();
    const saved = hit.exists ? hit.data() : null;
    const w = writtenGuide(p.chapterSlug, p.startVerse, p.endVerse);
    if (saved?.model === 'written' && saved.writtenRev !== writtenRev(w)) return null;
    if (saved?.blocks?.length) return saved;
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
    // A bridge (or, in written guides from before Dec 2026, a heading) goes before the piece it leads into
    const splits = (seg.splits || []).map(x => ({ ...x, heading: x.bridge ?? x.heading }));
    applySplits(he, enSegs[i], splits).forEach((p, k) => {
      if (!p.he && !p.en) return;
      const heading = k === 0 ? String(seg.bridge ?? seg.heading ?? '').trim() : p.heading;
      const title = k === 0 ? String(seg.title ?? '').trim() : p.title;   // a short heading above the piece
      blocks.push({ he: p.he, en: p.en, isHagahah: hagahah[i], ...(heading && !hagahah[i] ? { heading } : {}), ...(title && !hagahah[i] ? { title } : {}) });
    });
  });
  return blocks;
}

// A guide written ahead (tanya-written.js), cut into the live text: the blocks,
// or null if it doesn't fit (a segment or a cut it names isn't in the text)
export function writtenBlocks(w, heSegs, enSegs, hagahah, startVerse) {
  if (!w || (w.segments || []).length !== heSegs.length) return null;
  const segs = segmentsInOrder(w.segments, heSegs.length, startVerse);
  const fits = heSegs.every((he, i) => applySplits(he, enSegs[i], segs[i].splits || []).length === (segs[i].splits || []).length + 1);
  return fits ? assemble(w, heSegs, enSegs, hagahah, startVerse) : null;
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
  // Written ahead for this portion? Then no AI call at all
  const w = writtenGuide(chapterSlug, startVerse, endVerse);
  const wBlocks = writtenBlocks(w, heSegs, enSegs, hagahah, startVerse);
  if (w && !wBlocks) console.warn('tanya guide: the written guide for', chapterSlug, startVerse, "doesn't fit the text; asking the AI");
  if (wBlocks) {
    const guide = {
      slug: chapterSlug, startVerse, endVerse: endVerse ?? 'end',
      intro: startVerse === 1 ? String(w.chapterIntro || '').trim() : '',
      recap: startVerse > 1 ? String(w.recap || '').trim() : '',
      summary: String(w.summary || '').trim(),
      notes, blocks: wBlocks, flow: w.flow || 'headings', model: 'written', writtenRev: writtenRev(w), generatedAt: new Date().toISOString(),
      usage: { inputTokens: 0, outputTokens: 0, costUSD: 0 },
    };
    await cacheDoc.set(guide);
    return guide;
  }

  const book = chapterSlug.replace(/\.\d+$/, '').replace(/_/g, ' ');  // e.g. "Tanya, Part IV; Iggeret HaKodesh"
  const ask = feedback => askAI({ book, chapterNum, startVerse, heSegs, enSegs: enSegs.map(withoutNotes), before, previous, feedback });
  let ai = await ask();
  let blocks = assemble(ai, heSegs, enSegs, hagahah, startVerse);
  // Quality check: pieces still long, or no headings → ask once more, keep the better one
  if (!looksGood(blocks)) {
    const again = await ask('A first try came back with pieces that were too long or without bridges. Please list every segment with its cuts (pieces of about 5 to 15 English words) and a few bridges.').catch(() => null);
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
    notes, blocks, flow: 'bridges', model: MODEL, generatedAt: new Date().toISOString(),
    // Kept so the real cost can be checked in Firebase (collection tanya_enhanced)
    usage: { inputTokens: ai.usage?.input_tokens ?? null, outputTokens: ai.usage?.output_tokens ?? null, costUSD: costOf(ai.usage) },
  };
  await cacheDoc.set(guide);   // if saving fails, this counts as a failed run (no paying again right away)
  return guide;
}
