/**
 * POST /api/stripe-webhook: Stripe's signed messages about payments.
 *   checkout.session.completed (paid) → the day is paid; the admin gets an email
 *     to read and approve the wording. A payment for a day that's gone to someone
 *     else meanwhile (or whose hold ran out) is emailed as a refund to make.
 *   checkout.session.expired → the sponsor left without paying: the day is free again.
 * Set in Stripe: Developers → Webhooks → this URL, with STRIPE_WEBHOOK_SECRET on Vercel.
 */
import { getDb } from './_lib/firebase.js';
import { verifyStripeSignature, dedicationText, emailAdmin } from './_lib/sponsor.js';

export const config = { api: { bodyParser: false } };       // the signature is over the exact bytes

async function rawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const raw = await rawBody(req);
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) {
    return res.status(400).json({ error: 'bad signature' });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: 'bad body' }); }
  const obj = event.data?.object || {};
  const date = obj.metadata?.date;
  if (!date) return res.status(200).json({ ok: true });       // not one of ours
  const ref = getDb().collection('sponsorships').doc(date);

  try {
    if (event.type === 'checkout.session.completed' && obj.payment_status === 'paid') {
      const cur = await ref.get();
      const d = cur.exists ? cur.data() : null;
      const amount = Math.round((obj.amount_total || 0) / 100);
      if (!d || (d.session && d.session !== obj.id)) {         // the day is someone else's now (or the hold was gone)
        await emailAdmin('Refund needed: a payment for ' + date,
          'A payment came in for ' + date + ' after the day had gone to someone else (or its hold had run out). Refund it in Stripe: Payments → the payment of $' + amount + ' (session ' + obj.id + ').');
        return res.status(200).json({ ok: true });
      }
      if (d.status !== 'held') return res.status(200).json({ ok: true });   // Stripe sending the same message again
      const text = dedicationText(d);
      await ref.update({ status: 'paid', amount, session: obj.id, paidAt: new Date().toISOString(), text });
      await emailAdmin('A day is sponsored: ' + date,
        text + '\n\n—\nFrom ' + (d.email || '?') + '. Read it on the admin page (Sponsored days), fix the wording if needed, and approve it.');
    }
    if (event.type === 'checkout.session.expired') {
      const cur = await ref.get();
      if (cur.exists && cur.data().status === 'held' && cur.data().session === obj.id) await ref.delete();
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('stripe-webhook:', e);
    return res.status(500).json({ error: 'try again' });      // Stripe sends it again later
  }
}
