# Sponsor a day of learning: how it works, and switching it on

Someone dedicates a day ("Today's learning is l'iluy nishmas Chaya bas Moshe"). On that day, everyone learning with Chitas sees it: a plaque under the four on Today ("Today's learning is dedicated · l'iluy nishmas Chaya bas Moshe · by the Cohen family"), and one quiet line at the top of each of the four texts.

## Where it lives

| What | Where |
|---|---|
| The page to sponsor a day | **chitas.vercel.app/sponsor/**: a page of its own, so it can be shared on WhatsApp, in a shul email, or printed as a link |
| The way in from the app | Profile → **Sponsor a day of learning** (website only, see below) |
| The dedication itself | Today: a plaque under the four tiles; and a line above the text in Chumash, Tehillim, Tanya and Rambam |
| Approving it | The admin page (`/admin.html`) → **Sponsored days** |

**Why paying happens on the website, not in the phone apps.** Apple and Google take a cut of money paid inside apps and have strict, changing rules about it (in the US, linking out to a website to pay is now allowed; elsewhere mostly not). So the phone apps only *show* dedications, which is fine everywhere, and hide the Sponsor row. On the website, the row shows. If later you want sponsoring inside the apps too, that's a separate step (Apple's in-app purchase, or becoming a registered nonprofit, which Apple and Google treat differently).

## How it works

1. The sponsor picks a free day (Shabbos and Yom Tov can't be picked, since people aren't on their phones; a day already taken shows crossed out), chooses what it's for (l'iluy nishmas, refuah shleimah, in honor of, for the success of), writes the name and, if they like, who it's from, and their email. The page shows exactly how the plaque will read.
2. They pay on Stripe's page (card, Apple Pay, Google Pay). The day is held for them for 35 minutes while they pay, so two people can't buy the same day.
3. You get an email: "A day is sponsored", with the line.
4. On the admin page you read it, fix the wording if needed, and press **Approve**. Only then does anyone see it. **Decline** hides it and frees the day; then refund the payment in Stripe (Payments → the payment → Refund). If a payment ever comes in for a day that had already gone to someone else, you get a "Refund needed" email instead.
5. On the day, it shows for everyone. It costs almost nothing to run: the line is kept at Vercel's edge, so thousands of people reading it are a handful of database reads.

One dedication a day, so each one stands on its own. The price is $36 (change it with `SPONSOR_PRICE_USD`).

## Switching it on (about 15 minutes)

Until these are set, the page works and shows the calendar, but the button says "Sponsoring opens soon".

1. **Make a Stripe account** at https://dashboard.stripe.com/register. Stripe will ask about you or your business and your bank account, to send you the money (minus Stripe's fee, about 2.9% + 30¢).
2. **Try it in test mode first.** In Stripe, switch on **Test mode** (top right). Then:
   - **Developers → API keys** → copy the **Secret key** (starts with `sk_test_`).
   - **Developers → Webhooks → Add endpoint.** Endpoint URL: `https://chitas.vercel.app/api/stripe-webhook`. Events: **checkout.session.completed** and **checkout.session.expired**. Save, then copy its **Signing secret** (starts with `whsec_`).
3. **Put them in Vercel**: your project → Settings → Environment Variables:
   - `STRIPE_SECRET_KEY` = the secret key
   - `STRIPE_WEBHOOK_SECRET` = the signing secret
   - optional: `SPONSOR_PRICE_USD` = a different price, e.g. `54`

   Then redeploy (Deployments → the latest → Redeploy) so the new settings are used.
4. **Test it:** sponsor a day on the website and pay with Stripe's test card `4242 4242 4242 4242`, any future date and any 3 digits. You should get the email, see it on the admin page, approve it, and (on that day) see it in the app.
5. **Go live:** switch Stripe out of Test mode, and repeat step 2 for real keys (`sk_live_…`, and a live webhook with its own `whsec_…`). Put those in Vercel instead, and redeploy.

The emails to you go through Resend, like feedback (`RESEND_API_KEY`, already set up).

## Code

`api/_lib/sponsor.js` (the rules), `api/sponsor.js` (the calendar and the payment page), `api/stripe-webhook.js` (Stripe's signed messages), `api/admin-sponsors.js` (approving), `api/dedication.js` (the day's line, and its parts for the plaque), `sponsor/index.html` (the page). Kept in Firestore `sponsorships/{date}`, which only the server can read. Tested by `tools/test-sponsor.mjs` (`npm run test:sponsor`), with a pretend Stripe and database.
