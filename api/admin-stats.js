/**
 * GET /api/admin-stats?today=YYYY-MM-DD — how the app is used, for the admin page.
 *
 * Header: Authorization: Bearer <Firebase ID token>. Only admins (ADMIN_UIDS on
 * Vercel) get an answer. Everything returned is a count: no names, emails,
 * cities, Tehillim names, user ids or any one person's history. The database
 * is asked only for the fields that are counted (select), so the rest is never
 * even read. See api/_lib/admin-stats.js.
 */
import { getDb, verifyUserToken, isAdmin, signupDates } from './_lib/firebase.js';
import { summarize } from './_lib/admin-stats.js';

const send = (res, status, body) => res.status(status).json(body);
let cached = null;   // { key, at, body }: the same numbers for 5 minutes (each look reads every account)

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  const who = await verifyUserToken(req);
  if (!who) return send(res, 401, { error: 'Sign in first' });
  if (!isAdmin(who)) return send(res, 403, { error: 'admins only' });
  const q = String(req.query?.today || '');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : new Date().toISOString().slice(0, 10);
  if (cached && cached.key === today && Date.now() - cached.at < 5 * 60e3 && !req.query?.fresh) return send(res, 200, cached.body);
  try {
    const db = getDb();
    const usageDay = new Date().toISOString().slice(0, 10);   // the daily limits count by the server's (UTC) day
    const [users, quizzes, quizUse, tanyaUse, guides, failed, signups, shares] = await Promise.all([
      db.collection('users').select('lastDate', 'done', 'pastDone', 'streak', 'quizDone', 'pastQuizDone', 'rambamTrack', 'extraTracks').get(),
      db.collection('quiz_cache').select('createdAt').get(),
      db.collection('quiz_usage').where('date', '==', usageDay).get(),
      db.collection('tanya_usage').where('date', '==', usageDay).get(),
      db.collection('tanya_enhanced').count().get(),
      db.collection('tanya_locks').where('state', '==', 'failed').count().get(),
      signupDates().catch(() => []),
      db.collection('share_links').select('kind', 'opens', 'createdAt').get().catch(() => null),
    ]);
    const sum = snap => snap.docs.reduce((n, d) => n + (d.get('count') || 0), 0);
    const body = summarize(users.docs.map(d => d.data()), {
      today, signups,
      ai: {
        quizzesSaved: quizzes.size,
        quizDates: quizzes.docs.map(d => String(d.get('createdAt') || '').slice(0, 10)),
        quizRequestsToday: sum(quizUse), quizPeopleToday: quizUse.size,
        tanyaGuides: guides.data().count, tanyaFailed: failed.data().count,
        tanyaRequestsToday: sum(tanyaUse),
      },
    });
    // Sharing: links made in the last 30 days (a Review or a whole day), and how many friends opened them
    const since = new Date(Date.parse(today + 'T12:00:00Z') - 30 * 864e5).toISOString().slice(0, 10);
    const recent = (shares?.docs || []).map(d => d.data()).filter(x => String(x.createdAt || '') >= since);
    body.shares = {
      reviews: recent.filter(x => x.kind !== 'day').length, days: recent.filter(x => x.kind === 'day').length,
      opened: recent.filter(x => x.opens > 0).length, opens: recent.reduce((t, x) => t + (x.opens || 0), 0),
    };
    cached = { key: today, at: Date.now(), body };
    return send(res, 200, body);
  } catch (e) {
    console.error('admin-stats:', e);
    return send(res, 500, { error: 'Could not count. ' + (e.message || '') });
  }
}
