/**
 * GET /api/rambam-paras?ref=Mishneh Torah, Sales 4
 *
 * (Served by api/tanya-enhance.js, through the rewrite in vercel.json: Vercel's
 * plan allows 12 functions, and both prepare a reading aid once and save it.)
 *
 * The chapter's Hebrew split to match the paragraphs of its English
 * translation, and its guide (see api/_lib/rambam-paras.js). Worked out once per chapter (one AI call, about 2 cents) and saved
 * for everyone, for good.
 *
 *   200  { ref, halachot: { "3": { he: [pieces], en: [counts] } }, guide: { about, heads, notes } }
 *   202  being worked out right now by someone else: try again later
 *   429  today's limit of new chapters is reached (the text shows without splits)
 *   400/404/502 with { error }
 */
import { getDb } from './firebase.js';
import { prepareParas, parasDocId } from './rambam-paras.js';
import { takeDailyQuota } from './quota.js';

const REF = /^Mishneh Torah, [A-Za-z' ,\-]{2,60} \d{1,3}$/;   // one chapter
const NEW_PER_DAY = 120;              // new chapters a day, for everyone (a few dollars at most)
const LOCK_FOR = 90 * 1000;           // longer than one preparation takes

const send = (res, status, body) => res.status(status).json(body);
const reply = d => ({ ref: d.ref, halachot: d.halachot || {}, guide: d.guide || null });

export async function rambamParasHandler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  const ref = String(req.query.ref || '');
  if (!REF.test(ref)) return send(res, 400, { error: 'one Mishneh Torah chapter needed, e.g. "Mishneh Torah, Sales 4"' });
  try {
    const db = getDb();
    const doc = db.collection('rambam_paras').doc(parasDocId(ref));
    const saved = await doc.get();
    if (saved.exists) return send(res, 200, reply(saved.data()));

    // One preparation at a time per chapter
    const lock = db.collection('rambam_paras_locks').doc(parasDocId(ref));
    try { await lock.create({ at: Date.now() }); }
    catch {
      const held = (await lock.get().catch(() => null))?.data?.();
      if (Date.now() - (held?.at || 0) < LOCK_FOR) return send(res, 202, { preparing: true });
      await lock.set({ at: Date.now() });
    }
    try {
      if (!(await takeDailyQuota(db, 'all', 'rambam_paras', NEW_PER_DAY))) return send(res, 429, { error: "today's limit of new chapters is reached" });
      const result = await prepareParas(ref);
      await doc.set(result);
      return send(res, 200, reply(result));
    } finally {
      await lock.delete().catch(() => {});
    }
  } catch (err) {
    console.error('rambam-paras:', err.message);
    return send(res, err.status || 502, { error: err.message });
  }
}
