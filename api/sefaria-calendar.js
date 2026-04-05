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
    // Cache for 1 hour — calendar data doesn't change within a day
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
