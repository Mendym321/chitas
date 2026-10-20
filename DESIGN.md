# Chitas Daily — Design

Read this before changing how anything looks or sounds. The full reasoning, the research and the mockups are in the design direction page (Oct 2026).

## The idea
**Direction C, "colour tiles"** (chosen Oct 2026, after comparing four directions on a design canvas): warm cream, big rounded tiles filled with each section's colour, four rings for the day (like Apple Fitness), a dark pill tab bar, and a chunky grotesque for titles. The reading itself stays like a sefer: Crimson Pro English beside the Hebrew. Every screen serves one of three jobs:
1. **Read it beautifully:** today's Chumash, Tehillim, Tanya and Rambam.
2. **Stay accountable:** what's left today, gentle catch-up, years of learning adding up, Shabbos and Yom Tov built in.
3. **Remember it:** a short Review that sends you back to the text.

## Rules every screen follows
1. **Colour is the life.** Each section owns a colour (`--c-<id>`) and the text/icons on it (`--on-<id>`). Its tile, its rings, its reader header and its main button are that colour. Everything else is cream and ink.
2. **Big, rounded, few.** Tiles 26px corners, cards 22px, pills for buttons and chips. Few things per screen (choice overload).
3. **The day is four rings.** Today's header rings, the week strip and the calendar all draw a day as the same four parts, so you read progress the same way everywhere.
4. **Any order.** No "up next" or suggested order: people learn the four in whatever order they like.
5. **Quiet voice.** Plain facts ("Tanya and Rambam left", "86 days of Chitas"). No pep talk. A small "Nice! X done." when you tick, a real moment only when the day is finished or a milestone is reached. No emoji.
6. **Celebrate real things.** The day finished: a full dark screen with the four rings closing. Milestones for real accomplishments. No points or levels.
7. **Text first in the reader.** Controls stay out of the reading until asked for.

## Tokens (in `index.html`, `:root`)
| | |
|---|---|
| **Section colours** | `--c-chumash` amber · `--c-tehillim` blue · `--c-tanya` purple · `--c-rambam` green, with `--on-<id>` for text on them. |
| **Ink** | `--ink` / `--on-ink`: the tab bar, the streak chip, the main button outside the reader. |
| **Text** | `--t1` ink, `--t2` secondary, `--t3` captions. |
| **Text sizes** | `--fs-1` 12 · `--fs-2` 14 · `--fs-3` 16 · `--fs-4` 19 · `--fs-5` 24 · `--fs-6` 32; page titles 34. |
| **Corners** | `--r-s` 12 · `--r-m` 22 (cards, sheets) · `--r-l` 26 (tiles) · 999 (pills). |
| **Fonts** | `--ui-font` / `--title-font` Bricolage Grotesque · `--read-font` Crimson Pro for English reading · Hebrew: OT Siddur (Tehillim), Vilna (Tanya), Frank Ruhl (everything else). |

## Landing and loading
- **Loading:** on dark, the four rings chase each other (`#app-loader`).
- **Landing (L2a):** on dark, the four rings close one by one and each section's name appears under "Chitas"; "Start today" and "I have an account". No tagline: the rings and names say it.

## Section glyphs (`SVG_ICONS`)
`torah` a Sefer Torah (Chumash) · `kinor` Dovid's kinor (Tehillim) · `flame` (Tanya) · `books` the 14 books of Mishneh Torah (Rambam) · `chart` the Progress tab · `calendar` the date chip. One stroke weight (1.6). No stock icons for the sections.

## Buttons
Pills. `.btn-primary` ink: the one action that moves you forward. In the reader the main button (`#chabad-mark-btn`, Next) takes the section's colour through `--rc` / `--rc-on`, set by `_setReaderColour()`. `.btn-quiet` cream: everything else (Review, Home); a finished state uses it.

## The day's character (`js/day-note.js`)
`dayNote(date, parsha)` gives the parts of the line under the greeting, most important first, from the phone's Hebrew calendar (no network). Chabad spellings. Tested in `tools/test-day-note.mjs`.

## Toasts
Cream card with ink text, never a black pill. `fire(msg, 'done')` adds a small gold tick, only when something was learned.

## Accountability
- **Streak** = Chitas days in a row. Shabbos and Yom Tov never break it; mark them afterwards and they count.
- **Catch up** any of the last 7 days; that keeps the streak.
- **Any day can be read** (about a year back, two months ahead) from the calendar on Today's date chip, or by swiping the tiles. Only today and the last 7 days can be marked; other days say "Read only" or "Ahead of today".
- **Totals** grow forever (pesukim, chapters, halachos), shown beside the streak.
- **Progress tab** (chart icon): two stat tiles (streak, 30-day %), a month calendar where each date is the four-part ring (a small sefer under Shabbos / Yom Tov; tap a day to see it), and a colour tile per section with its total, what it means, and how far through the whole (the Torah, Tehillim, Mishneh Torah).
- **Motivation model.** Reward finishing (the four rings, the day complete), showing up (the streak; Shabbos and Yom Tov never break it, quietly), learning adding up (Progress totals), and real milestones. No points, levels, leaderboards, pep talk or suggested order.
- **Milestones**, each celebrated once (`user.milestones` keeps the keys):
  - Streak: 3, 7, 18, 30, 50, 100, 180, 365, 500, 1000 days (`js/progress.js`).
  - Learning (`learningMilestone` in `js/learning-stats.js`): a whole parsha (all 7 aliyos in its week), all of Sefer Tehillim in a month, 100 / 250 / 500 chapters of Rambam and all of Mishneh Torah, 50 / 100 / 200 / 365 days of Tanya.
- The streak chip opens Progress (no separate pop-up).
- **Next:** a quiet "welcome back" after a missed day; reminders.
- Points and the leaderboard were removed in Oct 2026 (`user.xp` is still stored so old data isn't lost, but never shown).

## Reminders and touch (planned)
At most one notification a day, only if the day isn't finished, never on Shabbos or Yom Tov. Location is asked only when someone turns on Shabbos quiet hours, as a city picked from a list. Three haptics in the whole app: a section learned, the day finished, a milestone.
