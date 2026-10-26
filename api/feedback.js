/**
 * POST /api/feedback — "Send feedback" (Profile) and "Report a mistake in this
 * text" (the reader's gear). Body: { message, email?, kind: 'feedback' | 'mistake',
 * context?, app, device }. Signed in or not.
 *
 * Saved in feedback/ (server only: the Firestore rules let no one read it) and
 * shown on the admin page; also emailed to chitas.daily@gmail.com when
 * RESEND_API_KEY is set. Kept: what was written, the optional email, and for a
 * mistake what was being read; no user id. Up to 10 a day per person (by
 * account, or by a hash of the address when signed out), so it can't be used
 * to flood the inbox.
 */
import { createHash } from 'node:crypto';
import { getDb, verifyUser } from './_lib/firebase.js';
import { takeDailyQuota } from './_lib/quota.js';
import { cleanFeedback, sendEmail } from './_lib/feedback.js';

const send = (res, status, body) => res.status(status).json(body);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  const f = cleanFeedback(req.body);
  if (f.error) return send(res, 400, f);
  try {
    const db = getDb();
    const uid = await verifyUser(req);
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const who = uid || 'ip-' + createHash('sha256').update(ip).digest('hex').slice(0, 24);
    if (!await takeDailyQuota(db, who, 'feedback', 10)) return send(res, 429, { error: 'That\'s a lot for one day. Please try again tomorrow, or email chitas.daily@gmail.com.' });
    const at = new Date().toISOString();
    const ref = await db.collection('feedback').add({ ...f, createdAt: at });
    const emailed = await sendEmail(f);
    if (emailed !== 'skipped') await ref.update({ emailed }).catch(() => {});
    return send(res, 200, { sent: true });
  } catch (e) {
    console.error('feedback:', e);
    return send(res, 500, { error: 'Couldn\'t send it. Please try again, or email chitas.daily@gmail.com.' });
  }
}
