/**
 * GET /api/dedication?date=YYYY-MM-DD → { text, line, by } (or nulls)
 * text: the whole sentence (above the texts); line and by: its parts (the plaque on Today).
 * The day's dedication, once the admin has approved it. Everyone asks for the
 * same few days, so the answer is kept at Vercel's edge for a few minutes:
 * thousands of people learning cost a handful of database reads.
 */
import { getDb } from './_lib/firebase.js';
import { dedicationParts } from './_lib/sponsor.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const date = String(req.query?.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD' });
  try {
    const snap = await getDb().collection('sponsorships').doc(date).get();
    const d = snap.exists ? snap.data() : null;
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600');
    if (d?.status !== 'approved' || !d.text) return res.status(200).json({ text: null, line: null, by: null });
    const parts = dedicationParts(d) || { line: null, by: null };
    return res.status(200).json({ text: d.text, line: parts.line, by: parts.by });
  } catch (e) {
    console.error('dedication:', e);
    return res.status(200).json({ text: null, line: null, by: null });           // a dedication is never worth an error
  }
}
