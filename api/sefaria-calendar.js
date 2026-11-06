// api/sefaria-calendar.js
// Proxy for Sefaria /api/calendars — fixes CORS blocking on chitas.vercel.app
// Usage: /api/sefaria-calendar?gy=2026&gm=4&gd=5
//        /api/sefaria-calendar  (today, uses timezone)
//
// Sefaria reads the date as year/month/day (the same names /api/tanya-boundary
// uses); the app sends gy/gm/gd. Only whole numbers in range are passed on.

const num = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { gy, gm, gd } = req.query;
  let url = 'https://www.sefaria.org/api/calendars?timezone=America/New_York';
  if (gy || gm || gd) {
    const y = num(gy, 1900, 2200), m = num(gm, 1, 12), d = num(gd, 1, 31);
    if (y === null || m === null || d === null) { res.status(400).json({ error: 'Bad date' }); return; }
    url += `&year=${y}&month=${m}&day=${d}`;
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
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Couldn\'t reach Sefaria' });
  }
}
