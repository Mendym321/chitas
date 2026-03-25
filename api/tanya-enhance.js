/**
 * Vercel Serverless Function: /api/tanya-enhance
 *
 * Fetches today's Tanya portion, optionally yesterday's portion,
 * then uses Claude Haiku to:
 *   1. Write an accurate 2-3 sentence context intro based on actual text
 *   2. Re-segment Hebrew + English into aligned paragraph pairs
 *
 * Permanent Firestore cache — generated once per portion, served forever.
 * bust=1 param overwrites a specific cached entry.
 *
 * GET /api/tanya-enhance
 *   ?ref=...&segStart=0&segEnd=3
 *   &prevRef=...&prevSegStart=0&prevSegEnd=3   (optional — for context generation)
 *   &bust=1                                     (optional — force regenerate)
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
    if (doc.exists) return doc.data();
  } catch(e) { console.warn('Cache read:', e.message); }
  return null;
}

async function setCached(db, ref, segStart, segEnd, payload) {
  try {
    await db.collection('tanya_enhanced').doc(docId(ref, segStart, segEnd)).set({
      ref, segStart, segEnd: segEnd ?? 'end',
      ...payload,
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
async function fetchPortion(ref, segStart, segEnd) {
  const enc = encodeURIComponent(ref);
  const [enRes, heRes] = await Promise.all([
    fetch(`${SEFARIA}/api/v3/texts/${enc}?version=english&fill_in_missing_segments=1`).then(r => r.json()).catch(() => null),
    fetch(`${SEFARIA}/api/texts/${enc}?context=0&commentary=0`).then(r => r.json()).catch(() => null),
  ]);
  const engVersion = enRes?.versions?.find(v => v.language === 'en') || enRes?.versions?.[0];
  const allEn = flatten(engVersion?.text || heRes?.text || []);
  const allHe = flatten(heRes?.he || []);
  if (!allEn.length && !allHe.length) throw new Error(`No text for "${ref}"`);
  const end = segEnd !== undefined ? segEnd : allEn.length;
  return {
    en: allEn.slice(segStart, end),
    he: allHe.slice(segStart, end),
    totalSegs: allEn.length,
  };
}

// ── Claude: align + generate context ──────────────────────────────────────────
async function processWithClaude(ref, enSegs, heSegs, prevEnSegs) {
  const chapterNum = (ref.match(/(\d+)$/) || [])[1] || '?';

  const prevSection = prevEnSegs?.length
    ? `PREVIOUS PORTION (for context only — do not include in output):
${prevEnSegs.map((s, i) => `[${i+1}] ${s}`).join('\n\n')}`
    : '';

  const prompt = `You are formatting a bilingual Tanya reader for daily study. Below is today's portion from Tanya Chapter ${chapterNum}.

Your output must be a single JSON object with two fields:
1. "context": a 2-3 sentence factual introduction written in the style of "Lessons in Tanya"
2. "blocks": aligned Hebrew-English paragraph pairs for today's portion

CONTEXT RULES:
- Write in the style of Lessons in Tanya: factual, precise, no evaluative language
- If a previous portion is provided, begin with what it established ("In the previous portion, the Alter Rebbe explained...")
- Then state what today's portion covers, based only on what actually appears in today's text
- Do NOT mention concepts that appear in later parts of the chapter but not in today's text
- 2-3 sentences maximum
- If no previous portion: start directly with what today's portion discusses

BLOCKS RULES:
- Split at genuine thought boundaries — where one idea ends and another begins
- Each English block: 1-3 sentences, ~30-70 words
- Reproduce every word exactly — no omissions or changes
- Each {he, en} pair must cover the same semantic content

${prevSection}

TODAY'S HEBREW (${heSegs.length} segment${heSegs.length !== 1 ? 's' : ''}):
${heSegs.map((s, i) => `[${i+1}] ${s}`).join('\n\n')}

TODAY'S ENGLISH (${enSegs.length} segment${enSegs.length !== 1 ? 's' : ''}):
${enSegs.map((s, i) => `[${i+1}] ${s}`).join('\n\n')}

Return ONLY valid JSON, no markdown:
{"context": "...", "blocks": [{"he": "...", "en": "..."}, ...]}`;

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

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch {
    // Try to extract JSON object
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON parse failed');
    parsed = JSON.parse(m[0]);
  }

  if (!parsed.blocks?.length) throw new Error('Empty blocks');

  return {
    context: (parsed.context || '').trim(),
    blocks: parsed.blocks
      .map(b => ({ he: (b.he || '').trim(), en: (b.en || '').trim() }))
      .filter(b => b.he || b.en),
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const bust = req.query.bust === '1';
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400');

  const { ref, segStart, segEnd, prevRef, prevSegStart, prevSegEnd } = req.query;
  if (!ref) return res.status(400).json({ error: 'ref required' });

  const start    = parseInt(segStart    ?? '0');
  const end      = segEnd      !== undefined ? parseInt(segEnd)      : undefined;
  const prevStart = parseInt(prevSegStart ?? '0');
  const prevEnd   = prevSegEnd  !== undefined ? parseInt(prevSegEnd)  : undefined;

  try {
    const db = getDb();

    // Check Firestore cache
    if (!bust) {
      const cached = await getCached(db, ref, start, end);
      if (cached?.blocks?.length) {
        return res.status(200).json({
          ref, segStart: start, segEnd: end,
          context: cached.context || '',
          blocks: cached.blocks,
          source: 'cache',
        });
      }
    }

    // Fetch today's portion + optionally yesterday's in parallel
    const [todayPortion, prevPortion] = await Promise.all([
      fetchPortion(ref, start, end),
      prevRef ? fetchPortion(prevRef, prevStart, prevEnd).catch(() => null) : Promise.resolve(null),
    ]);

    const { en: enSegs, he: heSegs, totalSegs } = todayPortion;
    const prevEnSegs = prevPortion?.en || null;

    if (!enSegs.length && !heSegs.length) {
      return res.status(404).json({ error: `No segments in [${start}, ${end}] for "${ref}"` });
    }

    // Process with Claude — align blocks + generate context
    const { context, blocks } = await processWithClaude(ref, enSegs, heSegs, prevEnSegs);

    // Store permanently
    await setCached(db, ref, start, end, { context, blocks });

    return res.status(200).json({
      ref, segStart: start, segEnd: end,
      totalChapterSegs: totalSegs,
      context,
      blocks,
      source: bust ? 'regenerated' : 'generated',
    });

  } catch(err) {
    console.error('tanya-enhance:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
