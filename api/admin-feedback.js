/**
 * GET /api/admin-feedback — the latest 100 feedback messages and mistake
 * reports, newest first, for the admin page; and the 40 errors from people's
 * phones seen most recently (error_reports, counted). Admins only (ADMIN_UIDS).
 * They hold only what people chose to write (and an email if they left one).
 */
import { getDb, verifyUserToken, isAdmin } from './_lib/firebase.js';

const send = (res, status, body) => res.status(status).json(body);

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  const who = await verifyUserToken(req);
  if (!who) return send(res, 401, { error: 'Sign in first' });
  if (!isAdmin(who)) return send(res, 403, { error: 'admins only' });
  try {
    const db = getDb();
    const [snap, errs] = await Promise.all([
      db.collection('feedback').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('error_reports').orderBy('lastSeen', 'desc').limit(40).get().catch(() => null),
    ]);
    return send(res, 200, { items: snap.docs.map(d => ({ id: d.id, ...d.data() })), errors: errs ? errs.docs.map(d => d.data()) : [] });
  } catch (e) {
    console.error('admin-feedback:', e);
    return send(res, 500, { error: 'Could not load feedback. ' + (e.message || '') });
  }
}
