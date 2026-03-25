/**
 * Vercel Cron Job: /api/cron-tanya
 *
 * Runs daily at 5:01am UTC (midnight EST / 1am EDT).
 * Fetches today's Tanya portion from Sefaria calendar,
 * then calls /api/tanya-enhance to generate + cache aligned blocks.
 * By the time users open the app, the cache is warm — zero wait.
 *
 * Also pre-fetches tomorrow's portion so late-night users are covered.
 *
 * Schedule set in vercel.json:
 *   { "path": "/api/cron-tanya", "schedule": "1 5 * * *" }
 *
 * Vercel cron docs: https://vercel.com/docs/cron-jobs
 * Note: cron jobs are only available on Vercel Pro plan and above.
 */

const SEFARIA = 'https://www.sefaria.org';

// ── Parse a Tanya calendar ref into components ─────────────────────────────────
// e.g. "Tanya, Part I; Likkutei Amarim 38:9" → { base, chapter, seg }
function parseTanyaRef(ref) {
  if (!ref) return null;
  const m = ref.match(/^(.*?)(\d+):(\d+)$/);
  if (!m) return null;
  return {
    base:    m[1].replace(/:$/, '').trim(),
    chapter: parseInt(m[2]),
    seg:     parseInt(m[3]),
  };
}

// ── Get today's Tanya ref from Sefaria calendar ────────────────────────────────
async function getCalTanya(date) {
  const url = `${SEFARIA}/api/calendars?year=${date.getFullYear()}&month=${date.getMonth()+1}&day=${date.getDate()}`;
  const d = await fetch(url).then(r => r.json()).catch(() => null);
  return (d?.calendar_items || []).find(i =>
    (i.title?.en || '').toLowerCase().includes('tanya') ||
    (i.ref || '').toLowerCase().includes('tanya')
  )?.ref || null;
}

// ── Trigger the enhance API for a given date ───────────────────────────────────
async function warmCacheForDate(date, baseUrl) {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);

  // Fetch today + tomorrow refs in parallel (need tomorrow to know segment end)
  const [todayRef, tomorrowRef] = await Promise.all([
    getCalTanya(date),
    getCalTanya(tomorrow),
  ]);

  if (!todayRef) {
    console.log(`No Tanya ref found for ${date.toISOString().slice(0, 10)}`);
    return { date: date.toISOString().slice(0, 10), status: 'no_ref' };
  }

  const tp = parseTanyaRef(todayRef);
  const tn = tomorrowRef ? parseTanyaRef(tomorrowRef) : null;

  if (!tp) {
    console.log(`Could not parse ref: ${todayRef}`);
    return { date: date.toISOString().slice(0, 10), status: 'parse_error', ref: todayRef };
  }

  const chapterRef = `${tp.base} ${tp.chapter}`;
  const segStart   = tp.seg - 1;
  const segEnd     = (tn && tp.chapter === tn.chapter) ? tn.seg - 1 : undefined;

  const apiUrl = `${baseUrl}/api/tanya-enhance`
    + `?ref=${encodeURIComponent(chapterRef)}`
    + `&segStart=${segStart}`
    + (segEnd !== undefined ? `&segEnd=${segEnd}` : '');

  console.log(`Warming cache: ${chapterRef} [${segStart}${segEnd !== undefined ? `-${segEnd}` : '+'}]`);

  const res = await fetch(apiUrl).catch(e => ({ ok: false, error: e.message }));

  if (!res.ok) {
    const text = await res.text?.().catch(() => '');
    console.error(`Enhance API error: ${res.status} ${text.slice(0, 200)}`);
    return {
      date: date.toISOString().slice(0, 10),
      status: 'api_error',
      ref: chapterRef,
      segStart,
      segEnd,
    };
  }

  const data = await res.json().catch(() => null);
  const source = data?.source || 'unknown';

  console.log(`Cache warmed: ${chapterRef} — source: ${source} (${data?.blocks?.length || 0} blocks)`);

  return {
    date:     date.toISOString().slice(0, 10),
    status:   'ok',
    source,
    ref:      chapterRef,
    segStart,
    segEnd,
    blocks:   data?.blocks?.length || 0,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel verifies cron requests — only allow from Vercel or internal
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isInternal   = req.headers['x-internal-token'] === process.env.CRON_SECRET;

  if (!isVercelCron && !isInternal) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get the base URL from the request (works in both preview and production)
  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const host    = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const today    = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  try {
    // Warm today + tomorrow in parallel
    // Tomorrow is pre-warmed so late-night users (after midnight) are covered
    const [todayResult, tomorrowResult] = await Promise.all([
      warmCacheForDate(today, baseUrl),
      warmCacheForDate(tomorrow, baseUrl),
    ]);

    return res.status(200).json({
      success: true,
      results: [todayResult, tomorrowResult],
      ranAt:   new Date().toISOString(),
    });

  } catch (err) {
    console.error('Cron error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
