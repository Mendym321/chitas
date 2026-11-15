// Sponsor a day of learning: the rules, in one place. Pure apart from emailAdmin
// (which only calls fetch), so tools/test-sponsor.mjs checks all of it.
//
// A day's record lives in Firestore sponsorships/{YYYY-MM-DD} (only the server
// reads it): { status: 'held' | 'paid' | 'approved' | 'declined', kind, names,
// by, email, heldAt, session, amount, text }. 'held' while someone is on
// Stripe's payment page; 'paid' when Stripe says so; 'approved' when the admin
// has read it, and only then does anyone see it.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const KINDS = {
  memory:  { label: "L'iluy nishmas",          lead: "is l'iluy nishmas" },
  refuah:  { label: 'Refuah shleimah',          lead: 'is for a refuah shleimah for' },
  honor:   { label: 'In honor of',              lead: 'is in honor of' },
  success: { label: 'For the success of',       lead: 'is for the success of' },
};

export const PRICE_USD = () => Math.max(1, Math.round(Number(process.env.SPONSOR_PRICE_USD) || 36));
export const HOLD_MINUTES = 35;          // a day picked and being paid for is held this long (Stripe's own limit is 30)
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s, n) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Whole days from a to b (both YYYY-MM-DD)
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}

// What the sponsor sent → what's kept, or { error }. today: YYYY-MM-DD
export function cleanSponsor(body, today) {
  const date = String(body?.date || '');
  if (!ISO.test(date) || isNaN(Date.parse(date + 'T12:00:00Z'))) return { error: 'Pick a day.' };
  const ahead = daysBetween(today, date);
  if (ahead < 1) return { error: 'Pick a day from tomorrow on.' };
  if (ahead > 366) return { error: 'Pick a day within the coming year.' };
  if (new Date(date + 'T12:00:00Z').getUTCDay() === 6) return { error: 'Shabbos can\'t be sponsored. Pick another day.' };
  const kind = String(body?.kind || '');
  if (!KINDS[kind]) return { error: 'Choose what the day is for.' };
  const names = clean(body?.names, 80);
  if (names.length < 2) return { error: 'Write the name (for example: Chaya bas Moshe).' };
  const by = clean(body?.by, 80);
  const email = clean(body?.email, 200);
  if (!EMAIL.test(email)) return { error: 'Write your email, for the receipt.' };
  return { date, kind, names, by, email };
}

// The same, in the parts the plaque on Today shows: "l'iluy nishmas Chaya bas Moshe", "the Cohen family"
export function dedicationParts({ kind, names, by }) {
  const k = KINDS[kind];
  if (!k || !names) return null;
  return { line: k.lead.replace(/^is /, '') + ' ' + names, by: by || null };
}

// The whole sentence: "Today's learning is l'iluy nishmas Chaya bas Moshe. Dedicated by the Cohen family."
export function dedicationText({ kind, names, by }) {
  const k = KINDS[kind];
  if (!k || !names) return '';
  return "Today's learning " + k.lead + ' ' + names + '.' + (by ? ' Dedicated by ' + by + '.' : '');
}

// A day is free unless someone paid for it, or is paying right now
export function isTaken(doc, now = Date.now()) {
  if (!doc) return false;
  if (doc.status === 'paid' || doc.status === 'approved') return true;
  if (doc.status === 'held') return now - Date.parse(doc.heldAt || 0) < HOLD_MINUTES * 60000;
  return false;                            // declined (and refunded), or a hold that ran out
}

// Stripe takes form encoding, with nested keys in brackets: line_items[0][price_data][currency]=usd
export function stripeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (typeof v === 'object') stripeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

// The payment page Stripe shows: one item, the day; back to our page after
export function checkoutParams(s, origin, dayLabel, nowSec = Math.floor(Date.now() / 1000)) {
  return {
    mode: 'payment',
    expires_at: nowSec + 30 * 60,
    customer_email: s.email,
    success_url: origin + '/sponsor/?thanks=' + s.date,
    cancel_url: origin + '/sponsor/?date=' + s.date,
    metadata: { date: s.date },
    payment_intent_data: { metadata: { date: s.date } },
    line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: PRICE_USD() * 100,
      product_data: { name: 'Sponsor a day of learning: ' + dayLabel, description: dedicationText(s) } } } },
  };
}

// A message from Stripe is real only if its signature matches (and it's recent)
export function verifyStripeSignature(raw, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!raw || !header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = String(header).split(',').filter(p => p.trim().startsWith('v1=')).map(p => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(nowSec - t) > 300) return false;
  const want = createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
  return sigs.some(s => s.length === want.length && timingSafeEqual(Buffer.from(s), Buffer.from(want)));
}

// An email to the admin (through Resend, like feedback). Never throws.
export async function emailAdmin(subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'skipped';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'Chitas <onboarding@resend.dev>', to: [process.env.FEEDBACK_TO || 'chitas.daily@gmail.com'], subject, text }),
    });
    return r.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}
