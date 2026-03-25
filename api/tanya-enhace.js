/**
 * Vercel Serverless Function: /api/tanya-enhance
 *
 * Fetches a Tanya chapter from Sefaria, slices to today's portion,
 * then uses Claude Haiku to re-segment Hebrew + English into properly
 * aligned paragraph pairs.
 *
 * GET /api/tanya-enhance?ref=Tanya%2C+Part+I%3B+Likkutei+Amarim+1&segStart=0&segEnd=3
 *
 * - ref:      Full Sefaria chapter ref (e.g. "Tanya, Part I; Likkutei Amarim 1")
 * - segStart: 0-based index of first segment (tp.seg - 1)
 * - segEnd:   0-based index end exclusive (tn.seg - 1), omit = end of chapter
 *
 * Returns: { ref, segStart, segEnd, blocks: [{ he, en }] }
 *
 * Cached at Vercel edge for 30 days.
 * Cost: ~$0.003–0.01 per unique daily portion via Claude Haiku.
 */

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SEFARIA = 'https://www.sefaria.org';

function cleanHtml(s) {
  if (!s) return '';
  let out = '', i = 0;
  while (i < s.length) {
    const sup = s.slice(i).match(/^<sup\b[^>]*class="footnote-marker"[^>]*>/);
    if (sup) {
      const e = s.indexOf('</sup>', i + sup[0].length);
      if (e !== -1) { i = e + 6; continue; }
    }
    const fn = s.slice(i).match(/^<i\b[^>]*class="footnote"[^>]*>/);
    if (fn) {
      let d = 1, j = i + fn[0].length;
      while (j < s.length && d > 0) {
        const o = s.indexOf('<i', j), c = s.indexOf('</i>', j);
        if (o !== -1 && (c === -1 || o < c)) { d++; j = o + 2; }
        else if (c !== -1) { d--; j = c + 4; }
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

async function fetchChapter(ref) {
  const enc = encodeURIComponent(ref);
  const [enRes, heRes] = await Promise.all([
    fetch(`${SEFARIA}/api/v3/texts/${enc}?version=english&fill_in_missing_segments=1`)
      .then(r => r.json()).catch(() => null),
    fetch(`${SEFARIA}/api/texts/${enc}?context=0&commentary=0`)
      .then(r => r.json()).catch(() => null),
  ]);
  const engVersion = enRes?.versions?.find(v => v.language === 'en') || enRes?.versions?.[0];
  const allEn = flatten(engVersion?.text || heRes?.text || []);
  const allHe = flatten(heRes?.he || []);
  if (!allEn.length && !allHe.length) throw new Error(`No text for "${ref}"`);
  return { allEn, allHe };
}

async function alignWithClaude(ref, enSegs, heSegs) {
  const chapterNum = (ref.match(/(\d+)$/) || [])[1] || '?';

  const prompt = `You are formatting a bilingual Tanya reader. Below is today's portion from Tanya Chapter ${chapterNum}.

Re-segment both languages into aligned paragraph pairs where each {he, en} pair covers the exact same thought. Break long segments into shorter natural paragraphs (aim for 2-4 sentences, ~50-80 English words each). Short segments stay as-is.

CRITICAL RULES:
1. Reproduce every word exactly — no omissions, changes, or paraphrasing
2. Each pair must express the same content in both languages
3. Output ONLY a valid JSON array of {he, en} objects — no other text

HEBREW (${heSegs.length} segment${heSegs.length !== 1 ? 's' : ''}):
${heSegs.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

ENGLISH (${enSegs.length} segment${enSegs.length !== 1 ? 's' : ''}):
${enSegs.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

JSON:`;

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
  try {
    blocks = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`Could not parse Claude response as JSON`);
    blocks = JSON.parse(match[0]);
  }

  if (!Array.isArray(blocks) || !blocks.length) throw new Error('Empty blocks from Claude');

  return blocks
    .map(b => ({ he: (b.he || '').trim(), en: (b.en || '').trim() }))
    .filter(b => b.he || b.en);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache 30 days at Vercel edge — same portion never changes
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400');

  const { ref, segStart, segEnd } = req.query;
  if (!ref) return res.status(400).json({ error: 'ref required' });

  const start = segStart !== undefined ? parseInt(segStart) : 0;
  const end   = segEnd   !== undefined ? parseInt(segEnd)   : undefined;

  try {
    const { allEn, allHe } = await fetchChapter(ref);

    const enPortion = end !== undefined ? allEn.slice(start, end) : allEn.slice(start);
    const hePortion = end !== undefined ? allHe.slice(start, end) : allHe.slice(start);

    if (!enPortion.length && !hePortion.length) {
      return res.status(404).json({ error: `No segments in range [${start},${end}] for "${ref}"` });
    }

    const blocks = await alignWithClaude(ref, enPortion, hePortion);

    return res.status(200).json({
      ref,
      segStart: start,
      segEnd: end ?? allEn.length,
      totalChapterSegs: allEn.length,
      blocks,
    });

  } catch (err) {
    console.error('tanya-enhance:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
