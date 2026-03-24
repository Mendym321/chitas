/**
 * Vercel Serverless Function: /api/tanya
 *
 * Fetches daily Tanya from Chabad.org and parses into structured JSON.
 * Uses multiple fetch strategies to handle Chabad's bot protection.
 *
 * GET /api/tanya?date=MM/DD/YYYY
 */

const CHABAD_BASE = 'https://www.chabad.org/dailystudy/tanya.asp';

// ── Fetch strategies (tried in order) ────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.chabad.org/',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

async function fetchDirect(url) {
  const r = await fetch(url, { headers: BROWSER_HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function fetchViaCorsproxy(url) {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  const r = await fetch(proxyUrl, {
    headers: {
      'User-Agent': BROWSER_HEADERS['User-Agent'],
      'x-requested-with': 'XMLHttpRequest',
    }
  });
  if (!r.ok) throw new Error(`corsproxy HTTP ${r.status}`);
  const text = await r.text();
  if (text.length < 500) throw new Error('corsproxy returned too little content');
  return text;
}

async function fetchViaAllOrigins(url) {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r = await fetch(proxyUrl);
  if (!r.ok) throw new Error(`allorigins HTTP ${r.status}`);
  const text = await r.text();
  if (text.length < 500) throw new Error('allorigins returned too little content');
  return text;
}

async function fetchViaScraperApi(url) {
  // Free tier of scraperapi.com — 1000 req/month free
  // Requires SCRAPER_API_KEY env var — optional
  const key = process.env.SCRAPER_API_KEY;
  if (!key) throw new Error('No SCRAPER_API_KEY');
  const proxyUrl = `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}`;
  const r = await fetch(proxyUrl);
  if (!r.ok) throw new Error(`scraperapi HTTP ${r.status}`);
  return r.text();
}

async function fetchWithFallbacks(url) {
  const strategies = [
    { name: 'direct', fn: () => fetchDirect(url) },
    { name: 'corsproxy', fn: () => fetchViaCorsproxy(url) },
    { name: 'allorigins', fn: () => fetchViaAllOrigins(url) },
    { name: 'scraperapi', fn: () => fetchViaScraperApi(url) },
  ];

  const errors = [];
  for (const { name, fn } of strategies) {
    try {
      console.log(`Trying ${name}...`);
      const html = await fn();
      console.log(`${name} success: ${html.length} bytes`);
      return { html, strategy: name };
    } catch(e) {
      console.warn(`${name} failed: ${e.message}`);
      errors.push(`${name}: ${e.message}`);
    }
  }
  throw new Error('All fetch strategies failed: ' + errors.join(' | '));
}

// ── HTML parsing (Node.js — no DOM, use regex) ────────────────────────────────

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013');
}

function stripTags(html) {
  // Remove footnotes first
  let s = html
    .replace(/<sup[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<i[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/i>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(s).replace(/\s+/g, ' ').trim();
}

function isHebrew(text) {
  const sample = text.replace(/\s/g, '').slice(0, 30);
  return (sample.match(/[\u05D0-\u05EA]/g) || []).length > 4;
}

function findTitle(html) {
  // Try h2 first (Chabad uses h2 for chapter titles like "Likkutei Amarim, Chapter 38")
  const patterns = [
    /<h2[^>]*>([\s\S]*?)<\/h2>/i,
    /<h3[^>]*>([\s\S]*?)<\/h3>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      const t = stripTags(m[1]);
      if (t.length > 4 && t.length < 300 && !t.toLowerCase().includes('chabad')) return t;
    }
  }
  return 'Daily Tanya';
}

function extractMainContent(html) {
  // Find the article body div — try class-based selectors
  const classPatterns = [
    'article-body', 'articleBody', 'article_body',
    'study-content', 'studyContent',
    'lesson-content', 'lessonContent',
    'tanya-content', 'daily-content',
  ];

  for (const cls of classPatterns) {
    // Find opening tag with this class
    const openRe = new RegExp(`<div[^>]*class="[^"]*${cls}[^"]*"[^>]*>`, 'i');
    const start = html.search(openRe);
    if (start === -1) continue;

    // Find matching </div> by tracking depth
    let depth = 1;
    let i = html.indexOf('>', start) + 1;
    while (i < html.length && depth > 0) {
      const nextOpen  = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
        depth++; i = nextOpen + 4;
      } else if (nextClose !== -1) {
        depth--; i = nextClose + 6;
      } else break;
    }

    const section = html.slice(start, i);
    if (section.length > 400) {
      console.log(`Found content via class "${cls}": ${section.length} chars`);
      return section;
    }
  }

  // Fallback: everything after the first h2
  const h2 = html.search(/<h2/i);
  if (h2 !== -1) {
    console.log('Fallback: content after h2');
    return html.slice(h2);
  }

  console.log('Fallback: full HTML');
  return html;
}

function extractParagraphs(html) {
  const paras = [];
  const re = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const text = stripTags(m[2] || '');
    if (text.length < 8) continue;

    const cls = ((attrs.match(/class="([^"]*)"/) || [])[1] || '').toLowerCase();
    const dir = ((attrs.match(/dir="([^"]*)"/) || [])[1] || '').toLowerCase();
    const lang = ((attrs.match(/lang="([^"]*)"/) || [])[1] || '').toLowerCase();

    const he = isHebrew(text) || dir === 'rtl' || lang.startsWith('he') || cls.includes('hebrew') || cls.includes(' he ') || cls === 'he';

    paras.push({ text, cls, he });
  }
  return paras;
}

function groupBlocks(paras) {
  function isLit(p) {
    if (p.he) return false;
    // Lessons in Tanya hallmarks
    return p.text.includes('Alter Rebbe') ||
           p.text.includes('This refers') ||
           p.text.includes('In other words') ||
           p.text.includes('explains that') ||
           p.text.includes('i.e.,') ||
           p.text.includes('the verse') ||
           p.cls.includes('lesson') ||
           p.cls.includes('comment') ||
           p.text.length > 350;  // LiT commentary is typically longer
  }

  const blocks = [];
  let i = 0;

  while (i < paras.length) {
    const cur = paras[i];

    if (cur.he) {
      const block = { he: cur.text, en: '', lit: '' };
      i++;

      if (i < paras.length && !paras[i].he) {
        block.en = paras[i].text;
        i++;

        const litParts = [];
        while (i < paras.length && !paras[i].he && isLit(paras[i])) {
          litParts.push(paras[i].text);
          i++;
        }
        if (litParts.length) block.lit = litParts.join('\n\n');
      }

      blocks.push(block);

    } else if (isLit(cur) && blocks.length > 0) {
      blocks[blocks.length - 1].lit += (blocks[blocks.length - 1].lit ? '\n\n' : '') + cur.text;
      i++;

    } else {
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

function parse(html) {
  const title   = findTitle(html);
  const section = extractMainContent(html);
  const paras   = extractParagraphs(section);
  const blocks  = groupBlocks(paras);

  console.log(`Parsed: title="${title}" paras=${paras.length} he=${paras.filter(p=>p.he).length} en=${paras.filter(p=>!p.he).length} blocks=${blocks.length} withLit=${blocks.filter(b=>b.lit).length}`);

  return { title, blocks, meta: { paras: paras.length, blocks: blocks.length, withLit: blocks.filter(b=>b.lit).length } };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 6-hour edge cache
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

  const dateStr = req.query.date || null; // MM/DD/YYYY
  const url = dateStr
    ? `${CHABAD_BASE}?tdate=${encodeURIComponent(dateStr)}`
    : CHABAD_BASE;

  try {
    const { html, strategy } = await fetchWithFallbacks(url);
    const result = parse(html);

    if (!result.blocks.length) {
      return res.status(502).json({ error: 'No blocks parsed', meta: result.meta });
    }

    return res.status(200).json({ ...result, strategy });

  } catch (err) {
    console.error('Tanya API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
