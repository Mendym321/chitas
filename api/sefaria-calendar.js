// api/sefaria-calendar.js
// Proxy for Sefaria /api/calendars — fixes CORS blocking on chitas.vercel.app
// Usage: /api/sefaria-calendar?gy=2026&gm=4&gd=5
//        /api/sefaria-calendar  (today, uses timezone)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { gy, gm, gd } = req.query;

  let url;
  if (gy && gm && gd) {
    url = `https://www.sefaria.org/api/calendars?timezone=America/New_York&gy=${gy}&gm=${gm}&gd=${gd}`;
  } else {
    url = `https://www.sefaria.org/api/calendars?timezone=America/New_York`;
  }

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'chitas-daily/1.0' }
    });
    if (!r.ok) {
      res.status(r.status).json({ error: 'Sefaria returned ' + r.status });
      return;
    }
    const data = await r.json();
    // Cache per unique URL (query params = different URL = different cache entry)
    // s-maxage=86400: CDN caches each date's response for 24h
    // Without this fix, all date queries returned the first cached response (today's)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
