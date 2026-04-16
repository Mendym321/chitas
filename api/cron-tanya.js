/**
 * /api/cron-tanya
 *
 * Runs daily at 5:01am UTC. Warms the tanya-enhance cache for today + tomorrow
 * using the EXACT same chapterSlug + verse range the client uses — so cache
 * keys always match and users get instant cached responses.
 *
 * Schedule in vercel.json:
 *   { "path": "/api/cron-tanya", "schedule": "1 5 * * *" }
 */

const SEFARIA = 'https://www.sefaria.org';

// Parse Sefaria url slug: "Tanya,_Part_I;_Likkutei_Amarim.41.5"
// → { chapterSlug: "Tanya,_Part_I;_Likkutei_Amarim.41", chapter: 41, verse: 5 }
function parseUrlSlug(url) {
  if (!url) return null;
  const m = url.match(/\.([0-9]+)\.([0-9]+)$/);
  if (!m) return null;
  return {
    chapterSlug: url.substring(0, url.lastIndexOf('.')), // everything before last dot
    chapter: parseInt(m[1]),
    verse:   parseInt(m[2]),
  };
}

// Fetch today's Tanya item from Sefaria calendar (returns item with url + ref)
async function getCalTanyaItem(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const url = `${SEFARIA}/api/calendars?year=${y}&month=${m}&day=${d}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily/1.0)' }
    });
    const data = await res.json();
    return (data?.calendar_items || []).find(i => i.title?.en === 'Tanya Yomi') || null;
  } catch(e) {
    console.error('Calendar fetch error:', e.message);
    return null;
  }
}

// Warm the enhance cache for a given date — mirrors client's exact fetch
async function warmCacheForDate(date, baseUrl) {
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(date.getUTCDate() + 1);

  const [todayItem, tomorrowItem] = await Promise.all([
    getCalTanyaItem(date),
    getCalTanyaItem(tomorrow),
  ]);

  if (!todayItem?.url) {
    return { date: date.toISOString().slice(0, 10), status: 'no_ref' };
  }

  const t = parseUrlSlug(todayItem.url);
  const n = tomorrowItem?.url ? parseUrlSlug(tomorrowItem.url) : null;

  if (!t) {
    return { date: date.toISOString().slice(0, 10), status: 'parse_error', url: todayItem.url };
  }

  const startVerse = t.verse;
  let endVerse;
  const sameChapter = n && t.chapterSlug === n.chapterSlug;
  if (sameChapter && n.verse > startVerse) {
    endVerse = n.verse - 1; // today ends one verse before tomorrow starts
  } else {
    endVerse = null; // end of chapter — no endVerse param
  }

  const apiUrl = `${baseUrl}/api/tanya-enhance`
    + `?chapterSlug=${encodeURIComponent(t.chapterSlug)}`
    + `&startVerse=${startVerse}`
    + (endVerse !== null ? `&endVerse=${endVerse}` : '');

  console.log(`Warming: ${t.chapterSlug} v${startVerse}${endVerse ? '-' + endVerse : '+'}`);

  const res = await fetch(apiUrl).catch(e => ({ ok: false, statusText: e.message }));

  if (!res.ok) {
    const text = await res.text?.().catch(() => '');
    console.error(`Enhance error ${res.status}: ${text.slice(0, 200)}`);
    return { date: date.toISOString().slice(0, 10), status: 'api_error', chapterSlug: t.chapterSlug };
  }

  const data = await res.json().catch(() => null);
  console.log(`Warmed: ${t.chapterSlug} — source: ${data?.source} (${data?.blocks?.length || 0} blocks)`);

  return {
    date:         date.toISOString().slice(0, 10),
    status:       'ok',
    source:       data?.source,
    chapterSlug:  t.chapterSlug,
    startVerse,
    endVerse,
    blocks:       data?.blocks?.length || 0,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isInternal   = req.headers['x-internal-token'] === process.env.CRON_SECRET;
  if (!isVercelCron && !isInternal) return res.status(401).json({ error: 'Unauthorized' });

  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const host    = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const today    = new Date();
  const tomorrow = new Date(today); tomorrow.setUTCDate(today.getUTCDate() + 1);

  try {
    const [todayResult, tomorrowResult] = await Promise.all([
      warmCacheForDate(today,    baseUrl),
      warmCacheForDate(tomorrow, baseUrl),
    ]);
    return res.status(200).json({ success: true, results: [todayResult, tomorrowResult], ranAt: new Date().toISOString() });
  } catch(err) {
    console.error('Cron error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
