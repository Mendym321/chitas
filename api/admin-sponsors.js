/**
 * Sponsored days, for the admin page. Admins only (ADMIN_UIDS).
 *   GET  → { items: [{ date, status, kind, names, by, email, amount, preview }] }
 *          from a week ago on, paid / approved / declined (not days still being paid for)
 *   POST { date, action: 'approve' | 'decline' | 'edit', kind?, names?, by? }
 *          approve: the wording (fixed if given) goes live on the day
 *          decline: hidden, and the day is free again (refund in Stripe)
 *          edit:    fix the wording of a paid or approved day
 */
import { getDb, verifyUserToken, isAdmin } from './_lib/firebase.js';
import { KINDS, dedicationText } from './_lib/sponsor.js';

const send = (res, status, body) => res.status(status).json(body);
const clean = (s, n) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

export default async function handler(req, res) {
  const who = await verifyUserToken(req);
  if (!who) return send(res, 401, { error: 'Sign in first' });
  if (!isAdmin(who)) return send(res, 403, { error: 'admins only' });
  const days = getDb().collection('sponsorships');

  if (req.method === 'GET') {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const snap = await days.get();
      const items = snap.docs.filter(d => d.id >= weekAgo && d.data().status !== 'held')
        .map(d => { const v = d.data(); return { date: d.id, status: v.status, kind: v.kind, names: v.names, by: v.by || '', email: v.email || '', amount: v.amount || 0, preview: dedicationText(v) }; })
        .sort((a, b) => a.date.localeCompare(b.date));
      return send(res, 200, { items });
    } catch (e) {
      console.error('admin-sponsors GET:', e);
      return send(res, 500, { error: 'Could not load sponsored days.' });
    }
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'GET or POST' });
  const b = req.body || {};
  const date = String(b.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'date' });
  const action = b.action;
  if (!['approve', 'decline', 'edit'].includes(action)) return send(res, 400, { error: 'action' });
  try {
    const ref = days.doc(date);
    const cur = await ref.get();
    if (!cur.exists || cur.data().status === 'held') return send(res, 404, { error: 'No paid sponsorship for that day.' });
    const next = { ...cur.data() };
    if (b.kind != null && KINDS[b.kind]) next.kind = b.kind;
    if (b.names != null && clean(b.names, 80).length >= 2) next.names = clean(b.names, 80);
    if (b.by != null) next.by = clean(b.by, 80);
    if (action === 'approve') { next.status = 'approved'; next.text = dedicationText(next); next.approvedAt = new Date().toISOString(); }
    else if (action === 'decline') { next.status = 'declined'; }
    else if (action === 'edit') { next.text = dedicationText(next); }
    await ref.set(next);
    return send(res, 200, { ok: true, status: next.status, preview: dedicationText(next) });
  } catch (e) {
    console.error('admin-sponsors POST:', e);
    return send(res, 500, { error: 'Could not save. ' + (e.message || '') });
  }
}
