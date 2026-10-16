/**
 * GET /api/tanya-prepare — the daily job (Vercel Cron, see vercel.json).
 *
 * Prepares the Tanya guide for today and the next two days ahead of time, so
 * everyone (signed in or not) opens Tanya already in small pieces with the
 * intro, recap, summary and headings. Already-prepared days cost nothing.
 *
 * Only Vercel's scheduler may call it: it sends "Authorization: Bearer
 * <CRON_SECRET>" (the CRON_SECRET environment variable in Vercel).
 */
import { getDb } from './_lib/firebase.js';
import { getGuide } from './_lib/tanya-guide.js';
import { tanyaPortion, nextDay } from './_lib/tanya-portion.js';

export const config = { maxDuration: 60 };
const DAYS_AHEAD = 2;

// Today's date in New York (the app's schedule follows US Eastern time)
const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'not allowed' });

  const days = [todayNY()];
  while (days.length <= DAYS_AHEAD) days.push(nextDay(days[days.length - 1]));

  const db = getDb();
  const results = await Promise.all(days.map(async date => {
    try {
      const p = await tanyaPortion(date);
      if (!p) return { date, status: 'no portion found' };
      const r = await getGuide(db, p.chapterSlug, p.startVerse, p.endVerse);
      return { date, ...p, status: r.source, pieces: r.guide.blocks.length };
    } catch (err) {
      console.error('tanya-prepare', date, err.message);
      return { date, status: 'failed: ' + err.message };
    }
  }));
  return res.status(200).json({ results });
}
