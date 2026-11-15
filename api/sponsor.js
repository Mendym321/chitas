/**
 * Sponsor a day of learning (the page /sponsor/).
 *   GET  /api/sponsor?from=YYYY-MM-DD&to=YYYY-MM-DD → { price, open, taken: [dates] }
 *        open: whether payments are switched on (STRIPE_SECRET_KEY is set)
 *   POST /api/sponsor { date, kind, names, by, email } → { url } (Stripe's payment page)
 *        The day is held for the sponsor while they pay (HOLD_MINUTES), so two
 *        people can't buy the same day. Stripe tells api/stripe-webhook.js when
 *        it's paid; the admin approves it before anyone sees it.
 * No sign-in needed: anyone can sponsor a day.
 */
import { getDb } from './_lib/firebase.js';
import { cleanSponsor, isTaken, checkoutParams, stripeForm, PRICE_USD } from './_lib/sponsor.js';

const send = (res, status, body) => res.status(status).json(body);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const todayISO = () => new Date().toISOString().slice(0, 10);

// "Wednesday, November 11, 2026 (1 Kislev)"
export function dayLabel(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  const en = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  let he = '';
  try { he = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d); } catch {}
  return en + (he ? ' (' + he + ')' : '');
}

export default async function handler(req, res) {
  const db = getDb();
  const days = db.collection('sponsorships');

  if (req.method === 'GET') {
    const from = ISO.test(req.query?.from || '') ? req.query.from : todayISO();
    const to = ISO.test(req.query?.to || '') ? req.query.to : '9999-12-31';
    try {
      const snap = await days.get();
      const now = Date.now();
      const taken = snap.docs.filter(d => d.id >= from && d.id <= to && isTaken(d.data(), now)).map(d => d.id).sort();
      return send(res, 200, { price: PRICE_USD(), open: !!process.env.STRIPE_SECRET_KEY, taken });
    } catch (e) {
      console.error('sponsor GET:', e);
      return send(res, 500, { error: 'Could not load the calendar.' });
    }
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'GET or POST' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return send(res, 503, { error: 'Sponsoring opens soon.' });
  const s = cleanSponsor(req.body || {}, todayISO());
  if (s.error) return send(res, 400, { error: s.error });

  // Hold the day (unless someone has it)
  const ref = days.doc(s.date);
  try {
    await db.runTransaction(async t => {
      const cur = await t.get(ref);
      if (cur.exists && isTaken(cur.data())) throw Object.assign(new Error('taken'), { taken: true });
      t.set(ref, { status: 'held', kind: s.kind, names: s.names, by: s.by, email: s.email, heldAt: new Date().toISOString() });
    });
  } catch (e) {
    if (e.taken) return send(res, 409, { error: 'Someone has just taken that day. Pick another.' });
    console.error('sponsor hold:', e);
    return send(res, 500, { error: 'Could not hold the day. Try again.' });
  }

  // Stripe's payment page
  try {
    const origin = process.env.SITE_URL || 'https://chitas.vercel.app';
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/x-www-form-urlencoded' },
      body: stripeForm(checkoutParams(s, origin, dayLabel(s.date))).toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(j.error?.message || 'Stripe ' + r.status);
    await ref.update({ session: j.id });
    return send(res, 200, { url: j.url });
  } catch (e) {
    console.error('sponsor checkout:', e);
    await ref.delete().catch(() => {});                      // let the day go again
    return send(res, 502, { error: 'The payment page couldn\'t open. Try again in a minute.' });
  }
}
