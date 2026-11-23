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
 *
 * POST /api/error-report (rewritten here, ?kind=error: Vercel allows 12
 * functions and all are used) — an error on someone's phone, so we hear of a
 * crash before a one-star review. Body: { message, where, version, platform }.
 * Nothing about the person: no account, no address, no device id. The same
 * error is counted, not stored again (error_reports/, by a hash of message,
 * place and version), with the day it was last seen. Up to 30 a day per
 * address (hashed), so it can't be flooded.
 */
import { createHash } from 'node:crypto';
import { getDb, verifyUser } from './_lib/firebase.js';
import { takeDailyQuota } from './_lib/quota.js';
import { cleanFeedback, sendEmail } from './_lib/feedback.js';

const send = (res, status, body) => res.status(status).json(body);

// An error report, cut down to what helps find the bug: no addresses, numbers or
// query strings that might carry something personal
const clip = (s, n) => String(s || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\?[^\s)]*/g, '').replace(/\d{6,}/g, '[n]').replace(/\s+/g, ' ').trim().slice(0, n);
async function errorReport(req, res) {
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const message = clip(b.message, 300), where = clip(b.where, 120), version = clip(b.version, 40);
  const platform = ['ios', 'android', 'web'].includes(b.platform) ? b.platform : 'web';
  if (!message) return send(res, 400, { error: 'no message' });
  try {
    const db = getDb();
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const who = 'ip-' + createHash('sha256').update(ip).digest('hex').slice(0, 24);
    if (!await takeDailyQuota(db, who, 'errors', 30)) return send(res, 429, { error: 'enough for today' });
    const id = createHash('sha1').update(message + '|' + where + '|' + version).digest('hex').slice(0, 20);
    const ref = db.collection('error_reports').doc(id), now = new Date().toISOString();
    await db.runTransaction(async tx => {
      const d = (await tx.get(ref)).data();
      const on = { ...(d?.on || {}) }; on[platform] = (on[platform] || 0) + 1;
      tx.set(ref, { message, where, version, on, count: (d?.count || 0) + 1, firstSeen: d?.firstSeen || now, lastSeen: now });
    });
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('error-report:', e);
    return send(res, 500, { error: 'not saved' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  if (req.query?.kind === 'error') return errorReport(req, res);
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
