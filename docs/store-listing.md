# Store listing: answers for the App Store and Google Play forms

Copy each answer into the matching box. The character counts are already checked against each store's limit.

Screenshots and graphics are in `docs/store/`:

| Files | For | Size |
|---|---|---|
| `apple/1-…6-*.png` | App Store, "6.9-inch iPhone" slot | 1290 × 2796 |
| `google/1-…6-*.png` | Google Play, phone screenshots | 1080 × 2160 |
| `feature-graphic.png` | Google Play, feature graphic | 1024 × 500 |
| `icons/icon-1024.png` (repo root) | App Store icon | 1024 × 1024 |
| `icons/icon-512.png` (repo root) | Google Play icon | 512 × 512 |

Upload the screenshots in number order: Today, Tanya, all four done, Progress, Review, dark mode.

---

## 1. Name and short texts

**App name** (Apple 30, Google 30)
> Chitas: Daily Chumash & Tanya

Plain "Chitas" may already be taken. If it is free on both stores, use it; otherwise use the line above. Pick one name and use it in both stores, because people search for it.

**Subtitle** (Apple only, 30)
> Chumash Tehillim Tanya Rambam

**Short description** (Google only, 80)
> Today's Chumash, Tehillim, Tanya and Rambam in one place. Hebrew and English.

**Promotional text** (Apple only, 170; can be changed any time without a new review)
> The whole day's learning in one place, Hebrew and English side by side. Mark each part as you go and close all four rings.

**Keywords** (Apple only, 100; commas, no spaces; words already in the name and subtitle don't need repeating)
> chitas,chabad,lubavitch,torah,sefer,limud,rebbe,hayom yom,jewish,daily learning,parsha,psalms

---

## 2. Description (Apple 4000, Google 4000)

> Chitas is the daily learning, Chumash, Tehillim, Tanya and Rambam, together in one calm place.
>
> Open the app and today's four are waiting. Each one opens to the right portion for the day, in Hebrew and English side by side. Learn them in any order. Tap to mark each part as done, and watch the day's four rings close.
>
> WHAT'S INSIDE
> • Chumash: the day's aliyah with Rashi
> • Tehillim: the daily portion by the monthly cycle, laid out like a printed Tehillim, and your own chapter and those of the people you add
> • Tanya: the daily portion in the Vilna font, with an optional plain-English guide that walks you through it
> • Rambam: three chapters, one chapter, or Sefer HaMitzvos
> • Hayom Yom for each day
>
> SEE YOUR LEARNING ADD UP
> Your days in a row, your last 30 days, and everything you've learned: pesukim, chapters of Tehillim, days of Tanya and halachos of Rambam. You'll see where you are in each cycle, and a quiet note when you finish a parsha, a sefer of Rambam or a book of Chumash.
>
> REVIEW
> A short review of today's Chumash, Tanya or Rambam, written from the day's text, to check what stayed with you.
>
> ANY DAY
> Read ahead or go back to any day from the calendar. Missed one? You can mark it for up to a week.
>
> MADE TO BE QUIET
> No ads. No tracking. No leaderboards. Use it without an account, or sign in with Apple or Google to keep your learning on all your devices. Light and dark modes, with comfortable reading fonts.
>
> Texts come from Sefaria and the calendar from Hebcal. Questions or a mistake in a text: chitas.daily@gmail.com

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
| Contact info → Name | Yes | Yes | No | App functionality |
| Contact info → Email address | Yes | Yes | No | App functionality |
| Identifiers → User ID | Yes | Yes | No | App functionality |
| User content → Other user content (names and birthdays added in Personal Tehillim) | Yes | Yes | No | App functionality |
| Usage data → Product interaction (which sections were marked, and Review results) | Yes | Yes | No | App functionality |
| Location | No (the city is typed in by the user and saved as a setting; Apple doesn't count that as location data) | | | |
| Everything else (health, financial, contacts, photos, browsing, search, diagnostics, purchases) | No | | | |

"Tracking" here means following people across other companies' apps and websites. Chitas does none of this, so **no App Tracking Transparency prompt is needed**.

### Google Play: Data safety

- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**: in the app (Profile → Delete account), and by email to chitas.daily@gmail.com
- Delete account URL (required when an account can be created): https://chitas.vercel.app/support.html (it explains the in-app steps)

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Personal info → Name | Yes | No | Optional (only with sign-in) | App functionality, Account management |
| Personal info → Email address | Yes | No | Optional | Account management |
| Personal info → User IDs | Yes | No | Optional | Account management |
| App activity → App interactions | Yes | No | Optional | App functionality |
| App activity → Other user-generated content (Personal Tehillim) | Yes | No | Optional | App functionality |

"Shared" means given to another company for its own use. Firebase and Vercel only process data on Chitas's behalf, and Google says that doesn't count as sharing. The Review and Tanya guide send only the day's text to Anthropic, never anything about the user, so that isn't user data either.

---

## 6. Other questions you'll be asked

**Export compliance / encryption (Apple).** "Does your app use encryption?" **Yes**, then "Does it qualify for any of the exemptions?" **Yes: it only uses standard encryption (HTTPS) built into the operating system.** No paperwork is needed. Later we'll add `ITSAppUsesNonExemptEncryption = NO` to the app's settings so Apple stops asking on every upload.

**Sign-in for review (Apple: App Review Information).** "Sign-in required?" **No.** Notes for the reviewer:
> Sign-in is optional. Tap "Start today" on the first screen to use the full app without an account. To test an account, use Sign in with Apple from Profile. Account deletion is in Profile → Delete account. The app shows the daily Jewish learning schedule (Chumash, Tehillim, Tanya, Rambam); texts come from Sefaria.

**Google: App access.** "All functionality is available without special access."

**Google: Government app / financial features / health.** No to all.

**Google: News app / COVID app.** No.

**Google: Target audience and content.** 13+ (see section 4).

**Copyright.** © 2026 *your name*. Apple shows this line on the listing, so use the name of the person or company the developer account is under.

---

## 7. Before we submit (things only you can answer)

1. **Final name**: "Chitas" if it's free on both stores, otherwise "Chitas: Daily Chumash & Tanya". The app itself still says "Chitas Daily" in three places (Share, the Profile footer, the share text); we'll change those to match the name you choose.
2. **Developer name** shown on the store: your own name, or a business name. A business name on Apple needs a D-U-N-S number.
3. **Hayom Yom English**: confirm where the English comes from and that we're allowed to use it.
4. **Fonts**: confirm the OT Siddur and Vilna fonts can be shipped inside an app (web licences sometimes don't cover apps).
5. **Free forever?** If you might charge later, it's easier to decide now: a paid app can't become free and back without hassle, but adding optional in-app purchases later is fine.
