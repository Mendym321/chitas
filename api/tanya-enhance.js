/**
 * GET /api/tanya-enhance?chapterSlug=Tanya,_Part_I;_Likkutei_Amarim.41&startVerse=5&endVerse=9
 *
 * The Tanya guide for one daily portion (see api/_lib/tanya-guide.js): the text
 * in small Hebrew/English pieces, a chapter intro or "so far" recap, a summary,
 * flow headings and the translator's footnotes. The text is never rewritten.
 *
 * Usually already prepared by the daily job (/api/tanya-prepare), so anyone
 * gets it. Making a NEW one on demand needs a signed-in user (Authorization:
 * Bearer <Firebase ID token>) and counts toward a daily limit. &bust=1
 * (regenerate) is for admins only (ADMIN_UIDS: uids or emails).
 */
import { getDb, verifyUserToken, isAdmin } from './_lib/firebase.js';
import { takeDailyQuota } from './_lib/quota.js';
import { getGuide } from './_lib/tanya-guide.js';
import { TANYA_SLUG } from './_lib/quiz-core.js';

export const config = { maxDuration: 60 };

const NEW_PER_DAY = 10;             // per user; saved portions don't count

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const chapterSlug = String(req.query.chapterSlug || '');
  const startVerse = parseInt(req.query.startVerse, 10);
  const endVerse = req.query.endVerse !== undefined ? parseInt(req.query.endVerse, 10) : null;
  if (!TANYA_SLUG.test(chapterSlug) || !(startVerse >= 1 && startVerse <= 200) ||
      (endVerse !== null && !(endVerse >= startVerse && endVerse <= 200)))
    return res.status(400).json({ error: 'bad chapterSlug / verse range' });

  const db = getDb();
  const who = await verifyUserToken(req);
  const bust = req.query.bust === '1';
  if (bust && !isAdmin(who)) return res.status(403).json({ error: 'admins only' });

  try {
    const r = await getGuide(db, chapterSlug, startVerse, endVerse, {
      bust,
      mayGenerate: async () => {
        if (!who?.uid) return 401;
        if (!bust && !(await takeDailyQuota(db, who.uid, 'tanya', NEW_PER_DAY))) return 429;
        return true;
      },
    });
    if (r.refused) return res.status(r.refused).json({ error: r.refused === 401 ? 'sign in needed' : 'daily limit' });
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
