/**
 * GET /api/tanya-enhance?chapterSlug=Tanya,_Part_I;_Likkutei_Amarim.41&startVerse=5&endVerse=9
 *
 * The Tanya guide for one daily portion (see api/_lib/tanya-guide.js): the text
 * in small Hebrew/English pieces, a chapter intro or "so far" recap, a summary,
 * flow headings and the translator's footnotes. The text is never rewritten.
 *
 * Costs nothing unless someone learns: the first person to open a portion
 * (signed in or not) prepares it, and it's saved for everyone after. Only a
 * portion that is really on the Tanya Yomi schedule (the last week, for
 * catching up, through tomorrow) can be prepared, so at most about one a day.
 * While someone else is preparing it, the answer is 202 (ask again shortly).
 * &bust=1 (regenerate any portion) is for admins only (ADMIN_UIDS).
 */
import { getDb, verifyUserToken, isAdmin } from './_lib/firebase.js';
import { getGuide } from './_lib/tanya-guide.js';
import { scheduledPortions, samePortion } from './_lib/tanya-portion.js';
import { TANYA_SLUG } from './_lib/quiz-core.js';

export const config = { maxDuration: 60 };

// Today's date in New York (the app's schedule follows US Eastern time)
const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const chapterSlug = String(req.query.chapterSlug || '');
  const startVerse = parseInt(req.query.startVerse, 10);
  const endVerse = req.query.endVerse !== undefined ? parseInt(req.query.endVerse, 10) : null;
  if (!TANYA_SLUG.test(chapterSlug) || !(startVerse >= 1 && startVerse <= 200) ||
      (endVerse !== null && !(endVerse >= startVerse && endVerse <= 200)))
    return res.status(400).json({ error: 'bad chapterSlug / verse range' });

  const db = getDb();
  const bust = req.query.bust === '1';
  if (bust && !isAdmin(await verifyUserToken(req))) return res.status(403).json({ error: 'admins only' });

  try {
    const asked = { chapterSlug, startVerse, endVerse };
    const r = await getGuide(db, chapterSlug, startVerse, endVerse, {
      bust,
      mayGenerate: async () => bust || (await scheduledPortions(todayNY())).some(p => samePortion(p, asked)) || 403,
    });
    if (r.refused) return res.status(r.refused).json({ error: 'not on the Tanya Yomi schedule' });
    if (r.busy) return res.status(202).json({ preparing: true });
    const g = r.guide;
    return res.status(200).json({
      chapterSlug, startVerse, endVerse,
      intro: g.intro || '', recap: g.recap || '', summary: g.summary || g.context || '',
      notes: g.notes || [], blocks: g.blocks,
      source: bust && r.source === 'generated' ? 'regenerated' : r.source,
    });
  } catch (err) {
    console.error('tanya-enhance:', err.message);
    return res.status(err.status || 502).json({ error: err.status === 404 ? err.message : 'could not prepare this portion' });
  }
}
