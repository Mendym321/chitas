/**
 * Sponsor a day of learning, end to end with a pretend Stripe and database (no
 * internet, keys or money): the rules, holding a day, paying, Stripe's signed
 * messages, the admin approving, and what everyone sees (api/dedication.js).
 * Run:  cd tools && npm run test:sponsor
 */
import { mock } from 'node:test';
import { createHmac } from 'node:crypto';

// ── Pretend Firestore and sign-in ("token-<uid>"; "admin" is an admin) ──────
const store = new Map();
const docRef = (col, id) => ({
  async get() { const k = col + '/' + id; return { exists: store.has(k), data: () => store.get(k) }; },
  async set(v) { store.set(col + '/' + id, v); },
  async update(v) { const k = col + '/' + id; store.set(k, { ...(store.get(k) || {}), ...v }); },
  async delete() { store.delete(col + '/' + id); },
});
const coll = col => ({
  doc: id => docRef(col, id),
  get: async () => ({ docs: [...store].filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ id: k.slice(col.length + 1), data: () => v })) }),
});
mock.module('../api/_lib/firebase.js', { namedExports: {
  getDb: () => ({ collection: coll, runTransaction: fn => fn({ get: r => r.get(), set: (r, v) => r.set(v) }) }),
  verifyUserToken: async req => { const u = (req.headers?.authorization || '').match(/^Bearer token-(\w+)$/)?.[1]; return u ? { uid: u, email: u + '@example.com' } : null; },
  isAdmin: who => who?.uid === 'admin',
}});

// ── Pretend Stripe and Resend ───────────────────────────────────────────────
const emails = [], stripeCalls = [];
let stripeFails = false;
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).includes('api.resend.com')) { emails.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({}) }; }
  if (String(url).includes('api.stripe.com')) {
    stripeCalls.push(new URLSearchParams(opts.body));
    if (stripeFails) return { ok: false, status: 500, json: async () => ({ error: { message: 'down' } }) };
    const n = stripeCalls.length;
    return { ok: true, status: 200, json: async () => ({ id: 'cs_test_' + n, url: 'https://checkout.stripe.com/pay/cs_test_' + n }) };
  }
  throw new Error('unexpected fetch ' + url);
};
process.env.RESEND_API_KEY = 're_test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

const L = await import('../api/_lib/sponsor.js');
const { default: sponsor, dayLabel } = await import('../api/sponsor.js');
const { default: webhook } = await import('../api/stripe-webhook.js');
const { default: dedication } = await import('../api/dedication.js');
const { default: admin } = await import('../api/admin-sponsors.js');

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '\n      got  ' + JSON.stringify(got) + '\n      want ' + JSON.stringify(want)));
}
const fakeRes = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(s) { r.code = s; return r; }, json(j) { r.body = j; return r; } }; return r; };
const run = async (h, req) => { const res = fakeRes(); await h({ headers: {}, ...req }, res); return res; };

const iso = d => d.toISOString().slice(0, 10);
const today = iso(new Date());
const plus = n => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const weekday = from => { let n = from; while (new Date(plus(n) + 'T12:00:00Z').getUTCDay() === 6) n++; return plus(n); };
const saturday = () => { let n = 1; while (new Date(plus(n) + 'T12:00:00Z').getUTCDay() !== 6) n++; return plus(n); };
const D1 = weekday(3), D2 = weekday(10);
const good = { date: D1, kind: 'memory', names: 'Chaya bas Moshe', by: 'the Cohen family', email: 'sponsor@example.com' };

console.log('The rules:');
check('a good request is kept as written', L.cleanSponsor(good, today), good);
check('today or before: no', L.cleanSponsor({ ...good, date: today }, today).error, 'Pick a day from tomorrow on.');
check('more than a year ahead: no', L.cleanSponsor({ ...good, date: plus(400) }, today).error, 'Pick a day within the coming year.');
check('Shabbos: no', L.cleanSponsor({ ...good, date: saturday() }, today).error, 'Shabbos can\'t be sponsored. Pick another day.');
check('a kind that isn\'t one: no', L.cleanSponsor({ ...good, kind: 'x' }, today).error, 'Choose what the day is for.');
check('no name: no', L.cleanSponsor({ ...good, names: ' ' }, today).error, 'Write the name (for example: Chaya bas Moshe).');
check('no email: no', L.cleanSponsor({ ...good, email: 'nope' }, today).error, 'Write your email, for the receipt.');
check('tags and odd characters are taken out', L.cleanSponsor({ ...good, names: 'Chaya <b>bas</b>\u0007 Moshe' }, today).names, 'Chaya bas Moshe');
check('the line, for each kind', ['memory', 'refuah', 'honor', 'success'].map(kind => L.dedicationText({ kind, names: 'Levi ben Sarah' })), [
  "Today's learning is l'iluy nishmas Levi ben Sarah.", "Today's learning is for a refuah shleimah for Levi ben Sarah.",
  "Today's learning is in honor of Levi ben Sarah.", "Today's learning is for the success of Levi ben Sarah."]);
check('with who dedicated it', L.dedicationText(good), "Today's learning is l'iluy nishmas Chaya bas Moshe. Dedicated by the Cohen family.");
check('the parts, for each kind (the plaque on Today)', ['memory', 'refuah', 'honor', 'success'].map(kind => L.dedicationParts({ kind, names: 'Levi ben Sarah' }).line),
  ["l'iluy nishmas Levi ben Sarah", 'for a refuah shleimah for Levi ben Sarah', 'in honor of Levi ben Sarah', 'for the success of Levi ben Sarah']);
check('a hold counts for 35 minutes, then the day is free', [L.isTaken({ status: 'held', heldAt: new Date(Date.now() - 34 * 60000).toISOString() }), L.isTaken({ status: 'held', heldAt: new Date(Date.now() - 36 * 60000).toISOString() }), L.isTaken({ status: 'declined' }), L.isTaken({ status: 'paid' })], [true, false, false, true]);
check('Stripe\'s form encoding', L.stripeForm({ a: 1, b: { c: { d: 'x' } } }).toString(), 'a=1&b%5Bc%5D%5Bd%5D=x');
check('the day, named both ways', dayLabel('2026-11-11'), 'Wednesday, November 11, 2026 (1 Kislev)');
const t = Math.floor(Date.now() / 1000), sig = (raw, ts = t) => 't=' + ts + ',v1=' + createHmac('sha256', 'whsec_test').update(ts + '.' + raw).digest('hex');
check('Stripe\'s signature: real, forged, too old', [L.verifyStripeSignature('{}', sig('{}'), 'whsec_test'), L.verifyStripeSignature('{}', 't=' + t + ',v1=00', 'whsec_test'), L.verifyStripeSignature('{}', sig('{}', t - 600), 'whsec_test')], [true, false, false]);

console.log('Picking a day and paying:');
delete process.env.STRIPE_SECRET_KEY;
let r = await run(sponsor, { method: 'GET', query: { from: today, to: plus(60) } });
check('before Stripe is set up: the calendar shows, sponsoring "opens soon"', [r.code, r.body.open, r.body.price], [200, false, 36]);
r = await run(sponsor, { method: 'POST', body: good });
check('…and paying is refused kindly', [r.code, r.body.error], [503, 'Sponsoring opens soon.']);
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
r = await run(sponsor, { method: 'POST', body: good });
check('a day picked: held, and Stripe\'s page opens', [r.code, r.body.url, store.get('sponsorships/' + D1).status, store.get('sponsorships/' + D1).session], [200, 'https://checkout.stripe.com/pay/cs_test_1', 'held', 'cs_test_1']);
const sent = stripeCalls.at(-1);
check('Stripe is asked for the right amount, the day and the way back', [sent.get('line_items[0][price_data][unit_amount]'), sent.get('metadata[date]'), sent.get('success_url').endsWith('/sponsor/?thanks=' + D1), sent.get('customer_email')], ['3600', D1, true, 'sponsor@example.com']);
r = await run(sponsor, { method: 'POST', body: { ...good, names: 'Someone else' } });
check('the same day again while it\'s held: taken', [r.code, store.get('sponsorships/' + D1).names], [409, 'Chaya bas Moshe']);
r = await run(sponsor, { method: 'GET', query: { from: today, to: plus(60) } });
check('the calendar shows it taken', r.body.taken, [D1]);
stripeFails = true;
r = await run(sponsor, { method: 'POST', body: { ...good, date: D2 } });
check('Stripe failing: an error, and the day is let go again', [r.code, store.has('sponsorships/' + D2)], [502, false]);
stripeFails = false;
r = await run(sponsor, { method: 'POST', body: { ...good, date: D2 } });

console.log('Stripe\'s messages:');
const hook = async (event, signature) => { const raw = JSON.stringify(event); return run(webhook, { method: 'POST', body: raw, headers: { 'stripe-signature': signature || sig(raw) } }); };
const paid = (id, date) => ({ type: 'checkout.session.completed', data: { object: { id, payment_status: 'paid', amount_total: 3600, metadata: { date } } } });
r = await hook(paid('cs_test_1', D1), 't=1,v1=bad');
check('a forged message is refused, nothing changes', [r.code, store.get('sponsorships/' + D1).status], [400, 'held']);
r = await hook(paid('cs_test_1', D1));
check('paid: the day is paid, the admin is emailed to check the wording', [r.code, store.get('sponsorships/' + D1).status, store.get('sponsorships/' + D1).amount, emails.at(-1)?.subject, emails.at(-1)?.text.startsWith("Today's learning is l'iluy nishmas Chaya bas Moshe.")],
  [200, 'paid', 36, 'A day is sponsored: ' + D1, true]);
const n = emails.length;
r = await hook(paid('cs_test_1', D1));
check('the same message again: nothing more (no second email)', [r.code, emails.length], [200, n]);
r = await hook(paid('cs_test_99', D1));
check('another payment for a day that\'s taken: the admin is asked to refund it', [r.code, emails.at(-1)?.subject, store.get('sponsorships/' + D1).session], [200, 'Refund needed: a payment for ' + D1, 'cs_test_1']);
r = await run(dedication, { method: 'GET', query: { date: D1 } });
check('paid but not yet approved: nobody sees it', [r.body.text, r.body.line], [null, null]);
r = await hook({ type: 'checkout.session.expired', data: { object: { id: store.get('sponsorships/' + D2).session, metadata: { date: D2 } } } });
check('a payment page left unpaid: the day is free again', [r.code, store.has('sponsorships/' + D2)], [200, false]);

console.log('The admin, and what everyone sees:');
r = await run(admin, { method: 'GET', headers: { authorization: 'Bearer token-u1' } });
check('the list is for admins only', r.code, 403);
r = await run(admin, { method: 'GET', headers: { authorization: 'Bearer token-admin' } });
check('the admin sees the paid day and its line', [r.code, r.body.items.map(i => [i.date, i.status, i.preview])], [200, [[D1, 'paid', "Today's learning is l'iluy nishmas Chaya bas Moshe. Dedicated by the Cohen family."]]]);
r = await run(admin, { method: 'POST', headers: { authorization: 'Bearer token-admin' }, body: { date: D1, action: 'approve', names: 'Chaya bas Moshe Aharon', by: 'the Cohen family' } });
check('approved (with the wording fixed): live on the day', [r.code, store.get('sponsorships/' + D1).status, store.get('sponsorships/' + D1).text], [200, 'approved', "Today's learning is l'iluy nishmas Chaya bas Moshe Aharon. Dedicated by the Cohen family."]);
r = await run(dedication, { method: 'GET', query: { date: D1 } });
check('everyone sees it that day, and it\'s kept at the edge', [r.body.text, r.headers['Cache-Control'].includes('s-maxage')], ["Today's learning is l'iluy nishmas Chaya bas Moshe Aharon. Dedicated by the Cohen family.", true]);
check('with its parts, for the plaque on Today', [r.body.line, r.body.by], ["l'iluy nishmas Chaya bas Moshe Aharon", 'the Cohen family']);
check('another day: nothing', (await run(dedication, { method: 'GET', query: { date: D2 } })).body.text, null);
r = await run(admin, { method: 'POST', headers: { authorization: 'Bearer token-admin' }, body: { date: D1, action: 'decline' } });
check('declined: not shown, and the day is open again', [store.get('sponsorships/' + D1).status, (await run(dedication, { method: 'GET', query: { date: D1 } })).body.text,
  (await run(sponsor, { method: 'GET', query: { from: today, to: plus(60) } })).body.taken.includes(D1)], ['declined', null, false]);

console.log(failed ? `\n${failed} FAILED` : '\nAll sponsor tests passed');
process.exit(failed ? 1 : 0);
