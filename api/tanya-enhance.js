/**
 * Vercel Serverless Function: /api/tanya-enhance
 *
 * Permanent Firestore cache — generated once per portion, served forever.
 *
 * GET /api/tanya-enhance?ref=...&segStart=0&segEnd=3
 * GET /api/tanya-enhance?ref=...&segStart=0&segEnd=3&bust=1  ← force overwrite
 *
 * bust=1 overwrites existing cache entry then resumes normal caching.
 * Use to refresh specific stale entries without affecting others.
 *
 * Setup — Vercel environment variables:
 *   ANTHROPIC_API_KEY
 *   FIREBASE_PROJECT_ID    = "chitas-daily"
 *   FIREBASE_CLIENT_EMAIL  = from service account JSON
 *   FIREBASE_PRIVATE_KEY   = from service account JSON
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SEFARIA       = 'https://www.sefaria.org';

// ── Firebase ───────────────────────────────────────────────────────────────────
function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

function docId(ref, segStart, segEnd) {
  const key = `${ref}|${segStart}|${segEnd ?? 'end'}`;
  return Buffer.from(key).toString('base64url');
}

async function getCached(db, ref, segStart, segEnd) {
  try {
    const doc = await db.collection('tanya_enhanced').doc(docId(ref, segStart, segEnd)).get();
    if (doc.exists) return doc.data().blocks;
  } catch(e) { console.warn('Cache read:', e.message); }
  return null;
}

async function setCached(db, ref, segStart, segEnd, blocks) {
  try {
    await db.collection('tanya_enhanced').doc(docId(ref, segStart, segEnd)).set({
      ref, segStart, segEnd: segEnd ?? 'end',
      blocks,
      generatedAt: new Date().toISOString(),
    });
  } catch(e) { console.warn('Cache write:', e.message); }
}

// ── Text helpers ───────────────────────────────────────────────────────────────
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

function flatten(x) {
  if (!x) return [];
  if (typeof x === 'string') { const s = cleanHtml(x); return s ? [s] : []; }
  if (Array.isArray(x)) return x.flatMap(flatten);
  return [];
}

// ── Sefaria fetch ──────────────────────────────────────────────────────────────
async function fetchChapter(ref) {
  const enc = encodeURIComponent(ref);
  const [enRes, heRes] = await Promise.all([
    fetch(`${SEFARIA}/api/v3/texts/${enc}?version=english&fill_in_missing_segments=1`).then(r => r.json()).catch(() => null),
    fetch(`${SEFARIA}/api/texts/${enc}?context=0&commentary=0`).then(r => r.json()).catch(() => null),
  ]);
  const engVersion = enRes?.versions?.find(v => v.language === 'en') || enRes?.versions?.[0];
  const allEn = flatten(engVersion?.text || heRes?.text || []);
  const allHe = flatten(heRes?.he || []);
  if (!allEn.length && !allHe.length) throw new Error(`No text for "${ref}"`);
  return { allEn, allHe };
}

// ── Claude alignment ───────────────────────────────────────────────────────────
async function alignWithClaude(ref, enSegs, heSegs) {
  const chapterNum = (ref.match(/(\d+)$/) || [])[1] || '?';

  const prompt = `You are formatting a bilingual Tanya reader for daily study. Below is today's portion from Tanya Chapter ${chapterNum}.

Your job: re-segment both Hebrew and English into aligned paragraph pairs — where each {he, en} pair expresses the exact same idea in both languages.

SPLITTING GUIDELINES:
- Split at genuine thought boundaries — where the Alter Rebbe finishes one idea and begins another
- Each English block should be 1-3 sentences, roughly 30-70 words
- Prefer splitting AFTER a complete sentence, not mid-sentence
- If a segment is already short (under 40 words English), keep it as one block
- The goal is that a reader can tap between Hebrew and English and see the matching thought — not just matching words

HARD RULES:
1. Every single word must appear in the output — reproduce the text exactly, do not omit or change anything
2. Hebrew and English in each pair must cover the same semantic content
3. Return ONLY a valid JSON array of {he, en} objects — no markdown, no explanation

HEBREW (${heSegs.length} segment${heSegs.length !== 1 ? 's' : ''}):
${heSegs.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

ENGLISH (${enSegs.length} segment${enSegs.length !== 1 ? 's' : ''}):
${enSegs.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

JSON array:`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const raw = (data.content?.[0]?.text || '').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let blocks;
  try { blocks = JSON.parse(raw); }
  catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('JSON parse failed');
    blocks = JSON.parse(m[0]);
  }

  if (!Array.isArray(blocks) || !blocks.length) throw new Error('Empty blocks');

  return blocks
    .map(b => ({ he: (b.he || '').trim(), en: (b.en || '').trim() }))
    .filter(b => b.he || b.en);
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // bust=1: overwrite this specific cache entry, then cache the fresh result normally
  const bust = req.query.bust === '1';

  // Always set Vercel edge cache (even for busted — fresh result gets cached)
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400');

  const { ref, segStart, segEnd } = req.query;
  if (!ref) return res.status(400).json({ error: 'ref required' });

  const start = segStart !== undefined ? parseInt(segStart) : 0;
  const end   = segEnd   !== undefined ? parseInt(segEnd)   : undefined;

  try {
    const db = getDb();

    // Check Firestore — skip only if bust=1
    if (!bust) {
      const cached = await getCached(db, ref, start, end);
      if (cached) {
        return res.status(200).json({ ref, segStart: start, segEnd: end, blocks: cached, source: 'cache' });
      }
    }

    // Generate with Claude
    const { allEn, allHe } = await fetchChapter(ref);
    const enPortion = end !== undefined ? allEn.slice(start, end) : allEn.slice(start);
    const hePortion = end !== undefined ? allHe.slice(start, end) : allHe.slice(start);

    if (!enPortion.length && !hePortion.length) {
      return res.status(404).json({ error: `No segments in [${start}, ${end}] for "${ref}"` });
    }

    const blocks = await alignWithClaude(ref, enPortion, hePortion);

    // Store in Firestore — overwrites if bust=1, creates if new
    await setCached(db, ref, start, end, blocks);

    return res.status(200).json({
      ref, segStart: start, segEnd: end,
      totalChapterSegs: allEn.length,
      blocks,
      source: bust ? 'regenerated' : 'generated',
    });

  } catch(err) {
    console.error('tanya-enhance:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
