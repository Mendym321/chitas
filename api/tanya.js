/**
 * Vercel Serverless Function: /api/tanya
 *
 * Fetches the daily Tanya lesson from Chabad.org and parses it into
 * structured JSON: { title, blocks: [{he, en, lit}] }
 *
 * GET /api/tanya?date=MM/DD/YYYY   (or no date = today)
 *
 * No API key needed — just fetches Chabad.org server-side (avoids CORS).
 * Cache: 24h via Vercel edge cache headers.
 */

const CHABAD_BASE = 'https://www.chabad.org/dailystudy/tanya.asp';

// ── Fetch Chabad page ─────────────────────────────────────────────────────────

async function fetchChabadTanya(dateStr) {
  const url = dateStr
    ? `${CHABAD_BASE}?tdate=${encodeURIComponent(dateStr)}`
    : CHABAD_BASE;

  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!r.ok) throw new Error(`Chabad fetch failed: HTTP ${r.status}`);
  return r.text();
}

// ── HTML parser (no DOM available in Node — use regex + string parsing) ───────

function cleanText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove footnote markers
    .replace(/<sup[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<i[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/i>/gi, '')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Clean whitespace
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isHebrew(text) {
  // True if the first 20 non-space chars are mostly Hebrew unicode
  const sample = text.replace(/\s/g, '').slice(0, 20);
  const heCount = (sample.match(/[\u05D0-\u05EA]/g) || []).length;
  return heCount > 3;
}

function extractParagraphs(html) {
  // Extract all <p> tag contents
  const paras = [];
  const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(html)) !== null) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const text = cleanText(inner);
    if (text.length < 8) continue;

    const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || '';
    const dir = (attrs.match(/dir="([^"]*)"/) || [])[1] || '';

    paras.push({
      text,
      cls: cls.toLowerCase(),
      dir: dir.toLowerCase(),
      he: isHebrew(text) || dir === 'rtl',
    });
  }
  return paras;
}

function findTitle(html) {
  // Try h2, h3 in order — Chabad uses h2 for chapter titles
  for (const tag of ['h2', 'h3', 'h1']) {
    const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (m) {
      const t = cleanText(m[1]);
      if (t.length > 5 && t.length < 300) return t;
    }
  }
  return 'Daily Tanya';
}

function findContentSection(html) {
  // Try to find the main article content div
  // Chabad uses various class names — try the most specific first
  const selectors = [
    /class="[^"]*article-body[^"]*"/i,
    /class="[^"]*articleBody[^"]*"/i,
    /class="[^"]*study-content[^"]*"/i,
    /class="[^"]*lesson-content[^"]*"/i,
    /id="article-body"/i,
    /id="content"/i,
  ];

  for (const sel of selectors) {
    const startMatch = html.search(sel);
    if (startMatch === -1) continue;

    // Find the opening tag
    const tagStart = html.lastIndexOf('<', startMatch);
    if (tagStart === -1) continue;

    // Find matching closing div — track nesting
    let depth = 1, i = html.indexOf('>', startMatch) + 1;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
        depth++;
        i = nextOpen + 4;
      } else if (nextClose !== -1) {
        depth--;
        i = nextClose + 6;
      } else {
        break;
      }
    }
    const section = html.slice(tagStart, i);
    if (section.length > 300) return section;
  }

  // Fallback: return everything between first h2 and end of main content
  const h2Pos = html.search(/<h2/i);
  if (h2Pos !== -1) return html.slice(h2Pos);
  return html;
}

// ── Group paragraphs into HE+EN+LiT blocks ───────────────────────────────────

function groupIntoBlocks(paras) {
  // Lessons in Tanya commentary hints — it's longer, explanatory English
  function isLit(p) {
    if (p.he) return false;
    return p.cls.includes('lesson') || p.cls.includes('comment') || p.cls.includes('explanat')
      || p.text.includes('Alter Rebbe') || p.text.includes('This refers to')
      || p.text.includes('This means') || p.text.includes('In other words')
      || p.text.includes('explains that') || p.text.includes('the verse')
      || p.text.includes('i.e.,') || p.text.includes('i.e..')
      || p.text.length > 400; // LiT commentary tends to be longer
  }

  const blocks = [];
  let i = 0;

  while (i < paras.length) {
    const cur = paras[i];

    if (cur.he) {
      // Hebrew paragraph — collect following EN translation + LiT commentary
      const block = { he: cur.text, en: '', lit: '' };
      i++;

      // Next non-Hebrew is the English translation
      if (i < paras.length && !paras[i].he) {
        block.en = paras[i].text;
        i++;

        // Collect Lessons in Tanya commentary paragraphs
        const litParts = [];
        while (i < paras.length && !paras[i].he && isLit(paras[i])) {
          litParts.push(paras[i].text);
          i++;
        }
        block.lit = litParts.join('\n\n');
      }

      blocks.push(block);

    } else if (isLit(cur) && blocks.length > 0) {
      // Orphaned LiT — append to last block
      blocks[blocks.length - 1].lit += (blocks[blocks.length - 1].lit ? '\n\n' : '') + cur.text;
      i++;

    } else {
      // Orphaned EN — attach to last block if it has no EN, else new block
      if (blocks.length > 0 && !blocks[blocks.length - 1].en) {
        blocks[blocks.length - 1].en = cur.text;
      } else {
        blocks.push({ he: '', en: cur.text, lit: '' });
      }
      i++;
    }
  }

  return blocks.filter(b => b.he || b.en);
}

// ── Main parse ────────────────────────────────────────────────────────────────

function parseChabad(html) {
  const title = findTitle(html);
  const section = findContentSection(html);
  const paras = extractParagraphs(section);
  const blocks = groupIntoBlocks(paras);

  return {
    title,
    blocks,
    meta: {
      totalParas: paras.length,
      heParas: paras.filter(p => p.he).length,
      enParas: paras.filter(p => !p.he).length,
      blocksWithLit: blocks.filter(b => b.lit).length,
    },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache for 6 hours — Tanya content doesn't change during the day
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

  const dateStr = req.query.date || null; // MM/DD/YYYY or null for today

  try {
    const html = await fetchChabadTanya(dateStr);
    const result = parseChabad(html);

    if (!result.blocks.length) {
      return res.status(502).json({
        error: 'No content parsed from Chabad',
        meta: result.meta,
      });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Tanya proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
