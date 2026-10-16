# Chitas Daily — Full Audit (Oct 2026)

Every file in the repo was read line by line: `index.html` (11,150 lines), all 6 files in `api/`, `sw.js`, `manifest.json`, `package.json`. Where something could be checked by running code, it was. (The parsha/aliyah tables were compared against the official Hebcal library, and the streak math was simulated.)

Line numbers refer to `index.html` unless another file is named.

---

## 0. Status (updated as we go)

### ⏳ Waiting on you: please check these
1. **Firestore Security Rules:** written and tested (`firestore.rules`, `tools/test-rules.mjs`, 20 checks on the Firestore emulator). **Publish them**: Firebase console → Firestore Database → Rules → paste `firestore.rules` → Publish. The old test-mode rules let anyone read or change everything and stop working on Nov 12, 2026 (§4.1, §4.3, §4.5).
2. **`dach-dev`:** is that Firebase project (the Likkutei Sichos text + fonts) yours? (§6.2)
3. **Hayom Yom text:** where did the English in Firestore come from? (§6.2)
4. **`cache/{date}` in Firestore:** does something outside this repo write it (e.g. a Firebase Function)? If not, the app's `loadDailyCache` call can be removed (§7).
5. **Vercel environment variables** (Project → Settings → Environment Variables), needed by the quiz and Tanya routes:
   - `ANTHROPIC_API_KEY`: your Claude API key
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: from a Firebase service-account key (Firebase console → Project settings → Service accounts)
   - `ADMIN_UIDS`: your own Firebase user id (comma-separated if more than one); only these can force-regenerate Tanya
6. **Sign in with Apple** (the App Store requires it next to Google sign-in). The code is ready; switch it on with `APPLE_SIGNIN_ENABLED = true` in `index.html` after:
   - Apple Developer account → Certificates, IDs & Profiles: create a **Services ID** (e.g. `com.yourname.chitas.signin`) with "Sign in with Apple" enabled. Its return URL is `https://chitas-daily.firebaseapp.com/__/auth/handler`. Also create a **Key** with Sign in with Apple enabled.
   - Firebase console → Authentication → Sign-in method → **Apple** → enable, and paste the Services ID, Team ID, Key ID and the private key.
   Note: once the app is wrapped as a real iOS app, Google sign-in inside an app web view is blocked by Google, so sign-in will need the native plugins then (part of the App Store work, §5).
   The server writes to the new Firestore collections `quiz_cache`, `quiz_usage`, `tanya_usage` (and `tanya_enhanced`). Your Security Rules should NOT let the app write to these; the server's admin key ignores the rules.

### ✅ Fixed so far (branch `claude/adoring-dijkstra-p9ri1h`)
- §3.3 Streak capped at 9 → new streak rules, with Shabbos/Yom Tov never breaking it (`js/progress.js`)
- §3.4 Chumash aliyos → generated from Hebcal with Chabad's holiday rules
- §3.5 Tehillim day 1–2 split, plus finishing Tehillim in 29-day months
- §3.6 Five crashing functions
- §3.8 Reset progress now really resets, including the cloud
- §4.2 Names, cities, and dictionary text are escaped (shown as plain text, never run as code)
- §7: lifetime and Sha'ar HaBitachon progress now saved to the cloud; Sha'ar HaBitachon place-saving; Sefer HaMitzvos "undefined" headings; the duplicate Shoftim entry; the toast's +150 mismatch; the calendar missing this week; pinch-zoom; the hardcoded "Psalm 124"; dead code
- Points and home screen redesigned (see `DESIGN.md`)
- §3.1 Real quizzes: Quick review (4) / Deep dive (6) on exactly today's portion; every answer is checked against a quote from the text, with an explanation; misses reviewed at the end (`api/quiz.js`)
- §4.4 AI routes need a signed-in user, have daily limits, and share saved results; `bust` is admin-only; open CORS removed; the unscheduled, spoofable `api/cron-tanya.js` removed
- §6.1 Tanya: the hand-written chapter intros (several wrong) removed; the summary is AI-written and labeled so; sentence splitting can no longer change the text (`api/_lib/tanya-split.js`)
- Progress tab: real learning stats (full parshiyos, times through Tehillim, Rambam chapters of 1,000, last-30-days per section) (`js/learning-stats.js`)
- Rambam: translator's footnotes are back, as tappable numbers that open in place
- Onboarding: one welcome screen instead of ten; no account needed to start (progress is kept on the phone and combined with the account on sign-in, `js/account-merge.js`); sign-in is offered when it helps (after the first section, quizzes, leaderboard); Rambam track is asked the first time Rambam is opened; city is optional in the profile only
- Progress tab activity grid: one colour by how much was learned; Shabbos/Yom Tov shown as rest days, not misses

### Still open
§3.2 weekly quiz (still placeholder questions, and unreachable; idea: a weekly review built from the questions you missed) · §3.7 "learned it" accountability (quizzes are now the proof layer) · §4.1/4.3 Firestore rules · §5 App Store

---

## 1. The short version

The app looks polished and the **readers** (Chumash with Rashi, Rambam, Tanya, Tehillim) are real, working, and nicely done. But the four things your goal depends on are mostly not working:

| Your goal | Reality today |
|---|---|
| **Accountable** | You can tap ✓ on the home screen without opening anything. Streaks can never pass 9 days (bug). Shabbos breaks streaks for anyone who doesn't use a phone on Shabbos. |
| **Quiz** | Every quiz is **fake**: the same hardcoded questions about the Mishkan, every day. The real AI quiz server (`api/quiz.js`) exists but the app never calls it. The weekly quiz can't be opened at all. |
| **Actually learn** | The hand-typed aliyah table has 41 ranges that differ from Hebcal, and spot-checks against Chabad.org confirm **Hebcal is right** (§3.4). Tehillim days 1–2 are split wrong. Several Tanya chapter intros are factually wrong. |
| **App Store** | Missing: Sign in with Apple, in-app account deletion, privacy policy, native features (Apple rejects plain website wrappers). There is also a privacy leak to fix first. |

Over time, building with a chat AI added a lot of extra features (Likkutei Sichos translation mode, Sha'ar HaBitachon, Daf Yomi, Sotah, Likkutei Torah…). Meanwhile the core Chitas loop was left with placeholders. **Recommendation: freeze extra features, fix the core, and make quizzes real.**

---

## 2. How the app is built (map)

```
index.html   11,150 lines, 623 KB. ALL the HTML, CSS, and JavaScript, in one file.
  ├─ lines 17–594      CSS styles
  ├─ lines 596–710     Firebase setup (login + database)
  ├─ lines 712–1630    HTML layout (onboarding, home, panels, modals)
  └─ lines 1631–11138  JavaScript: ~300 functions
api/                   Vercel serverless functions (small programs that run on a server)
  ├─ quiz.js            AI quiz generator. Good design, but NEVER CALLED by the app
  ├─ tanya-enhance.js   AI splits Tanya into sentences, cached in Firestore. Used
  ├─ tanya-boundary.js  Finds where today's Tanya starts/ends. Used
  ├─ sefaria-calendar.js  Proxy to Sefaria's calendar. Used
  ├─ rambam-refs.js     Rambam chapter lookup. NOT used (app uses Hebcal directly)
  └─ cron-tanya.js      Meant to run daily. NOT scheduled (there's no vercel.json)
sw.js                  Service worker (offline caching). Fine.
fonts/, icons/         Assets
```

**Data sources:** Hebcal (calendar), Sefaria (texts), your Firebase project `chitas-daily` (users, Hayom Yom, summaries, dictionary), **someone else's Firebase project `dach-dev`** (Likkutei Sichos text), dach.dev (fonts), Anthropic (AI).

---

## 3. 🔴 Critical: broken or wrong right now

### 3.1 Quizzes are fake
- `openQuiz()` (line 3644) shows hardcoded `DUMMY` questions (line 3663) after a fake 1.2-second "Generating…" delay. The Chumash quiz is always about Betzalel and the Mishkan, whatever the aliyah. Some answer choices are literally *"Laws covered in today's chapter"*.
- The weekly quiz (line 3811) is also hardcoded.
- `api/quiz.js` is a well-designed AI quiz server, but `grep` finds **zero** calls to `/api/quiz` in the app.
- Users earn XP and "quiz accuracy" stats from these fake questions.

### 3.2 Weekly quiz can't be reached
`checkMotzeiShabbosPopup()` (line 3710) is never called, and `renderWeeklyQuizCard()` (line 3734) only runs after you *finish* the weekly quiz. So the card and the popup never appear.

### 3.3 Streaks can never go above 9 days
`recalcStreak()` (line 9095) only looks back `MAX_DAYS_BACK + 1` = 8 days. Simulated: a user with 60 perfect days in a row gets **streak = 9**. So the 30-day (+500 XP) and 100-day (+2000 XP) celebrations can never happen, the leaderboard "Streak" tab is capped at 9, and the onboarding screen promising a "47 day streak" isn't possible.

### 3.4 Chumash table ✅ FIXED (tables now generated from Hebcal: `tools/generate-chumash-data.mjs`, tested in `tools/test-chumash.mjs`; all holiday weeks incl. Simchas Torah verified on Chabad.org)
The app ignores Hebcal's aliyah data and uses two hand-typed tables: `PARSHA_SCHEDULE` (line 2631) and `PARSHA_ALIYOT` (line 2686). Compared against the `@hebcal/core` + `@hebcal/leyning` libraries:
- **41 aliyah ranges differ from Hebcal.** **Verified against Chabad.org (Oct 2026):** 5 spot-checks (Vayeshev 7, Ki Tisa 1, Tzav 2, Nasso 5, Ki Teitzei 3) all match **Hebcal**, not the app's table. So the table is wrong, and Hebcal can be trusted for Chabad's Chitas.
- **Definite typos** (wrong under any custom, because the same verses land in two parshiyos): **Vayeshev aliyah 7** = Genesis 41:1–14, which is Miketz's opening, so Vayeshev never reaches 40:1–23. **Vayishlach aliyah 7** ends at 37:1, which is also Vayeshev's first verse.
- **Need checking** (differ from Hebcal): all 7 of Tzav, Ki Tisa, Vayakhel-Pekudei; Nasso 4–7; Ki Teitzei 3–7; Terumah 2–3; Tazria 1–2; Behar-Bechukotai 3–4; Chukat-Balak 1–2; Nitzavim 7.
- Git history shows the table was added on 2026-03-29 and changed once afterward (Tazria-Metzora, 2026-04-15). That fix agrees with Hebcal.
- The 5786 calendar was shifted **2 weeks** from October 2025 to March 2026. (That's in the past now, but it shows the method is unreliable.)
- Holiday weeks (e.g. Pesach 2027, Shavuos 2027) have **no entry**, so the Chumash reader fails.
- The table **ends September 2027.** After that, Chumash breaks completely.
- It only knows the Diaspora schedule (`tzid=America/New_York`, `i=off` is hardcoded). Users in Israel get the wrong parsha some weeks.

**Fix:** delete both tables and compute aliyos with `@hebcal/core` + `@hebcal/leyning` (free, offline, every year, Israel and Diaspora). Add tests that lock in the 5 Chabad.org-verified dates above.

### 3.5 Tehillim cycle is off on days 1–2 ✅ FIXED (`js/tehillim.js`, tested in `tools/test-tehillim.mjs`; 29-day-month rule verified on Chabad.org)
`TEH_CYCLE` (line 5618) has day 1 = Psalms 1–8 and day 2 = 9–17. The standard monthly division is **1–9** and **10–17**. It also doesn't handle a 29-day month: on the 29th, you also say day 30's chapters (145–150). The home screen gets Tehillim from Hebcal, but the reader uses this table, so the two can disagree.

### 3.6 Functions that don't exist (these crash) ✅ FIXED (tested in `tools/test-app.mjs`)
| Called | Where | Effect |
|---|---|---|
| `_refreshUI()` | 3036 | **Calls itself forever** → crashes ("Maximum call stack"). It runs at the end of every Mark Done (3602), so the reader doesn't close and the list doesn't refresh. |
| `hideSplash()` | 2989 | Only runs when loading fails, so the **error screen itself crashes** and users see loading skeletons forever. |
| `showToast()` | 7214, 7225 | Sign-out and Share crash at the end. |
| `_toggleTehillimFixed()` | 2418, 9039 | The Rebbe/Rebbetzin on/off toggles in "Personal Tehillim" do nothing. |
| `_lsParshaKey()` | 7575 | Likkutei Sichos card subtitle crashes (a fallback hides it). |

### 3.7 "Accountability" can be skipped
- The ✓ button on each home card (lines 3092, 3375) marks a section done **without opening it**.
- The reader has a "scroll to the bottom to unlock Mark Done" system (`unlockMarkDone`, line 4957), but `openChabadPanel` (line 6322) enables the button immediately, so the lock is never used.

### 3.8 Reset progress doesn't actually reset
`resetProgress()` (line 7230) creates a new user **without the `uid`**, so the reset is never saved to the cloud. On the next app open, the old progress comes back from Firestore.

---

## 4. 🔴 Security and privacy (fix before more users join)

> **Beginner note:** Your Firebase "apiKey" being visible in the code is normal and fine. What protects the data is **Firestore Security Rules**, a small rules file in the Firebase console that says who can read/write what. Those rules are **not in this repo**, so I can't see them. But the code below shows what they must currently allow.

### 4.1 Everyone's private data is readable by everyone
`fetchLeaderboard()` (line 674) downloads the **whole user document** for the top 50 users. Firestore rules work per document, not per field, so for this to work, any signed-in user must be able to read entire user documents. That includes **other people's family members' names and Hebrew birthdays** (`tehillimPeople`), their full day-by-day history, city, and email-linked name.
**Fix:** keep a separate `leaderboard` collection with only `{displayName, city, xp, streak}`, and lock `users/{uid}` so only the owner can read it.

### 4.2 Leaderboard can run someone else's code (XSS)
Names and cities are inserted straight into the page (`${p.city}`, line 6801). A user can set their city to a snippet of HTML/JavaScript (by writing to Firestore directly), and it will **run on every person's phone** that opens the leaderboard. The same pattern appears in Tehillim names (2439, 9053), the dictionary popup (9473), and the Shaar HaBitachon summaries.
**Fix:** use `textContent` or an `escapeHtml()` helper for anything that came from a user or the database.

### 4.3 Anyone can cheat the leaderboard
XP and streak are calculated on the phone and saved by the phone. Anyone can write `xp: 999999` to their own document.
**Fix:** at minimum, rules that only allow small increases. Better: compute XP on the server.

### 4.4 Anyone on the internet can spend your AI budget
- `api/quiz.js` accepts requests from any website (`Access-Control-Allow-Origin: *`) with no login and no rate limit. Each request makes **2** AI calls. The weekly mode even lets the caller send their own text into the prompt.
- `api/tanya-enhance.js?bust=1` (line 207) forces a fresh AI call every time.
**Fix:** require the Firebase login token, cache quiz results per day so each quiz is generated once for everyone, and remove `bust` (or protect it with a secret).

### 4.5 Admin features depend on the client
The dictionary editor checks `user.isAdmin` **in the browser** (6522, 9470). The real protection must be Firestore rules on `lsDict`, which I can't see. Please check that only your account can write there.

---

## 5. 🟠 App Store / Google Play readiness

| Requirement | Status |
|---|---|
| **Not "just a website" (Apple 4.2)** | ❌ Apple rejects apps that only wrap a website. You need real native features: **push reminders** (also your #1 accountability tool), offline mode, maybe a home-screen widget. Realistic path: **Capacitor** (wraps this web app in a native shell and adds native plugins). |
| **Sign in with Apple (4.8)** | ❌ Google is the only login, and it's mandatory. Add Apple sign-in, and ideally let people try the app *before* signing in. |
| **Delete account in-app (5.1.1)** | ❌ Only "Reset progress" (which is broken, §3.8). |
| **Privacy policy + data disclosure** | ❌ None. You store family names and birthdays, so this matters. |
| **User-generated content (1.2)** | ⚠️ Leaderboard names/cities are public. Apple wants a way to report or hide offensive names. |
| **Content rights (5.2)** | ⚠️ See §6.2. You need to be able to show you're allowed to use every text and font. |
| **Accessibility** | ⚠️ `maximum-scale=1` (line 5) blocks pinch-zoom. Remove it. |
| **Icons / manifest** | ⚠️ The icons are tiny 4 KB files. Store listings need a crisp 1024×1024 icon and screenshots. |

---

## 6. 🟠 Content accuracy and licensing

### 6.1 Tanya chapter intros are partly wrong
`TANYA_CHAPTER_INTROS` (line 5822) has 53 hand-written summaries shown as "Context". Several are factually wrong:
- **Chapters 44–53** are described as *Shaar HaYichud VehaEmunah* and *Iggeres HaTeshuvah*. Those are **separate parts** of Tanya. Likkutei Amarim has 53 chapters of its own.
- Intros are matched **by chapter number only**, so when the daily Tanya is in Shaar HaYichud chapter 3, the user sees the Likkutei Amarim chapter 3 intro.
- Some earlier ones (e.g. chapters 6–7) don't match the chapter's content either.

For a Torah-learning app, wrong content is worse than no content. **Remove these, or have someone knowledgeable write and check them.** The AI-generated per-day "context" from `tanya-enhance` should get the same review.

### 6.2 Where content comes from (please confirm you have permission)
- **Likkutei Sichos** is read from a Firebase project called **`dach-dev`** (line 10364), and fonts come from `dach.dev`. If that isn't yours, the whole feature depends on someone else's server and permission. They could change it or shut it off at any time.
- **Hayom Yom** text is stored in your Firestore. Where is the English from? (Kehot's translation is copyrighted.)
- **Sefaria** texts each have their own license. Many are fine for a free app but **require attribution**, which the app mostly doesn't show (only Sha'ar HaBitachon credits its translator). Some are "non-commercial only", which matters if you ever charge.
- **Chumash translation "Kehot"** (line 8921): Sefaria likely doesn't have a Kehot translation, so the app quietly shows whatever the first English version is.
- **Fonts** (OT Vilna, OT Siddur, Shlomo, Taamey Frank): check that each license allows embedding in an app.

---

## 7. 🟡 Smaller bugs found

- Profile/stats data not synced to the cloud: `lifetime` (verses, halachos, chapters), `shbProgress`, `shbCompleted` aren't in `_userPayload()` (1756). They're **lost on a new phone or after sign-out**.
- The "Day complete" toast says `+ (s.xp+150) XP` (3570), but the code awards `s.xp + 50`.
- `user = {...BLANK}` (7204, 7232) makes a shallow copy, so later changes to `user.done` also change the shared `BLANK` template.
- Tapping an old day on the 10-week activity grid does nothing past 7 days back (`navDay` refuses, 3144).
- Sefer HaMitzvos with 2+ mitzvos shows "undefined" headings (`res.title` doesn't exist, 8488).
- `_SEFARIA_BOOKS` (9560) has duplicate keys: `'שופטים'` maps to Deuteronomy, then Judges, so the parsha Shoftim resolves to the book of Judges.
- Likkutei Torah loads only the **first** maamar (`.1`) of each parsha (8777).
- Sha'ar HaBitachon saves `contEl.scrollTop` (10060), but the scrolling element is `#native-reader`, so it always saves 0.
- `fetchHebcal()` computes a timezone (2601–2605) and then never uses it.
- `loadDailyCache()` (620) reads `cache/{date}` on every launch, but nothing in this repo writes that document, so it's a wasted network call. `api/cron-tanya.js` isn't scheduled (no `vercel.json`).
- `api/quiz.js`: `difficulty` is accepted but never used, `cacheKey` is returned but nothing is cached, the Tanya fetch hardcodes `https://chitas.vercel.app`, and the verifier only sees the first 4,000 of 6,000 characters.
- The Rebbe's chapter is hardcoded as "Psalm 124" in onboarding (1105, 951). The app calculates 125 for this year.
- 14 functions are defined but never used: `obNext1, obAddTehillimPerson, _hebMonthNum, _tpmScrollTo, renderSections, buildQuizPrompt, checkMotzeiShabbosPopup, buildWeeklyPrompt, checkWelcomeBack, checkWeeklySummary, renderProfileSheetContent, _renderDafYomi, _renderPsTehillim`.

---

## 8. 🟡 Code health (why changes keep getting harder)

1. **One 11,000-line file.** Every chat-AI edit has to find its spot in a huge file. Things get duplicated (`_flatHtml` is defined twice; there are three different `cleanHtml` versions across files) or left half-finished (§3.6). Splitting into ~15 files by feature (calendar, readers, quiz, profile…) makes each change small and safe.
2. **No tests.** The calendar logic (which parsha, which aliyah, which Tehillim) is exactly the kind of code where a 20-line test would have caught §3.3–3.5 right away.
3. **Hardcoded data instead of libraries.** Parsha tables, Tehillim cycle, Hebrew dates (dozens of `hebcal.com/converter` calls; personal Tehillim makes 2 per person every time). `@hebcal/core` does all of this on the phone, instantly and offline.
4. **HTML built from strings** everywhere (`'<div style="…">' + x + '</div>'`). This causes the XSS problem in §4.2 and makes styling inconsistent (inline styles instead of CSS classes).
5. **No git workflow.** Most commits are named "Update index.html". Use one branch and one clear commit message per change.

---

## 9. ✅ What's genuinely good (keep it)

- **The Chumash reader**: verse-by-verse Hebrew/English, with Rashi matched to the correct verse, a choice of translations, and Vilna font. Really nice.
- **The Rambam reader**: handles days that cross between books (parsing Hebcal's `memo` field is clever), and styles Touger's bracketed words.
- **The Tanya reader**: exact daily slicing using tomorrow's start point, hagahos detection, and server-cached AI sentence alignment.
- **Personal Tehillim** (your kapitel for family members by Hebrew birthday): a lovely, unique feature.
- Saved scroll position, adjustable font size, dark/light mode, careful Hebrew typography.
- The **prompt design in `api/quiz.js`** is thoughtful (plain language, specific to today's text, a verifier step). It just needs to be connected and secured.
- The visual design and onboarding feel professional.

---

## 10. What to cut, park, keep

"Park" means hide it behind a switch, without deleting the code, until the core is solid.

| Feature | Recommendation | Why |
|---|---|---|
| Chumash / Tehillim / Tanya / Rambam readers | **Keep, fix data** | The heart of the app |
| Personal Tehillim | **Keep** | Unique, loved, small |
| Section quiz | **Rebuild (wire to real AI)** | Your core goal |
| Weekly quiz | **Rebuild after section quiz** | Build it from the week's real questions, especially ones you missed |
| Streak + XP | **Keep, fix** (9-day cap, Shabbos-aware) | Core accountability |
| Hayom Yom | Keep (if content rights are OK) | Small, part of the daily Chabad routine |
| Global leaderboard | **Park** until §4 is fixed. Consider "friends/chavrusa groups" instead | Privacy risk; cheating; friends make a stronger motivator |
| Likkutei Sichos (+ translation mode, dictionary, pasuk detection) | **Park** | ~1,800 lines, depends on someone else's server, rights unclear |
| Daf Yomi, Mishnah Yomi, Sotah, Likkutei Torah, Sha'ar HaBitachon | **Park** | Off-mission for a Chitas app; each adds bugs and licensing questions |
| Tanya chapter intros | **Remove** until reviewed | Several are wrong |
| WhatsApp share card | Keep (low cost) | Good for growth once the quiz is real |
| `api/rambam-refs.js`, `api/cron-tanya.js`, dead functions | **Delete** | Unused |

---

## 11. Suggested plan

**Phase 1: Make the core correct (1–2 weeks of work)**
1. Replace the parsha/aliyah/Tehillim tables with `@hebcal/core`, and add tests.
2. Fix the 5 missing/broken functions, the 9-day streak cap, and Reset progress.
3. Remove or replace the Tanya intros.
4. Lock down Firestore rules, add a separate leaderboard collection, escape all user text.
5. Secure the `api/` endpoints (require login, cache results).

**Phase 2: Make it accountable and a real learning tool**
1. Connect `api/quiz.js`: generate once per section per day, cache in Firestore, and serve the same quiz to everyone (cheap, fast, consistent).
2. Mark Done only after reaching the end of the text and/or passing the quiz. The home-screen ✓ opens the reader instead.
3. Shabbos/Yom Tov-aware streaks: on Motzei Shabbos, ask "Did you learn Shabbos's Chitas?" with one-tap backfill.
4. Weekly review built from the questions you got wrong this week (spaced repetition, the thing that actually makes learning stick).

**Phase 3: App Store**
1. Split `index.html` into modules with a simple build tool (Vite).
2. Wrap with Capacitor and add push-notification reminders.
3. Add Sign in with Apple, account deletion, a privacy policy, attributions/credits, and store assets.
4. TestFlight beta with ~20 real users, then submit.

---

## 12. Questions only you can answer

1. Is **dach.dev / the `dach-dev` Firebase project** yours, or someone else's?
2. Where did the **Hayom Yom** text in Firestore come from?
3. Is the app **free forever**, or might you charge? (This changes which Sefaria texts you may use.)
4. Who is the main user: yeshiva bochurim, adults, beginners, or kids? (This changes quiz difficulty and whether a public leaderboard makes sense.)
5. Do you have access to the **Firestore Security Rules** in the Firebase console? Please paste them so they can be reviewed and saved into this repo.
