/**
 * GET /api/tanya-enhance?date=YYYY-MM-DD
 *
 * The Tanya guide for that day's Tanya Yomi (see api/_lib/tanya-guide.js): the
 * text in small Hebrew/English pieces, a chapter intro or "so far" recap, a
 * summary, flow headings and the translator's footnotes. The text is never
 * rewritten.
 *
 * The server works out the day's portion itself (from Sefaria's calendar), so
 * the app and the server can't disagree about which text it is.
 *
 *   200  the guide (and the portion's coordinates)
 *   202  being prepared right now: ask again in a few seconds
 *   4xx/502  with { error } saying why there's no guide
 *
 * Costs nothing unless someone learns: the first person to open a day's Tanya
 * (signed in or not) starts preparing it (in the background, about half a
 * minute), and it's saved for good, by text range, for everyone after. Only the
 * last week (for catching up) through tomorrow can be prepared, so at most
 * about one portion a day. &bust=1 (prepare again) is for admins (ADMIN_UIDS).
 */
import { waitUntil } from '@vercel/functions';
import { getDb, verifyUserToken, isAdmin } from './_lib/firebase.js';
import { readGuide, startPreparing } from './_lib/tanya-guide.js';
import { tanyaPortion } from './_lib/tanya-portion.js';

export const config = { maxDuration: 300 };

// Today's date in New York (the app's schedule follows US Eastern time)
const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

const send = (res, status, body) => res.status(status).json(body);

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return send(res, 400, { error: 'date needed (YYYY-MM-DD)' });

  try {
    const bust = req.query.bust === '1';
    if (bust && !isAdmin(await verifyUserToken(req))) return send(res, 403, { error: 'admins only' });
    const off = daysBetween(todayNY(), date);
    if (!bust && (off < -7 || off > 1)) return send(res, 403, { error: 'only the last week through tomorrow' });

    const p = await tanyaPortion(date);
    if (!p) return send(res, 404, { error: 'no Tanya Yomi found for ' + date });

    const db = getDb();
    const saved = !bust && await readGuide(db, p);
    if (saved) return send(res, 200, reply(p, saved, 'cache'));

    const run = await startPreparing(db, p, { force: bust });
    if (run.state === 'busy') return send(res, 202, { preparing: true });
    if (run.state === 'failed') return send(res, 502, { error: 'preparing failed a few minutes ago (' + run.error + '); it will be tried again later' });
    waitUntil(run.done.catch(() => {}));   // keeps going after we answer
    return send(res, 202, { preparing: true });
  } catch (err) {
    console.error('tanya-enhance:', err.message);
    return send(res, 502, { error: 'server problem: ' + err.message });
  }
}

const reply = (p, g, source) => ({
  ...p, source,
  intro: g.intro || '', recap: g.recap || '', summary: g.summary || '',
  notes: g.notes || [], blocks: g.blocks,
});
