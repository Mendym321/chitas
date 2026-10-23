# Chitas — Design

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

## Review
The header and the main button take the section's colour (like the reader). The right answer is filled in that colour; a wrong pick is struck through. No red or green.

Review is the step after learning, shown where you are, never pushed:
- **Right after you learn** (marking a section in the reader, today): "While it's fresh: 4 questions on what you just learned", with Deep dive and Home beside it.
- **On Today:** a learned section's tile says "Review · 4", then "Reviewed 3/4". A card under the tiles lists what's ready.
- **Results:** the score as a ring, then "What you learned today": each answer with the line it's from. A missed one has "Read it again", which opens the text at that line.
- **Progress, "What stays with you":** % right week by week (each week named by its parsha), by section for the last 30 days, and all-time totals (`reviewStats` in `js/learning-stats.js`). It shows nothing until your first review.
- Results are saved as `{ r, n }` (right, out of how many), per section, level and day, in `quizDone` and `pastQuizDone`.

## Footnotes
Rambam and Tanya footnotes are small raised numbers in a soft section colour, no box; the open one is underlined.

## More learning (beta)
Below Today's four tiles and the Hayom Yom card, under "More learning" with a Beta chip. Offered (`OFFERED_TRACKS`): **Daf Yomi**, **Nach Yomi**, **Halacha Yomis** (Kitzur Shulchan Aruch Yomi) and the week's **Likkutei Torah** (Torah Ohr on Bereishis and Shemos). They never count toward the day's four rings or the streak.
- **Which piece, when:** `data/cycles.json` (each day's daf, chapter of Nach and Kitzur se'ifim, as Sefaria refs) and `data/likkutei-torah.json` (each parsha's maamarim, with opening words and minutes), made by `tools/generate-cycles.mjs` from Hebcal's schedules and Sefaria's export. No network to know today's piece; the text itself comes from Sefaria. The schedule runs to Sept 2030: run the generator again before then.
- **Add learning sheet:** one card of rows (coloured icon, name, what it is with today's piece, an Add / Added pill), like the design canvas's Y-Add.
- **Marking:** the same rules as Chitas (today and the last 7 days). Likkutei Torah is weekly: marked any day of the week (Sunday to Shabbos), it shows learned all week, and your place in a maamar is kept for the week.
- **Readers:** Nach and Kitzur in Hebrew and English with verse / se'if numbers (Nach in Koren, like Tehillim). Daf Yomi keeps its Rashi and Tosafos toggles. Likkutei Torah opens on the week's list of maamarim; a maamar is Hebrew only, in Vilna (like Tanya).
- **Odd days, said plainly:** Kinnim and Middos have no Gemara: their Vilna pages are the Mishnah, so Daf Yomi shows the mishnayos on each page (read off the Vilna Shas, Me'ilah 22 to Middos 37; Me'ilah 22 also has Kinnim's first perek), with a note where a daf starts or ends inside a mishnah; 30 Cheshvan and 30 Adar I have no Kitzur reading; 15 Elul's "Klalim" isn't on Sefaria; Shoftim has no section in Likkutei Torah. Hebcal's Adar II Kitzur table has four typos, fixed in the generator.
- Parked, still working for anyone who added them before: Mishnah Yomi, Likkutei Sichos, Sha'ar HaBitachon.

## App icon
The four rings, full and large, on cream (`icons/icon.svg`, rendered to PNGs). A plain square with no rounded corners and no see-through parts: the phone rounds the corners itself, and the App Store turns down icons that are already rounded or transparent.
- `icon-maskable.svg`: the rings a little smaller, inside the middle 80%, because Android may crop the icon to a circle.
- `favicon.svg` / `icon-32.png`: the browser tab. Thicker rings fill the square so the four colours still read at 16–32px; rounded corners, see-through outside them.

## On a computer (1000px and wider)
The same app, laid out for the screen (one `@media (min-width: 1000px)` block at the end of the styles): a sidebar instead of the bottom pill, Today's tiles in one row, the reader's text in a page-wide column (about 900px, so lines stay readable), Progress in two columns, pop-ups as centred boxes. Below 1000px nothing changes. Everything on a page spans the same width as the tiles; Profile flows into two columns; the reader's text lines up with its header and buttons.

## Your place in the reader

The reader shows one piece of learning at a time: one section on one day. Each piece has one saved place: the passage at the top of the screen, which copy of it, and how far into it. Pixels alone break when the page changes height. Three rules (in `index.html`, "What the reader shows"):

1. **One owner.** Only the piece on screen may draw into the reader or move it. A text that arrives for a section or day you've left is kept for later, never drawn.
2. **Saved only when it's yours.** A place is saved only for the piece on screen, only once its text is in and put back, and only after you've touched it. It's saved when you stop scrolling, and at once when you close, switch, or the app goes out of view.
3. **Put back, and held.** The text goes back to your passage, and stays there for a few seconds while fonts, the Tanya guide or Tehillim names settle in. The moment you touch it, nothing moves it.

Texts are kept by section and day (`_textFor`), so yesterday's text can never be shown, counted or reviewed as today's. The page behind the reader doesn't scroll while it's open. Tests: `tools/test-reader-place.mjs` (`npm run test:place`) uses the reader the way a person does, with slow answers on purpose.

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
- **Milestones**, each celebrated once (`user.milestones` keeps the keys), and they **follow the cycles**, so they come back every year:
  - Streak: 3, 7, 18, 30, 50, 100, 180, 365, 500, 1000 days (`js/progress.js`).
  - Chumash: each parsha (Sunday to Friday learned); each book at its last parsha; the whole Torah at V'zos Habrachah.
  - Tehillim: all of Sefer Tehillim in a month.
  - Rambam (3-chapter and 1-chapter tracks): each of the 14 books on its last day, and the Siyum at the end of Sefer Shoftim. The book dates come from Hebcal (`RAMBAM_BOOK_SPANS` in `js/learning-data.js`, made by `tools/generate-learning-data.mjs`).
  - Tanya: each part (Likkutei Amarim … Kuntres Acharon) when the next day's portion starts a new one, and all of Tanya at the end of Kuntres Acharon (`_tanyaPartMilestone`, from the day's portion).
  - Finished = you reached the end and learned most of it; it says honestly how much ("28 of its 30 days", "on 230 days"). Under half: no milestone.
- The streak chip opens Progress (no separate pop-up).
- **Welcome back** (`welcomeBack` in `js/progress.js`): after a break, a quiet card under the tiles, once a day, with "Catch up yesterday" when it's still in the 7-day window.
- **Next:** reminders (native app).
- Points and the leaderboard were removed in Oct 2026 (`user.xp` is still stored so old data isn't lost, but never shown).

## Reminders and touch (planned)
At most one notification a day, only if the day isn't finished, never on Shabbos or Yom Tov. Location is asked only when someone turns on Shabbos quiet hours, as a city picked from a list. Three haptics in the whole app: a section learned, the day finished, a milestone.
