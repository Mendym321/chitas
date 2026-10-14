# Chitas Daily — Progress & Home Screen Design

This explains **why** the points, streak, and home screen work the way they do. If you change one of them later, read this first.

## What the best apps teach us

| App | What it does well | What we take |
|---|---|---|
| **Duolingo** | One main number: the **streak**. It's always visible, protected on rest days, and repairable. Points (XP) are small, round, and easy to predict. | The streak is the hero. Simple round points. Rest days never break a streak. |
| **Apple Fitness rings** | One glance answers "am I done today?" You **close your rings**. | Chitas is already 4 parts, so today is a **4-segment ring**. |
| **Habit trackers** (Streaks, Loop) | A week strip of dots shows the pattern and lets you fix a missed day. | A 7-day strip under the ring. Tap a day to catch up. |
| **Headspace / Calm** | Calm and respectful, no number overload. Stats are "minutes", "days", real things. | Show real learning (days, chapters), not abstract levels. |
| **Sefaria / Daf Yomi apps** | Respect the text first. Gamification stays in the background. | Points never interrupt learning. One celebration per day, not five. |

## Problems with the old system
- **Too many numbers**, often repeating each other: XP appeared 3 times on the home screen, alongside Level, an XP bar, a streak, total days, and "perfect days" (which were the same thing as total days).
- **Levels meant nothing.** Each level needed 1.5× more XP, so progress stalled quickly, and levels unlocked nothing.
- **Points didn't add up.** The toast promised +150 when the app gave +50. Unmarking and re-marking could change your total. Bonus XP for milestones inflated totals.
- **Streak** capped at 9 and broke every Shabbos for anyone who doesn't use a phone on Shabbos.
- **Quiz XP** was paid for fake questions.

## The new system

### 1. Today = 4 segments
Chumash, Tehillim, Tanya, Rambam. Each segment fills in its section's color. When all 4 are done, you have a **Chitas day** ✓.

### 2. Streak 🔥 = Chitas days in a row
- **Shabbos and Yom Tov never break a streak.** If you mark them done later, they count. If not, they're skipped, as if the day didn't exist.
- **Today doesn't break it until it's over.** If yesterday was done, your streak still shows, and the app reminds you to keep it going.
- **Catch up within 7 days.** Missed marking a day? Tap it in the week strip.
- No limit on how far back a streak counts (the old one stopped at 9).

### 3. Points ⭐ = simple and predictable
| You do | Points |
|---|---|
| Learn a Chitas section | **10** |
| Finish all 4 (a Chitas day) | **+10 bonus** |
| Extra learning (Daf Yomi, Hayom Yom…) | **5** |
| Quiz: each correct answer *(when real quizzes return)* | **5** |

A full Chitas day = **50 points**, and the app shows this rule in plain words ("How points work"). Points come from **one function** that compares a day before and after a change, so unmarking always takes back exactly what marking gave. Old points are kept; nobody loses what they earned.

### 4. Milestones instead of levels
Real achievements, celebrated once: **streak** and **Chitas days** at 3, 7, 18 (חי), 30, 50, 100, 180, 365. No bonus points, so they mean something.

### 5. One celebration per day
Confetti when the day completes, plus a moment when you reach a milestone. Level-up popups are gone.

### 6. Quizzes hidden until they're real
The fake questions are switched off with one setting (`QUIZZES_ENABLED`). They come back when the real AI quiz is connected.

## Home screen, top to bottom
1. Hebrew date, greeting, one helpful line ("Finish today to keep your 12-day streak")… then 🔥 streak and your avatar.
2. **Today card:** the 4-segment ring, "2 of 4 done", ⭐ points this week.
3. **7-day strip:** a filled dot = Chitas day, part-filled = some sections, 🕯 = Shabbos/Yom Tov. Tap to view or catch up a day.
4. The 4 section cards: tap to learn, ✓ to mark done.
5. Extra learning.

## Still to do (next steps)
- **Let people start learning before signing in** (Duolingo-style). This also helps the App Store, which requires Sign in with Apple.
- **Real quizzes**, plus a "quizzed" star on each segment.
- **Daily reminder notification** (needs the native app wrapper).
- **Friends / chavrusa groups** instead of a global leaderboard.
