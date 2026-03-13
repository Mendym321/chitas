export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  // Validate — only allow chabad.org fetches
  if (!url || !url.startsWith('https://www.chabad.org/')) {
    return res.status(400).json({ error: 'Only chabad.org URLs are allowed' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        // Mimic a real browser so Chabad.org doesn't block us
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Chabad.org returned ${response.status}` });
    }

    const html = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600'); // cache for 1 hour on Vercel edge
    res.send(html);

  } catch (err) {
    res.status(500).json({ error: 'Fetch failed', detail: err.message });
  }
}
