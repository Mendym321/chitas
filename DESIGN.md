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
8. **One of each control.** Every segmented choice is the same bar (`.tz-seg`): Hebrew / Both / English in every reader and in the gear (`_langSeg`), and Automatic / Light / Dark. A choice in the gear keeps the gear open and moves its switch, whichever reader you're in. On/off options (Tanya's Guide and nekudos, Daf's Rashi and Tosafos) are the same chips, in the reader's colour (`--rc`). Colours come from the tokens, never a hex copied in (the old palette is gone from the core readers).
9. **Every reader starts clean.** The reader is one shared panel; `_readerBegin` resets its bottom bar each time, so nothing one sefer changes carries over to the next.

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
Chitas stays the main thing on Today. Below the four tiles and the Hayom Yom card: a small "MORE LEARNING" label (Beta, and Edit) over one card with a row for each sefer: a thin line in its reader's colour (Daf Yomi brick, Nach plum, Halacha teal, Likkutei Torah indigo), its name, today's piece, and its circle (filled in that colour when learned; weekly ones stay filled all week). No books, no icons: the colour is each sefer's identity, the same in the row, the Edit sheet, the Profile list and its reader, and no two share one (Hayom Yom's reader is ink, like its card on Today). Tap a row to learn it. With none yet, one row says what you can add. Edit opens the More learning sheet: the same rows with what each is and today's piece, and a switch. You mark a piece learned in its reader, like Chitas. No "next": any order. Offered (`OFFERED_TRACKS`): **Daf Yomi**, **Nach Yomi**, **Halacha Yomis** (Kitzur Shulchan Aruch Yomi) and the week's **Likkutei Torah** (Torah Ohr on Bereishis and Shemos). They never count toward the day's four rings or the streak.
- **Which piece, when:** `data/cycles.json` (each day's daf, chapter of Nach and Kitzur se'ifim, as Sefaria refs) and `data/likkutei-torah.json` (each parsha's maamarim, with opening words and minutes), made by `tools/generate-cycles.mjs` from Hebcal's schedules and Sefaria's export. No network to know today's piece; the text itself comes from Sefaria. The schedule runs to Sept 2030: run the generator again before then.
- **Marking:** the same rules as Chitas (today and the last 7 days). Likkutei Torah is weekly: marked any day of the week (Sunday to Shabbos), it shows learned all week, and your place in a maamar is kept for the week.
- **Readers:** Nach and Kitzur in Hebrew and English with verse / se'if numbers (Nach in Koren, like Tehillim).
- **Daf Yomi, like a page of Shas:** a running head ("מסכת בכורות · דף לה"), "דף לה ע״א / ע״ב" where each amud starts, מתני׳ and גמ׳ large, "הדרן עלך" centred; in Hebrew the Gemara runs on without rules. Rashi and Tosafos: the buttons show all of them, or tap a line (it has small רש״י / תוס׳ chips) to open just its own under it. Their dibbur hamaschil is bold. Rashi without English goes all the way across.
- **Likkutei Torah, like the printed Torah Ohr:** the week's list of maamarim (the header says Torah Ohr on Bereishis and Shemos): each with a ring that fills as you read (from your saved place in it), its percent and minutes left, a check when you've read to the end ("1 of 6 learned"), and "Last read" on the one you were in last. Each maamar keeps its own place for the week, so tapping any one continues it. X in a maamar goes back to the list; X there closes. Marking the week stays one button. Then a maamar in Heilig (`fonts/Heilig.otf`): running head, "פרשת …" title, the subject line in small type, a rule-and-dot ornament, opening words larger in the title's face (no bold: a bold Heilig is another font), the printed page numbers as small markers, paragraphs run on, the last line centred.
- **Odd days, said plainly:** Kinnim and Middos have no Gemara: their Vilna pages are the Mishnah, so Daf Yomi shows the mishnayos on each page (read off the Vilna Shas, Me'ilah 22 to Middos 37; Me'ilah 22 also has Kinnim's first perek), with a note where a daf starts or ends inside a mishnah; 30 Cheshvan and 30 Adar I have no Kitzur reading; 15 Elul's "Klalim" isn't on Sefaria; Shoftim has no section in Likkutei Torah. Hebcal's Adar II Kitzur table has four typos, fixed in the generator.
- Parked, still working for anyone who added them before: Mishnah Yomi, Likkutei Sichos, Sha'ar HaBitachon.

## Getting around from the reader
Top left in every reader is the menu (where the X was). It slides in from the left: the day you're reading (Today, Yesterday…), the four of Chitas with their circles and "Chitas · 2 of 4", then More learning, each row like Today's (a line in its colour, its name and piece, its circle); the one you're in says "Reading now". Tap one to go straight to it; Home at the bottom closes the reader. A swipe from the left edge opens it too, where the browser leaves the edge free (the installed app); a swipe across the text is still the day before / after. Escape or a tap outside closes it. Every reader that goes by the day (Chitas, Hayom Yom, Daf, Nach, Halacha) has the same day bar under its header, and a sideways swipe moves a day; the week's Likkutei Torah and the sefarim read at your own pace have neither. Hayom Yom on Today follows the day you're looking at.

## The streak on Today
"3 days in a row" (1 day in a row), a plain label in the chips row, not a button (Progress has its own tab). Not there at 0, nor away from today. One line, the same height as the other chips.

## Feedback and mistake reports
"Send feedback" in Profile and "Report a mistake in this text" in the reader's gear open one sheet: a message, an optional email to answer, Send. A mistake report also carries what was being read, the day and the first words on the screen. `/api/feedback` keeps it (feedback/, server only; no user id), emails it to chitas.daily@gmail.com through Resend when `RESEND_API_KEY` is set on Vercel, and lets one person send 10 a day. The admin page lists them, newest first.

## One look for the readers
Chumash, Tanya and Rambam are built from the same pieces, top to bottom:
1. Header: title and one line (Rambam: "Sales 13–15"), menu and gear.
2. Day bar, then the language switch.
3. Option chips in the reader's colour (`.tz-opt`): Chumash Guide, Rashi; Tanya Guide, נקודות; Rambam Guide. The Chumash translation is chosen in the gear.
4. A printed-page heading (`.tz-head`): the book above, the big Hebrew word (Chumash: the aliyah, שלישי; Tanya: פרק מא; Rambam: פרק יג, at the top of each of the day's chapters), the English line under it.
5. The guide card (`.tz-guide`, white): Chumash "Today in the parsha", Tanya "So far in this chapter", Rambam "This chapter".
6. The text, English left and Hebrew right, with small numbers in the reader's colour (`.rd-vn`).
7. Commentary (Rashi) in the same card shape with a colour bar on the side (`.rd-comm`), so it never looks like the guide.

**Guide lines** for Chumash and Rambam are written ahead, one line per aliyah or chapter, from the text itself: `data/guides/chumash.json` ("Vayera 3") and `data/guides/rambam.json` ("Sales 13"). Each aliyah and each Rambam chapter is read in full before its line is written (not only its opening). Written in batches and reviewed before they go in; a day without a line simply shows no card and no Guide chip. Tanya's guide is made on demand by AI (see Tanya).

## Checking the look
`cd tools && npm run test:look` (`tools/check-look.mjs`) opens every reader's gear, Profile on a phone and Profile on a computer, in light and dark, and checks: every switch looks the same and shows one choice; Chumash and Rambam use the readers' shared pieces (heading, guide card, chips, numbers) and look the same; no home-made switch; the gear lists Language then Appearance; a new language keeps the gear open; every button has a name; Profile's two columns start on the same line; the sidebar sits beside the page. Add `-- --shots` for pictures in `tools/.look/`.

Run it with the other tests after any change to how something looks. When a new kind of control or screen comes in, add a rule for it here, so the next mismatch is caught by the check instead of by eye.

## Light and dark
Appearance is Automatic, Light or Dark, in Profile and in the reader's settings (the gear), so it can change without leaving the text. In the gear it comes after the options for the text (Text size, Language, the reader's own), because it changes the whole app. Automatic is the default: it follows the phone, also when the phone changes by itself in the evening. Light or Dark is kept on this phone; choosing Automatic again forgets it.

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

## Days, midnight and more than one device
- A day is the phone's own calendar date ("2026-10-26"), never worked out through UTC: in New York, UTC is already tomorrow after 8 pm.
- **The learning day starts at 4 am, not midnight.** Someone learning at 1 am is almost always finishing the day before, so until 4 am Today shows, marks and counts the previous day (`appNow()` in `js/progress.js`; every "what day is it" goes through it). Only real clock things use the plain time: reminders and the greeting.
- Always the phone's own time zone: travelling, the day follows the phone. Days are saved as plain dates, so they mean the same on every device.
- Today's marks live in `user.done` until the date moves on; then they are added to that day in the history (`archiveOldToday` in `js/progress.js`). Never skipped, never dropped.
- The app notices a new day even when it stays open (a check every minute, and on coming back to it).
- A mark or a Review result goes to the day it was for: from the reader, the day the reader shows, even when finished after midnight.
- Back in the app after a while, it first takes in what other devices saved (`syncFromCloud`): every mark either copy has is kept; where both have one, the cloud's later save wins.
- Tested on New York time in `tools/test-new-day.mjs` and `tools/test-midnight.mjs` (`npm run test:midnight`).

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

## Personal Tehillim
- **The chapter:** each person says the chapter for the year of life they're in, and moves to the next one on their Hebrew birthday (the Rebbe, born 11 Nissan 5662, says 125 from 11 Nissan 5786). An Adar birthday is kept in Adar II in a leap year. Worked out on the phone (`personalTehillimChapter` in `js/tehillim.js`), checked against Hebcal for 3000 birthdays in `tools/test-tehillim.mjs`. No internet is needed to know the chapter, only to download its text.
- **In the reader:** under the day's Tehillim, drawn with it. Each chapter fills in as it arrives (in Koren, cleaned like the day's), and it stays through every language change. Both is side by side, English left and Hebrew right, like Chumash.
- **The sheet:** the Rebbe and Rebbetzin each with the shared switch, then your people with today's chapter. Tap a person to change them. A birthday is a Hebrew date (day, month, year back to 5660; Adar I and II only in a leap year; only the days a month can have) or an English date with "Born after sunset". The form says what the date means ("Hebrew birthday 14 Adar II 5784. Says chapter 3 now.") and Add waits until a name and a whole date are in. Remove offers Undo.
- **Elul** (`elulTehillim` in `js/tehillim.js`): from 1 Elul to 9 Tishrei three more chapters a day (1–3 … 112–114), and on Yom Kippur 115–150 in four nines (before Kol Nidrei, before sleep, after Musaf, after Ne'ilah), as in Hayom Yom, 1 Elul. They come after the day's chapters, before Personal Tehillim, and are marked with them (one "Mark as learned"). The Today line says "Psalms 10–17 + Elul 4–6". Counted in the Tehillim chapters on Progress. Tested for every year to 5805.
- English in Both is 14.5px, as in Tanya.
- Tested in the browser by `tools/test-tehillim-app.mjs` (`npm run test:tehillim`).

## Sefiras HaOmer and Sotah
- **The days** (`js/omer.js`, tested against Hebcal for every year to 5805 in `tools/test-omer.mjs`): night 1 is the night before 16 Nissan, day 49 is 5 Sivan. Sotah: day 1 has no daf; day n is daf n (2 to 49). Worked out on the phone, no internet.
- **On Today**, from the first day of Pesach to Erev Shavuos, a card under the four: the day and its sefirah, "Count tonight" (night n, after nightfall), and Sotah with today's daf, its circle and how many of the 48 are learned (all 48: the siyum). Optional: not one of the four rings. Sotah lives here, not in More learning.
- **Count tonight** opens the words: the bracha, the count and the sefirah, in Hebrew and English, and what to do if you forgot (count by day without the bracha; after a whole day, go on without it). The 49 counts are in `js/omer-data.js`, made by `tools/generate-omer.mjs` from Hebcal in the Chabad siddur's spelling (לָעֹמֶר, שְׁלֹשָׁה). Read every line after making it.
- **"Tonight"** follows the learning day: at 1:30 am after night 1 it is still day 1, and the count shown is night 2.
- **The Sotah reader** has the head of a page of Shas ("מסכת סוטה · דף ח") with the day of the Omer under it.
- Tested in the browser by `tools/test-omer-app.mjs` (`npm run test:omer`).

## Reminders and touch
Ready for the app version (Capacitor); a browser never shows them. Profile has "On this phone" only inside the app.
- **Daily reminder** (`js/reminders.js`, tested in `tools/test-reminders.mjs`): at most one a day, at the time you pick (20:00 to start). Never on Shabbos or Yom Tov. The day before, an evening time comes at 12:00 instead, so it never lands after candle lighting (no location needed). Not today once today's Chitas is done. The phone holds the next two weeks; the app refreshes them when it opens and whenever you mark something. Kept on the phone, not in your account. Text: "Today's Chumash, Tehillim, Tanya and Rambam."
- **Touch feedback** (`haptic()`): three moments only. A section learned is a light tap; the day finished and a milestone are the phone's "success". On by default; a switch turns it off. In a browser only Android can do it.
- **The app needs** the plugins `@capacitor/haptics` and `@capacitor/local-notifications`. Nothing else changes: the code finds them when it runs inside the app.
