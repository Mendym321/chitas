# Store listing: answers for the App Store and Google Play forms

Copy each answer into the matching box. The character counts are already checked against each store's limit.

Screenshots and graphics are in `docs/store/` (made from the real app with real texts by `tools/store/`, see the end of this page):

| Files | For | Size |
|---|---|---|
| `apple/1-…10-*.png` | App Store, "iPhone 6.9-inch" slot (Apple scales them for smaller iPhones) | 1290 × 2796 |
| `ipad/1-…10-*.png` | App Store, "iPad 13-inch" slot (needed because the app also runs on iPad) | 2064 × 2752 |
| `google/1-…8-*.png` | Google Play, phone screenshots (Google takes 8: the same set without Hayom Yom and Rambam) | 1080 × 2160 |
| `feature-graphic.png` | Google Play, feature graphic | 1024 × 500 |
| `icons/icon-1024.png` (repo root) | App Store icon | 1024 × 1024 |
| `icons/icon-512.png` (repo root) | Google Play icon | 512 × 512 |

Upload them in number order. The first three are the ones people see in search results, so they carry the main message:

| # | Headline | Line under it | Screen |
|---|---|---|---|
| 1 | Chitas and Rambam, ready every day | Today's portions, worked out for you | Today |
| 2 | Chumash with Rashi | Hebrew and English, side by side | Chumash |
| 3 | Stop anywhere. Pick up right there. | Your place is kept, even on your other devices | Tehillim halfway, "Continue from your other device" |
| 4 | A reminder for each, at your time | Says what's waiting, and opens right to it | The phone's lock screen that morning (7:45) with two of the app's real reminders: Tehillim, Psalms 1–9, and Chumash, Toldos · Aliya 4 |
| 5 | Understand the Tanya | A plain-English guide walks you through | Tanya with its guide |
| 6 | Check what stayed with you | A few questions, written from today's text | A Review question, answered |
| 7 | Your Tehillim, and your family's | Each person's chapter, from their Hebrew birthday | Personal Tehillim |
| 8 | Watch your learning add up | Every passuk, chapter and halacha you've learned | Progress |
| 9 | Hayom Yom, every day | The original, with a clear English translation | Hayom Yom (Apple only) |
| 10 | Rambam your way | Three chapters, one, or Sefer HaMitzvos. Light or dark. | Rambam, dark mode (Apple only) |

Google takes 8: numbers 1 to 8. The screens show 11 November 2026 (1 Kislev, Toldos), fixed in `tools/store/shoot.mjs` (`DAY`) so the Review questions match the day's Chumash; Tanya (5) shows 21 November and Rambam (10) 24 November (`SHIFT`), days with the guides in their current style: the Tanya's bridges, and the Rambam's matched paragraphs and plain-words notes (on the one-chapter track that day, Forbidden Foods 14).

**Why these.** People who search for a Chitas app already learn, or want to. What they want to know in three seconds: does it have *today's* portions, worked out for me (1); is it the real text, the way I learn it, Hebrew and English with Rashi (2); and does it fit my day (3 and 4). Two things answer that, and both are reasons to have the app rather than a website: it keeps your place when you stop, and it reminds you at your own time for each part, saying what's waiting and opening right to it. So they come early. Then: will I understand it (5), and did it stay with me (6). After that, what no other app does for them: their own family's Tehillim (7) and a quiet record of what they've learned (8), with Hayom Yom (9) and the Rambam tracks (10) on Apple.

---

## 1. Name and short texts

**App name** (Apple 30, Google 30)
> Chitas: Daily Learning

Use the same name in both stores, because people search for it. On the phone, under the icon, the app is just "Chitas".

**Subtitle** (Apple only, 30)
> Chumash Tehillim Tanya Rambam

**Short description** (Google only, 80)
> Daily Chumash with Rashi, Tehillim, Tanya and Rambam, in Hebrew and English.

**Promotional text** (Apple only, 170; can be changed any time without a new review)
> Today's Chumash, Tehillim, Tanya and Rambam, ready when you open it, in Hebrew and English. Stop anywhere, and pick up right there, even on your other devices.

**Keywords** (Apple only, 100; commas, no spaces after them; words already in the name and subtitle don't need repeating)
> chabad,lubavitch,torah,rashi,hayom yom,rebbe,jewish,parsha,psalms,sefer hamitzvos,limud,yomi

---

## 2. Description (Apple 4000, Google 4000)

> Chitas is the daily Chumash, Tehillim, Tanya and Rambam, ready the moment you open it.
>
> No working out where today's portion starts and ends, no switching between books and websites. Today's four are waiting, each opened to the right place for the day, in Hebrew and English side by side. Learn them in any order, mark each part as you finish it, and watch the day's four rings close.
>
> PICK UP RIGHT WHERE YOU STOPPED
> Stop in the middle of a chapter, and next time it opens at the same line. Sign in, and your place follows you: say Tehillim on your phone in the morning and finish on your tablet at night, or start the Rambam on the computer and finish it on the bus.
>
> CHECK WHAT STAYED WITH YOU
> When you've learned, take a quick Review: a few questions written from today's Chumash, Tanya or Rambam, each with the answer explained and the line it comes from. Or a deep dive, when you have more time. Then, if you like, send it to a friend: they get the same questions, free, with no sign-up.
>
> WHAT'S INSIDE
> • Chumash: the day's aliyah, with Rashi
> • Tehillim: the daily portion by the monthly cycle, laid out like a printed Tehillim, with Elul's extra chapters in their season
> • Personal Tehillim: your own chapter and your family's, worked out from each person's Hebrew birthday, and the Rebbe's chapter if you like
> • Tanya: the day's portion in the Vilna font, with an optional plain-English guide that walks you through the argument
> • Rambam: three chapters, one chapter, or Sefer HaMitzvos, the Hebrew and English matched paragraph by paragraph, with a line on each chapter and plain-words notes on the halachos that are hard to follow
> • Hayom Yom: the original, with a clear English translation
> • In its season: Sefiras HaOmer, with the day's count
>
> MORE LEARNING (BETA)
> Add Daf Yomi, Nach Yomi, Halacha Yomis or the week's Likkutei Torah, if you learn them too.
>
> SEE YOUR LEARNING ADD UP
> Your days in a row, the month on a calendar, and everything you've learned: pesukim of Chumash, chapters of Tehillim, days of Tanya and halachos of Rambam. Milestones mark a finished parsha, all of Tehillim, your best month. It counts what you did, never what you missed, and Shabbos and Yom Tov never break your run.
>
> REMINDERS
> A gentle reminder for each part, at the time you usually learn it. It says what's waiting, and a tap opens it.
>
> ANY DAY, ANY DEVICE
> Read ahead or go back to any day. Missed one? Mark it within a week. Sign in with Apple or Google, and everything you've learned is on your phone, tablet and computer.
>
> MADE TO BE QUIET
> No ads. No tracking. No leaderboards. Use it without an account if you prefer. Light and dark, with comfortable reading fonts.
>
> Texts come from Sefaria and the calendar from Hebcal. The guides and Review questions are written with the help of AI, from the day's text, and marked as such; the texts themselves are never changed. A question, or a mistake in a text? Write to chitas.daily@gmail.com, or tap "Report a mistake" in any reader.

What's deliberately not promised: the short note on the Chumash ("Today in the parsha") is written ahead in batches, so it appears on most days but not all. The Rambam's line and notes are there every day (written ahead where possible, otherwise made by the AI once per chapter and saved), so the description can promise them.

---

## 3. Links and contact

| Field | Answer |
|---|---|
| Privacy policy URL | https://chitas.vercel.app/privacy.html |
| Support URL (Apple) | https://chitas.vercel.app/support.html |
| Marketing URL (Apple, optional) | https://chitas.vercel.app |
| Website (Google) | https://chitas.vercel.app |
| Contact email | chitas.daily@gmail.com |
| Phone (Google, optional) | leave empty |

---

## 4. Category, price, age

| Field | Apple | Google |
|---|---|---|
| Category | Education (secondary: Reference) | Education |
| Tags (Google) | — | Religion, Study, Reference |
| Price | Free | Free |
| In-app purchases | None | None |
| Ads | — | "No, my app does not contain ads" |
| Age rating | 4+ (answer "None" to every content question) | Everyone, via the IARC questionnaire below |
| Made for kids | No (it's for all ages, but not aimed at children) | Target age: 13+ (see the note below) |

**Note on age for Google.** If you pick an age group under 13, Google treats the app as made for children and applies extra rules about sign-in and data. Picking "13–15, 16–17, 18+" avoids that, and the rating is still "Everyone".

### Google content rating questionnaire (IARC)

- Category: **Reference, News, or Educational**
- Violence, fear, sexuality, language, controlled substances, crude humour: **No** to all
- Does the app let users talk to or share content with each other? **No**
- Does it share the user's location? **No**
- Can users buy digital goods? **No**
- Gambling? **No**
- **Is this app a news app?** No

---

## 5. Privacy answers

These must match the privacy page. If the app changes what it saves, update both.

### Apple: App Privacy ("nutrition label")

**Do you or your third-party partners collect data from this app?** Yes.

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info → Name (from sign-in; and the first name on a shared Review or day link, if the person leaves "Show my first name" on) | Yes | Yes | No | App functionality |
| Contact info → Email address | Yes | Yes | No | App functionality |
| Identifiers → User ID | Yes | Yes | No | App functionality |
| User content → Other user content (names and birthdays added in Personal Tehillim) | Yes | Yes | No | App functionality |
| Usage data → Product interaction (which sections were marked, Review results, and where you stopped reading, so it opens there on your other devices) | Yes | Yes | No | App functionality |
| User content → Customer support (what someone writes in "Send feedback" or "Report a mistake", with an email if they leave one) | Yes | No (saved without the account) | No | App functionality |
| Diagnostics → Other diagnostic data (an error's message, where in the app, the app's version and the kind of phone, so crashes are fixed) | Yes | No (no account, name or address goes with it) | No | App functionality |
| Location | No (the city is typed in by the user and saved as a setting; Apple doesn't count that as location data) | | | |
| Everything else (health, financial, contacts, photos, browsing, search, purchases) | No | | | |

"Tracking" here means following people across other companies' apps and websites. Chitas does none of this, so **no App Tracking Transparency prompt is needed**.

### Google Play: Data safety

- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**: in the app (Profile → Delete account), and by email to chitas.daily@gmail.com
- Delete account URL (required when an account can be created): https://chitas.vercel.app/support.html (it explains the in-app steps)

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Personal info → Name (and a first name on a shared link, if chosen) | Yes | No | Optional (only with sign-in) | App functionality, Account management |
| Personal info → Email address | Yes | No | Optional | Account management |
| Personal info → User IDs | Yes | No | Optional | Account management |
| App activity → App interactions | Yes | No | Optional | App functionality |
| App info and performance → Crash logs / Diagnostics (an error's message, place, app version and kind of phone; nothing about the person) | Yes | No | Required | App functionality |
| App activity → Other user-generated content (Personal Tehillim; what someone writes in Send feedback or Report a mistake) | Yes | No | Optional | App functionality |

"Shared" means given to another company for its own use. Firebase, Vercel and Resend (which emails feedback to chitas.daily@gmail.com) only process data on Chitas's behalf, and Google says that doesn't count as sharing. Reminders are set on the phone itself and send nothing anywhere. The Review, the Tanya guide and the Rambam guide send only the day's text to Anthropic, never anything about the user, so that isn't user data either.

---

## 6. Other questions you'll be asked

**Export compliance / encryption (Apple).** "Does your app use encryption?" **Yes**, then "Does it qualify for any of the exemptions?" **Yes: it only uses standard encryption (HTTPS) built into the operating system.** No paperwork is needed. `app/README.md` (Part 2, one time in Xcode) adds `ITSAppUsesNonExemptEncryption = NO` to the app's settings, so Apple stops asking on every upload.

**Sign-in for review (Apple: App Review Information).** "Sign-in required?" **No.** Notes for the reviewer:
> Sign-in is optional. Tap "Start today" on the first screen to use the full app without an account. To test an account, use Sign in with Apple from Profile. Account deletion is in Profile → Delete account. Reminders (local notifications) are in Profile → Reminders. The app shows the daily Jewish learning schedule (Chumash, Tehillim, Tanya, Rambam) in Hebrew and English; texts come from Sefaria. The reading guides and Review questions are generated with AI from the day's text only; no user data is sent, and they are labelled in the app. Beyond the daily texts, the app uses native Sign in with Apple and Google, local notification reminders for each section, and haptics. It runs on iPhone and iPad. After a Review, or on finishing all four, the result can be shared as a link ("Share your result", "Share your day"); the link opens a web page where anyone can answer the same questions without an account.

**Google: App access.** "All functionality is available without special access."

**Google: Government app / financial features / health.** No to all.

**Google: News app / COVID app.** No.

**Google: Target audience and content.** 13+ (see section 4).

**Copyright.** © 2026 Menachem Marcus. (Apple shows this line on the listing; it's the name the developer account is under.)

---

## 7. Before we submit (things only you can answer)

1. ~~**Final name**~~ Decided: "Chitas: Daily Learning" in the stores, "Chitas" on the phone.
2. ~~**Developer name**~~ Decided: **Menachem Marcus** (individual accounts on Apple and Google). The app can move to a business account later if needed.
3. ~~**Hayom Yom English**~~ Done: the app ships its own English translation.
4. ~~**Fonts**~~ Decided: you have permission to ship them.
5. **Free forever?** If you might charge later, it's easier to decide now: a paid app can't become free and back without hassle, but adding optional in-app purchases later is fine.
6. **Guide runway**: written (and checked) so far: Rambam through 8 December, Tanya through 5 December, Chumash through 19 December. Past that the server's AI covers each day in the same style, so nothing breaks; the weekly batch (`docs/guides-batch.md`) keeps the written ones ahead.

---

## 8. The videos

Four 28-second videos, made from the real app, with original music composed for them (it's ours, so there's no licence to worry about), in `docs/store/video/`:

| File | For | Size |
|---|---|---|
| `chitas-app-preview.mp4` | App Store, "App Preview" in the iPhone (medium display) box | 886 × 1920, 30 fps |
| `chitas-promo.mp4` | Google Play's promo video (a YouTube link) | 1920 × 1080, 30 fps |
| `chitas-coming-soon-vertical.mp4` | Sharing now, before the App Store: WhatsApp status, Instagram stories, phones. Ends on "Coming soon to the App Store" and chitas.vercel.app | 886 × 1920 |
| `chitas-coming-soon-wide.mp4` | The same, for YouTube, email and websites | 1920 × 1080 |

The store versions end on the name only: Apple and Google don't allow a web address or "coming soon" in a store video.

**What it shows**; every cut lands on a beat of the music. The first scene is what every daily-study app gives you; every scene after it is a reason to choose Chitas:

| Seconds | Scene | Headline |
|---|---|---|
| 0–2.6 | Today: Tanya and Rambam ticked, "All four done" | All of Chitas and Rambam, every day |
| 2.6–8.75 | Chumash with Rashi, Hebrew and English: the line marked "You stopped here"; closed, back to Today ("Good morning"); "Later that day", the greeting turns to "Good afternoon"; Chumash tapped, and it opens on that same line, "Right where you stopped". All real app footage | Close it. It opens right where you stopped. |
| 8.75–11.4 | The phone's lock screen at 7:45: with a soft chime, the reminder "Tehillim · Psalms 1–9" rises into place; tapped, the lock screen slides away to Tehillim, as the app's reminder does | A reminder for each, at your time |
| 11.4–16.6 | The guides, one after another, each box softly outlined: Chumash ("Today in the parsha"), Tanya ("So far in this chapter"), Rambam ("This chapter") | A guide in Chumash, Tanya and Rambam |
| 16.6–19.25 | A Review question on the day's Chumash, with Rashi's reason | Then see what stayed with you |
| 19.25–21.9 | Personal Tehillim and the people sheet | Each person's own Tehillim chapter |
| 21.9–24.5 | Progress: totals, milestones | Watch your learning add up |
| 24.5–28 | The four rings draw in, then the name | Chitas · Chumash · Tehillim · Tanya · Rambam |

Keeping your place gets the most time, so it can be told clearly, and reminders follow it: both are reasons to have the app rather than a website. The three guides go by quickly under one headline. Everything shows one day, 11 November 2026, fixed in `tools/store/video/capture.mjs` (`DAY`), as in the screenshots, except Tanya, shown on 24 November (`shift` on its scene, `SHIFT` in `shoot.mjs`): the server prepares Tanya's guide only for the last week, and that day's guide has the titles. A later remake moves that day on. The reminder is shown on the phone's lock screen. Apple's previews must show the app itself, so a reviewer could object to the lock screen in the App Store preview; if that happens, that one scene can show the notification over the app instead, or the app's Reminders screen (Google, YouTube and the coming-soon videos have no such rule). On the App Store the preview **plays silently** on its own, so every scene carries a headline, already there on the first frame; the music is for people who tap the sound on.

**App Store:** in the version's page, drag `chitas-app-preview.mp4` onto the iPhone "medium display" media area, before the screenshots. Apple then asks for a **poster frame** (the still shown before it plays): pick **00:00**, the Today screen under its headline (there from the first frame), so it looks like screenshot 1. iPad previews are optional; the iPad screenshots are enough.

**Google Play:** upload `chitas-promo.mp4` to YouTube (Visibility: **Unlisted**; and in YouTube Studio → Monetization, ads **off**, as Google requires), then paste its link into Play Console → Store listing → Video.

**Why it's made this way:** Apple rejects previews that show a phone frame, so the App Store version shows the app's own screen. Each scene opens on the app doing something, with no logo intro, because the first seconds decide whether people keep watching.

## 9. Making the screenshots again

When the app changes, the screenshots can be remade with real texts for any day, from `tools/` (it needs the internet, to fetch the texts):

```
cd tools
node store/shoot.mjs phone light && node store/shoot.mjs phone dark rambam
node store/shoot.mjs ipad light && node store/shoot.mjs ipad dark rambam
node store/compose.mjs apple && node store/compose.mjs ipad && node store/compose.mjs google && node store/compose.mjs feature
```

The videos, from `tools/` (`timing.json` holds the scenes and headlines):

```
node store/video/capture.mjs && python3 store/video/music.py && python3 store/video/compose.py
cp store/video/out/*.mp4 ../docs/store/video/
```

`shoot.mjs` takes the plain screens (a learner six weeks in, with a few people in Personal Tehillim); `compose.mjs` adds the headlines and writes into `docs/store/`. The headlines are at the top of `compose.mjs`. Hayom Yom is taken on a day whose entry fills the page (`SHIFT` in `shoot.mjs`): look at it and pick another day if needed. The Review questions in the picture are written in `shoot.mjs` (`REVIEW`), from that day's real Chumash, because the live Review needs an account: rewrite them for the day you shoot.
