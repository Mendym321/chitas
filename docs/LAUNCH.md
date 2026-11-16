# Launching Chitas: every step, in order

This is the whole road from here to "Chitas is in the App Store and Google Play". Do the steps in order. Each one says **what** to do, **why**, **how long** it takes and **what it costs**. Where a step has many clicks, it points to the page that has them all (`app/README.md`, `docs/store-listing.md`, `docs/sponsor.md`).

Tick the boxes as you go (on GitHub you can edit this file and change `[ ]` to `[x]`).

**What you need overall:** a Mac (for the iPhone app; see step 4), about $124 (Apple $99 a year + Google $25 once), an iPhone to test on, and ideally an Android phone (or Android Studio's pretend phone). Time: about 3 to 4 weeks, mostly waiting on Apple and Google; your own work is a few evenings.

---

## Phase 0: This week (no accounts needed)

- [ ] **0.1 Push everything live.** Tell Claude "push live". This puts the sponsor page, the plaque on Today and the new videos on the website. *Why:* the phone apps show the live website, so whatever is live is what Apple and Google will review.

- [x] **0.2 Next batch of written guides (before 22 November).** Done 15 November: Tanya through 28 Nov (the end of the Tanya), Rambam through 5 Dec, Chumash through 12 Dec. *Next batch:* before 28 November.
  *Each time:* tell Claude "write the next batch of guides" about a week before they run out. The readers still work without them (the AI writes the Tanya guide each day, a few cents), but the hand-written ones are better.

- [x] **0.3 Developer name: Mendel Marcus.** Decided: individual accounts on both stores, under your own legal name (it must match your ID and payment details). The app can move to a business account later; both stores allow a transfer.

- [ ] **0.4 Check the contact email works:** send a test to **chitas.daily@gmail.com** and make sure you can read it. *Why:* it's on the store pages, the privacy page and the support page, and Apple may write to it.

---

## Phase 1: The accounts (start now; they take days)

- [ ] **1.1 Apple Developer Program** ($99 a year). https://developer.apple.com/programs/enroll/
  - Sign in with your Apple ID (it must have two-factor authentication on: iPhone Settings → your name → Sign-In & Security).
  - Choose **Individual**, enter your legal name (Mendel Marcus), pay, and wait for the "Welcome" email (usually 1 to 2 days).
  - *Why:* it's the only way into the App Store, and Sign in with Apple only works with a paid account.

- [ ] **1.2 Google Play developer account** ($25 once). https://play.google.com/console/signup
  - Choose **Yourself** (individual), developer name **Mendel Marcus**, pay, and verify your identity (a photo of your ID). Google may also ask you to confirm you have an Android phone, using its Play Console app.
  - Verification takes from a few hours to a few days.

- [ ] **1.3 Optional now, needed for sponsoring: Stripe.** Only if you want "Sponsor a day" switched on at launch. About 15 minutes, all in `docs/sponsor.md`. It can wait until after launch; until then the page says "Sponsoring opens soon".

---

## Phase 2: Firebase (15 minutes, in the browser)

Follow `app/README.md`, **Part 1**:

- [ ] **2.1** Turn on **Apple** sign-in in Firebase.
- [ ] **2.2** Add the **iOS app** (bundle ID `app.chitas.daily`) and download **GoogleService-Info.plist**.
- [ ] **2.3** Add the **Android app** (package `app.chitas.daily`) and download **google-services.json**.

Keep both files somewhere you'll find them (your Desktop). *Why:* they tell the phone apps which Firebase project (accounts, saved progress) they belong to.

---

## Phase 3: Try both apps on a phone

### iPhone (needs the Mac): `app/README.md`, Part 2

- [ ] **3.1** Install **Node.js** and **Xcode** on the Mac.
- [ ] **3.2** Download the project, run the three commands, and copy in `GoogleService-Info.plist` **before the first build** (without it the app closes as soon as it opens).
- [ ] **3.3** In Xcode, the one-time settings: signing team, **Sign in with Apple**, the URL type, the **app icon**, the **privacy file**, the **encryption answer**, the version (1.0, build 1).
- [ ] **3.4** Plug in the iPhone and press ▶. Then check, on the phone:
  - Sign in with Apple, and Continue with Google
  - A reminder (set one a couple of minutes ahead, close the app, wait)
  - Marking a section learned (a light tap), all four (the "success" buzz)
  - Close the app in the middle of a text and open it again: same place
  - Delete account (use a test account)

### Android: `app/README.md`, Part 3

- [ ] **3.5** Install **Android Studio**, copy in `google-services.json`, run `npm run android`, press ▶.
- [ ] **3.6** Add the **SHA-1** fingerprint in Firebase (so Google sign-in works), download `google-services.json` again, replace it, and try signing in.

If anything on this list doesn't work, tell Claude exactly what you saw (a screenshot is best). Don't submit until all of it works.

---

## Phase 4: No Mac?

The iPhone app can only be built on a Mac. If you don't have one:
- **Borrow one** for an evening (steps 3.1 to 3.4 and Phase 5 take about 2 hours the first time).
- **Rent one in the cloud:** e.g. MacinCloud (about $1 an hour, or ~$25 a month). You use it from your browser like a remote computer. Plugging in your iPhone isn't possible that way, so test with **TestFlight** instead (step 5.4).
- **A build service** (e.g. Codemagic, Ionic Appflow) builds it for you from GitHub. It needs more setup; ask Claude if you go this way.

Android doesn't need a Mac: any Windows or Linux computer works.

---

## Phase 5: The App Store

Follow `app/README.md`, **Part 4**, with `docs/store-listing.md` open beside it.

- [ ] **5.1 Create the app** in App Store Connect (https://appstoreconnect.apple.com): New App, name **Chitas: Daily Learning**, bundle ID `app.chitas.daily`, SKU `chitas-daily`.
- [ ] **5.2 Fill in the page** from `docs/store-listing.md`, section by section: subtitle, description, keywords, links, category (Education), price (Free), age rating (4+), **App Privacy** (section 5), copyright (© 2026 Mendel Marcus).
- [ ] **5.3 Screenshots and video:** drag in `docs/store/apple/` (iPhone 6.9-inch) and `docs/store/ipad/` (iPad 13-inch), in number order; then the preview video `docs/store/video/chitas-app-preview.mp4`, with the poster frame at 00:00.
- [ ] **5.4 Upload the build** from Xcode (Any iOS Device → Product → Archive → Distribute → App Store Connect → Upload). After 10 to 30 minutes it appears under **TestFlight**: install it with the TestFlight app and try it once more as it will really be.
- [ ] **5.5 Review notes:** paste the notes from `docs/store-listing.md` section 6. **Add one sentence** for guideline 4.2 (apps that mostly show a website): *"Beyond the daily texts, the app uses native Sign in with Apple and Google, local notification reminders for each section, and haptics."* This tells the reviewer it's a real app, not just a website in a frame.
- [ ] **5.6 Submit for review.** Apple usually answers in 1 to 3 days.
  - **Approved:** press **Release** (or set it to release automatically).
  - **Rejected:** don't worry, it's common for a first app. Copy Apple's message to Claude; most fixes are a small change or a reply in the Resolution Center.

---

## Phase 6: Google Play

- [ ] **6.1 Create the app** in Play Console: name **Chitas: Daily Learning**, App (not game), Free.
- [ ] **6.2 Fill in the store listing** from `docs/store-listing.md`: short and full description, the icon (`icons/icon-512.png`), feature graphic (`docs/store/feature-graphic.png`), the 8 phone screenshots (`docs/store/google/`), and the video: upload `docs/store/video/chitas-promo.mp4` to YouTube as **Unlisted**, ads off, and paste the link. Then the forms: content rating (IARC), target audience (13+), data safety (section 5), ads (none), app access ("all functionality available without special access").
- [ ] **6.3 Closed test** (personal accounts only; organization accounts skip it): Google requires **at least 12 testers** opted in for **14 days in a row** before you can publish.
  - Make an **App bundle** in Android Studio (Build → Generate Signed App Bundle; let it create a new key and **keep the key file and password safe forever**: without them you can never update the app).
  - Upload it to a **Closed testing** track, add the testers' Gmail addresses, and send them the opt-in link.
  - Good testers: family, friends, your shul. Send the promo video with it (`docs/store/video/chitas-promo.mp4`).
  - Then add Play's own signing **SHA-1** to Firebase (`app/README.md`, end of Part 3) and rebuild, or Google sign-in won't work in the store version.
- [ ] **6.4 Apply for production** after the 14 days (Play Console asks a few questions about the test), then **send for review**. Google usually answers within a few days.

---

## Phase 7: While you wait (spread the word)

- [ ] **7.1 Share it now**: chitas.vercel.app works today in any browser (and can be added to the home screen). Coming-soon versions of the video, ending on that address, are being finished; share those when they're ready.
- [ ] **7.2 Collect your 12 Android testers** (step 6.3) from the people who reply.

---

## Phase 8: Launch day and after

- [ ] **8.1 Check both store pages** once they're live: the links, the screenshots, the video.
- [ ] **8.2 Install from the stores** on a phone that never had the app: first screen, sign in, mark a section, a reminder.
- [ ] **8.3 Announce it**: the App Store and Google Play links, with the store videos.
- [ ] **8.4 Every few days in the first weeks:** read reviews (answer them, kindly, in each store), the feedback emails, and the admin page (`/admin.html`: people, sections learned, feedback). Send anything odd to Claude.
- [ ] **8.5 Keep the guides written**: a new batch every few weeks (`AUDIT.md`, launch checklist point 5). Claude can write them; ask a week before they run out.
- [ ] **8.6 Updates:** almost every change reaches everyone with a "push live" (the apps show the live website). A new store version is needed only when `app/` changes (new phone features); then raise the build number, archive and submit again (`app/README.md`, end of Part 4).
- [ ] **8.7 Renew Apple each year** ($99): if it lapses, the app leaves the App Store.

---

## Already done (so you don't have to)

The app itself; the iPhone and Android projects; Sign in with Apple and Google in the phone apps; reminders, haptics; account deletion; the privacy and support pages; Apple's privacy file; every store answer written out with character counts checked; 10 iPhone and 10 iPad screenshots, 8 for Google, the feature graphic; four videos with original music; the sponsor page; the admin page; 800 automatic checks that run before every change goes live.

**Decided:** the name ("Chitas: Daily Learning" in the stores, "Chitas" on the phone); the app stays free with no ads; the fonts can be shipped (you have permission); the videos (store and coming-soon).
