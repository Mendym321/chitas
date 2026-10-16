/**
 * GET /api/tanya-enhance?chapterSlug=Tanya,_Part_I;_Likkutei_Amarim.41&startVerse=5&endVerse=9
 *
 * Makes today's Tanya easier to follow:
 *  - splits each Sefaria segment into sentence-sized Hebrew/English pairs
 *  - writes a short summary of the portion (shown in the app as an AI summary)
 *
 * The text itself is NEVER rewritten: the AI only says where each new sentence
 * starts, and we cut the original Sefaria text there (api/_lib/tanya-split.js).
 *
 * Saved in Firestore per portion and shared by everyone. Making a NEW one needs
 * a signed-in user (Authorization: Bearer <Firebase ID token>) and counts toward
 * a daily limit. &bust=1 (regenerate) is for admins only (ADMIN_UIDS: uids or emails).
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getDb, verifyUserToken, isAdmin } from './_lib/firebase.js';
import { takeDailyQuota } from './_lib/quota.js';
import { applySplits } from './_lib/tanya-split.js';
import { TANYA_SLUG } from './_lib/quiz-core.js';

export const config = { maxDuration: 60 };

const MODEL = 'claude-opus-5-5';
const SEFARIA = 'https://www.sefaria.org';
const CACHE_VERSION = 'v4';         // v4 = verbatim-safe splitting
const NEW_PER_DAY = 10;             // per user; saved portions don't count

// ── Firestore cache ───────────────────────────────────────────────────────────
function docId(slug, startVerse, endVerse) {
  return Buffer.from(`slug:${slug}|${startVerse}|${endVerse ?? 'end'}|${CACHE_VERSION}`).toString('base64url');
}

// ── HTML cleaning (identical to client's _cleanHtml) ─────────────────────────
function cleanHtml(s) {
  if (!s) return '';
  let out = '', i = 0;
  while (i < s.length) {
    const sup = s.slice(i).match(/^<sup\b[^>]*class="footnote-marker"[^>]*>/);
    if (sup) { const e = s.indexOf('</sup>', i + sup[0].length); if (e !== -1) { i = e + 6; continue; } }
    const fn = s.slice(i).match(/^<i\b[^>]*class="footnote"[^>]*>/);
    if (fn) {
      let d = 1, j = i + fn[0].length;
      while (j < s.length && d > 0) {
        const o = s.indexOf('<i', j), cc = s.indexOf('</i>', j);
        if (o !== -1 && (cc === -1 || o < cc)) { d++; j = o + 2; }
        else if (cc !== -1) { d--; j = cc + 4; }
        else break;
      }
      i = j; continue;
    }
    out += s[i]; i++;
  }
  return out.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Flatten nested Sefaria array into flat string array — same as client's flatRaw
function flatRaw(x) {
  if (!x) return [];
  if (typeof x === 'string') return x ? [x] : [];  // keep raw HTML for hagahah detection
  if (Array.isArray(x)) return x.flatMap(flatRaw);
  return [];
}

// ── Sefaria fetch — mirrors client exactly ────────────────────────────────────
async function fetchChapter(chapterSlug) {
  // Primary: url slug (what the client uses)
  const slugRes = await fetch(
    `${SEFARIA}/api/texts/${encodeURIComponent(chapterSlug)}?lang=bi&context=0&commentary=0`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily/1.0)' } }
  ).then(r => r.json()).catch(() => null);

  if (slugRes?.he?.length || slugRes?.text?.length) {
    return { allHe: flatRaw(slugRes.he || []), allEn: flatRaw(slugRes.text || []) };
  }

  // Fallback: standard ref format (replace underscores and dots)
  const stdRef = chapterSlug.replace(/_/g, ' ').replace(/\.(\d+)$/, ' $1');
  const stdRes = await fetch(
    `${SEFARIA}/api/texts/${encodeURIComponent(stdRef)}?lang=bi&context=0&commentary=0`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily/1.0)' } }
  ).then(r => r.json()).catch(() => null);

  return {
    allHe: flatRaw(stdRes?.he   || []),
    allEn: flatRaw(stdRes?.text || []),
  };
}

// Detect hagahah BEFORE stripping HTML (same logic as client)
function isHagahahRaw(rawHe, rawEn) {
  return /^<small>/i.test((rawHe || '').trim())
      || /^<small>/i.test((rawEn || '').trim())
      || /^הגה\./.test(cleanHtml(rawHe || ''))
      || /^\[/.test(cleanHtml(rawHe || ''));
}

// ── Claude: where does each new sentence start? ─────────────────────────────
const SplitSchema = z.object({
  summary: z.string(),
  segments: z.array(z.object({
    index: z.number().int(),
    splits: z.array(z.object({ he: z.string(), en: z.string() })),
  })),
});

const SYSTEM = `You help prepare a bilingual (Hebrew/English) Tanya reader for people learning the daily portion.

1. "segments": the portion comes in numbered segments, each with Hebrew and its English translation. Long segments are hard to follow, so mark where a NEW sentence begins inside a segment. For each such place give the first 3–6 words of that sentence, copied exactly as written, in Hebrew ("he") and in the English that translates it ("en"). The text before your first split stays as the first piece. Only split where BOTH languages have a matching sentence break; aim for 10–35 English words per piece; when unsure, don't split. List segments that need no split with an empty "splits".

2. "summary": 2–3 sentences, in the style of Lessons in Tanya, saying what today's portion discusses. Only what is in today's text; no forward references. If the portion starts mid-chapter, begin with "The Alter Rebbe continues".`;

async function findSplits(chapterNum, startVerse, heSegs, enSegs) {
  const lines = heSegs.map((he, i) => `[${i + 1}]\nHE: ${he}\nEN: ${enSegs[i] || ''}`).join('\n\n');
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'low', format: zodOutputFormat(SplitSchema) },
    messages: [{ role: 'user', content: `Tanya chapter ${chapterNum}, ${startVerse > 1 ? 'starting mid-chapter' : 'from the start of the chapter'}.\n\n${lines}` }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('no result (' + response.stop_reason + ')');
  return response.parsed_output;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const chapterSlug = String(req.query.chapterSlug || '');
  const startVerse = parseInt(req.query.startVerse, 10);
  const endVerse = req.query.endVerse !== undefined ? parseInt(req.query.endVerse, 10) : null;
  if (!TANYA_SLUG.test(chapterSlug) || !(startVerse >= 1 && startVerse <= 200) ||
      (endVerse !== null && !(endVerse >= startVerse && endVerse <= 200)))
    return res.status(400).json({ error: 'bad chapterSlug / verse range' });

  const db = getDb();
  const cacheDoc = db.collection('tanya_enhanced').doc(docId(chapterSlug, startVerse, endVerse));
  const who = await verifyUserToken(req);
  const uid = who?.uid || null;
  const bust = req.query.bust === '1';
  if (bust && !isAdmin(who)) return res.status(403).json({ error: 'admins only' });

  if (!bust) {
    try {
      const hit = await cacheDoc.get();
      if (hit.exists && hit.data().blocks?.length) {
        const d = hit.data();
        return res.status(200).json({ chapterSlug, startVerse, endVerse, context: d.context || '', blocks: d.blocks, source: 'cache' });
      }
    } catch (e) { console.warn('tanya cache read:', e.message); }
  }

  if (!uid) return res.status(401).json({ error: 'sign in needed' });
  if (!bust && !(await takeDailyQuota(db, uid, 'tanya', NEW_PER_DAY))) return res.status(429).json({ error: 'daily limit' });

  try {
    const { allHe, allEn } = await fetchChapter(chapterSlug);
    const s = startVerse - 1;
    const e = endVerse !== null ? endVerse : Math.max(allHe.length, allEn.length);
    const rawHe = allHe.slice(s, e), rawEn = allEn.slice(s, e);
    if (!rawHe.length && !rawEn.length) return res.status(404).json({ error: 'no text for that portion' });

    const n = Math.max(rawHe.length, rawEn.length);
    const heSegs = [], enSegs = [], hagahah = [];
    for (let i = 0; i < n; i++) {
      hagahah.push(isHagahahRaw(rawHe[i], rawEn[i]));
      heSegs.push(cleanHtml(rawHe[i] || ''));
      enSegs.push(cleanHtml(rawEn[i] || ''));
    }

    const chapterNum = chapterSlug.match(/\.(\d+)$/)[1];
    const ai = await findSplits(chapterNum, startVerse, heSegs, enSegs);
    const splitsFor = {};
    for (const seg of ai.segments || []) splitsFor[seg.index] = seg.splits;

    // Cut the ORIGINAL text at the starts the AI found (unknown starts are ignored)
    const blocks = [];
    heSegs.forEach((he, i) => {
      for (const p of applySplits(he, enSegs[i], splitsFor[i + 1] || [])) {
        if (p.he || p.en) blocks.push({ he: p.he, en: p.en, isHagahah: hagahah[i] });
      }
    });
    const context = String(ai.summary || '').trim();

    await cacheDoc.set({ slug: chapterSlug, startVerse, endVerse: endVerse ?? 'end', context, blocks, model: MODEL, generatedAt: new Date().toISOString() })
      .catch(err => console.warn('tanya cache write:', err.message));
    return res.status(200).json({ chapterSlug, startVerse, endVerse, context, blocks, source: bust ? 'regenerated' : 'generated' });
  } catch (err) {
    console.error('tanya-enhance:', err.message);
    return res.status(502).json({ error: 'could not enhance this portion' });
  }
}
