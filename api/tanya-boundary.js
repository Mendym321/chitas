/**
 * /api/tanya-boundary — tomorrow-slice method
 * 
 * Uses item.url (dot-separated slug) which works reliably with Sefaria
 * date params server-side. Returns today + tomorrow url fields so the
 * client can do an exact slice.
 * 
 * GET /api/tanya-boundary?date=YYYY-MM-DD
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const dateStr = req.query.date;
  const date = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(date.getUTCDate() + 1);

  async function fetchItem(d) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const url = `https://www.sefaria.org/api/calendars?year=${y}&month=${m}&day=${day}`;
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily/1.0)' }
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data.calendar_items?.find(i => i.title?.en === 'Tanya Yomi') || null;
    } catch(e) { return null; }
  }

  const [todayItem, tomorrowItem] = await Promise.all([
    fetchItem(date),
    fetchItem(tomorrow),
  ]);

  const sameItem = todayItem?.url && tomorrowItem?.url && todayItem.url === tomorrowItem.url;

  res.status(200).json({
    today:        todayItem?.ref  || null,
    todayUrl:     todayItem?.url  || null,
    tomorrow:     sameItem ? null : (tomorrowItem?.ref || null),
    tomorrowUrl:  sameItem ? null : (tomorrowItem?.url || null),
    isApproximate: sameItem || !tomorrowItem,
    displayHe:    todayItem?.displayValue?.he || null,
    displayEn:    todayItem?.displayValue?.en || null,
  });
}
