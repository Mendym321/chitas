/**
 * /api/tanya-boundary
 * 
 * Returns today's and tomorrow's Tanya Yomi refs from Sefaria.
 * Called server-side from Vercel so date params WORK 
 * (Sefaria blocks these cross-origin from browsers, but server-side is fine).
 * 
 * GET /api/tanya-boundary?date=YYYY-MM-DD
 * Returns: { today: "Tanya, Part I; Likkutei Amarim 41:5", tomorrow: "...41:9" }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const dateStr = req.query.date; // YYYY-MM-DD
  const date = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(date.getUTCDate() + 1);

  async function fetchTanyaRef(d) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    // These date params work server-side; CORS blocks them from browsers
    const url = `https://www.sefaria.org/api/calendars?year=${y}&month=${m}&day=${day}&timezone=America/New_York`;
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'chitas-daily/1.0' }
      });
      if (!r.ok) return null;
      const data = await r.json();
      const item = (data.calendar_items || []).find(i =>
        (i.title?.en || '').toLowerCase().includes('tanya') ||
        (i.ref || '').toLowerCase().includes('tanya')
      );
      return item?.ref || null;
    } catch(e) {
      return null;
    }
  }

  const [todayRef, tomorrowRef] = await Promise.all([
    fetchTanyaRef(date),
    fetchTanyaRef(tomorrow),
  ]);

  res.status(200).json({ today: todayRef, tomorrow: tomorrowRef });
}
