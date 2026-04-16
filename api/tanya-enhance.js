/**
 * /api/tanya-enhance
 *
 * Mirrors the client's exact Sefaria fetch pattern — uses the url slug
 * (e.g. "Tanya,_Part_I;_Likkutei_Amarim.41") so verse indices align
 * perfectly with what the reader already has on screen.
 *
 * Claude sentence-splits and Hebrew/English aligns the portion,
 * detects hagahot, returns blocks. Cached permanently in Firestore.
 *
 * GET /api/tanya-enhance
 *   ?chapterSlug=Tanya,_Part_I;_Likkutei_Amarim.41
 *   &startVerse=5        (1-based, same as Sefaria url verse)
 *   &endVerse=9          (1-based inclusive, omit = end of chapter)
 *   &bust=1              (optional — force regenerate)
 *
 * The client also still supports the old ?ref=&segStart=&segEnd= params
 * for backward compat — this handler accepts both.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SEFARIA       = 'https://www.sefaria.org';

// ── Firebase ──────────────────────────────────────────────────────────────────
function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    })});
  }
  return getFirestore();
}

// Cache key: slug + verse range + version so old entries don't conflict
function docId(slug, startVerse, endVerse) {
  const key = `slug:${slug}|${startVerse}|${endVerse ?? 'end'}|v3`;
  return Buffer.from(key).toString('base64url');
}

async function getCached(db, slug, startVerse, endVerse) {
  try {
    const doc = await db.collection('tanya_enhanced').doc(docId(slug, startVerse, endVerse)).get();
    if (doc.exists) return doc.data();
  } catch(e) { console.warn('Cache read:', e.message); }
  return null;
}

async function setCached(db, slug, startVerse, endVerse, payload) {
  try {
    await db.collection('tanya_enhanced').doc(docId(slug, startVerse, endVerse)).set({
      slug, startVerse, endVerse: endVerse ?? 'end',
      ...payload,
      generatedAt: new Date().toISOString(),
    });
  } catch(e) { console.warn('Cache write:', e.message); }
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

// ── Claude: sentence-level split + alignment ──────────────────────────────────
async function processWithClaude(chapterNum, enSegs, heSegs, hagahahFlags) {
  // Tag hagahot so Claude preserves them
  const enTagged = enSegs.map((s, i) => hagahahFlags[i] ? `[HAGAHAH] ${s}` : s);
  const heTagged = heSegs.map((s, i) => hagahahFlags[i] ? `[HAGAHAH] ${s}` : s);

  const prompt = `You are preparing a bilingual Tanya reader for daily Torah study (Tanya Yomi). Today's portion is from Chapter ${chapterNum}.

Return ONLY a JSON object — no markdown, no explanation:
{"context": "...", "blocks": [{"he": "...", "en": "...", "isHagahah": false}, ...]}

═══ CONTEXT (2-3 sentences) ═══
Write a factual intro in the style of Lessons in Tanya.
- If this is mid-chapter (not the first segment), begin: "The Alter Rebbe continues..."
- State only what appears in today's text. No forward references.
- Precise and brief.

═══ BLOCKS — CRITICAL RULES ═══
1. ONE block per SENTENCE. Split aggressively — never merge two sentences into one block.
2. If a Hebrew segment contains two clauses separated by a comma or semicolon that correspond to two English sentences, split them into two blocks.
3. Each block: one Hebrew sentence paired with its corresponding English sentence.
4. Copy every word EXACTLY. No paraphrasing, no omissions, no changes.
5. Lines marked [HAGAHAH]: set "isHagahah": true. Remove the [HAGAHAH] tag from the text.
6. All other lines: "isHagahah": false.
7. Target 10-35 words per English block.

HEBREW (${heSegs.length} lines):
${heTagged.map((s, i) => `${i + 1}. ${s}`).join('\n')}

ENGLISH (${enSegs.length} lines):
${enTagged.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = (data.content?.[0]?.text || '').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON parse failed');
    parsed = JSON.parse(m[0]);
  }

  if (!parsed.blocks?.length) throw new Error('Empty blocks');

  return {
    context: (parsed.context || '').trim(),
    blocks: parsed.blocks
      .map(b => ({
        he:        (b.he || '').replace(/^\[HAGAHAH\]\s*/i, '').trim(),
        en:        (b.en || '').replace(/^\[HAGAHAH\]\s*/i, '').trim(),
        isHagahah: Boolean(b.isHagahah),
      }))
      .filter(b => b.he || b.en),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400');
  const bust = req.query.bust === '1';

  // Accept new params (chapterSlug + verse range) OR old params (ref + segStart/End)
  let chapterSlug = req.query.chapterSlug || null;
  let startVerse  = req.query.startVerse  !== undefined ? parseInt(req.query.startVerse)  : null;
  let endVerse    = req.query.endVerse    !== undefined ? parseInt(req.query.endVerse)    : null;

  // Back-compat: old ?ref=...&segStart=...&segEnd=... → derive chapterSlug
  if (!chapterSlug && req.query.ref) {
    // ref is like "Tanya, Part I; Likkutei Amarim 41"
    // Convert to slug: "Tanya,_Part_I;_Likkutei_Amarim.41"
    const refMatch = req.query.ref.match(/^(.*?)\s+(\d+)$/);
    if (refMatch) {
      chapterSlug = refMatch[1].replace(/\s+/g, '_') + '.' + refMatch[2];
      // segStart is 0-based index → startVerse is 1-based
      startVerse = req.query.segStart !== undefined ? parseInt(req.query.segStart) + 1 : 1;
      endVerse   = req.query.segEnd   !== undefined ? parseInt(req.query.segEnd)       : null;
    }
  }

  if (!chapterSlug) return res.status(400).json({ error: 'chapterSlug (or ref) required' });

  try {
    const db = getDb();

    // Cache check
    if (!bust) {
      const cached = await getCached(db, chapterSlug, startVerse, endVerse);
      if (cached?.blocks?.length) {
        return res.status(200).json({ chapterSlug, startVerse, endVerse, context: cached.context || '', blocks: cached.blocks, source: 'cache' });
      }
    }

    // Fetch chapter from Sefaria (same way client does)
    const { allHe, allEn } = await fetchChapter(chapterSlug);
    if (!allHe.length && !allEn.length) {
      return res.status(404).json({ error: `No text found for "${chapterSlug}"` });
    }

    // Slice to today's portion (1-based verse numbers, same as client)
    const s = (startVerse || 1) - 1;           // convert to 0-based
    const e = endVerse !== null ? endVerse : Math.max(allHe.length, allEn.length);
    const rawHePortion = allHe.slice(s, e);
    const rawEnPortion = allEn.slice(s, e);

    if (!rawHePortion.length && !rawEnPortion.length) {
      return res.status(404).json({ error: `Empty slice [${s},${e}] for "${chapterSlug}"` });
    }

    // Detect hagahot from raw HTML, then clean
    const maxLen = Math.max(rawHePortion.length, rawEnPortion.length);
    const heSegs      = [];
    const enSegs      = [];
    const hagahahFlags = [];
    for (let i = 0; i < maxLen; i++) {
      const rawHe = rawHePortion[i] || '';
      const rawEn = rawEnPortion[i] || '';
      hagahahFlags.push(isHagahahRaw(rawHe, rawEn));
      heSegs.push(cleanHtml(rawHe));
      enSegs.push(cleanHtml(rawEn));
    }

    // Extract chapter number for Claude prompt
    const chNumMatch = chapterSlug.match(/\.(\d+)$/);
    const chapterNum = chNumMatch ? chNumMatch[1] : '?';

    // Call Claude
    const { context, blocks } = await processWithClaude(chapterNum, enSegs, heSegs, hagahahFlags);

    // Cache permanently
    await setCached(db, chapterSlug, startVerse, endVerse, { context, blocks });

    return res.status(200).json({
      chapterSlug, startVerse, endVerse,
      totalChapterSegs: Math.max(allHe.length, allEn.length),
      context, blocks,
      source: bust ? 'regenerated' : 'generated',
    });

  } catch(err) {
    console.error('tanya-enhance:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
