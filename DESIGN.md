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
10. **One label, one gap, one header.** Every small section heading (Today, the ☰ menu, the gear, every pop-up, Profile, Progress) is the same label: 12px, heavy, small capitals, `--t3` (`.lbl` and the rule beside it). On Today, blocks sit 20px apart (16px between the cards under the tiles) and 28px before a labelled section. Every pop-up opens with the same header: title, a grey line under it, a round × on the right (the calendar too; its Today button sits under the month). A name is spelled one way everywhere (`parshaSpelling`, `_chumashLine`: Chayei Sarah, Aliya). Quiet controls stay quiet: removing a track is a grey bin, as it keeps its history.

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
Chitas stays the main thing on Today. Below the four tiles and the Hayom Yom card: a small "MORE LEARNING" label (Beta, and Edit) over small tiles, two across, a lighter kin of Chitas's: each tinted in its reader's colour (Daf Yomi brick, Nach plum, Halacha teal, Likkutei Torah indigo), with a short line in that colour, its name and today's piece, and in its corner the same box as on Chitas's tiles: tap it to mark it learned for the day (or unmark), without opening it. A learned tile goes quieter, its box filled in its colour (weekly ones stay filled all week). Where a day can't be marked, a learned one just shows its check. No books, no icons: the colour is each sefer's identity, the same in the row, the Edit sheet, the Profile list and its reader, and no two share one (Hayom Yom's reader is ink, like its card on Today). Tap a tile to learn it. With none yet, one row says what you can add. Edit opens the More learning sheet: the same rows with what each is and today's piece, and a switch. You mark a piece learned in its reader or with its box, like Chitas. No "next": any order. Offered (`OFFERED_TRACKS`): **Daf Yomi**, **Nach Yomi**, **Halacha Yomis** (Kitzur Shulchan Aruch Yomi) and the week's **Likkutei Torah** (Torah Ohr on Bereishis and Shemos). They never count toward the day's four rings or the streak.
- **Which piece, when:** `data/cycles.json` (each day's daf, chapter of Nach and Kitzur se'ifim, as Sefaria refs) and `data/likkutei-torah.json` (each parsha's maamarim, with opening words and minutes), made by `tools/generate-cycles.mjs` from Hebcal's schedules and Sefaria's export. No network to know today's piece; the text itself comes from Sefaria. The schedule runs to Sept 2030: run the generator again before then.
- **Marking:** the same rules as Chitas (today and the last 7 days). Likkutei Torah is weekly: marked any day of the week (Sunday to Shabbos), it shows learned all week, and your place in a maamar is kept for the week.
- **Readers:** Nach and Kitzur in Hebrew and English with verse / se'if numbers (Nach in Koren).
- **Daf Yomi, like a page of Shas:** a running head ("מסכת בכורות · דף לה"), "דף לה ע״א / ע״ב" where each amud starts, מתני׳ and גמ׳ large, "הדרן עלך" centred; in Hebrew the Gemara runs on without rules. Rashi and Tosafos: the buttons show all of them, or tap a line (it has small רש״י / תוס׳ chips) to open just its own under it. Their dibbur hamaschil is bold. Rashi without English goes all the way across.
- **Likkutei Torah, like the printed Torah Ohr:** the week's list of maamarim (the header says Torah Ohr on Bereishis and Shemos): each with a ring that fills as you read (from your saved place in it), its percent and minutes left, a check when you've read to the end ("1 of 6 learned"), and "Last read" on the one you were in last. Each maamar keeps its own place for the week, so tapping any one continues it. X in a maamar goes back to the list; X there closes. Marking the week stays one button. Then a maamar in Heilig (`fonts/Heilig.otf`): running head, "פרשת …" title, the subject line in small type, a rule-and-dot ornament, opening words larger in the title's face (no bold: a bold Heilig is another font), the printed page numbers as small markers, paragraphs run on, the last line centred.
- **Odd days, said plainly:** Kinnim and Middos have no Gemara: their Vilna pages are the Mishnah, so Daf Yomi shows the mishnayos on each page (read off the Vilna Shas, Me'ilah 22 to Middos 37; Me'ilah 22 also has Kinnim's first perek), with a note where a daf starts or ends inside a mishnah; 30 Cheshvan and 30 Adar I have no Kitzur reading; 15 Elul's "Klalim" isn't on Sefaria; Shoftim has no section in Likkutei Torah. Hebcal's Adar II Kitzur table has four typos, fixed in the generator.
- Taken out before launch (Nov 2026), kept in `archive/likkutei-sichos/`: Likkutei Sichos, Sha'ar HaBitachon, Mishnah Yomi. Anyone who had added one simply doesn't see it.

## Getting around from the reader
Top left in every reader is the menu (where the X was). It slides in from the left. At the top, only ✕; under it the day (Today, Yesterday, Wednesday…) with its date and Hebrew date, ‹ › on either side to step a day, and under that, centred, Calendar (the month, any day) and Today (only on another day). They move the reader to that day; ‹ › and Today keep the menu open on it, a day picked in the calendar opens in the reader. Then "Chitas · 2 of 4 learned" and the four, always in the same order, each just its name and piece, and a › (no icons or dots: they looked cheap; the colour is in the check and in the row you're reading) (it opens); a learned one is quieter with a check in its colour, and still opens (no circles: they looked like boxes to tick). Right under the four, with no heading of its own, Hayom Yom (it's on Today for everyone), and Sotah during the Omer. Then More learning, the same way: the sefarim you added. The pane on a computer lists the same. The one you're in says "Reading now". Tap one to go straight to it; Home at the bottom closes the reader. A swipe from the left edge opens it too, where the browser leaves the edge free (the installed app); a swipe across the text is still the day before / after. Escape or a tap outside closes it. Every reader that goes by the day (Chitas, Hayom Yom, Daf, Nach, Halacha) has the same day bar under its header, and a sideways swipe moves a day; the week's Likkutei Torah and the sefarim read at your own pace have neither. Hayom Yom on Today follows the day you're looking at.

**Swiping to another day** (a phone, in a reader that goes by day): the page follows your finger, and the other day comes in beside it as a page of its own, its name and date ("Yesterday, Monday Nov 2 · 22 Cheshvan") over faint lines, since its text is only fetched once you've chosen it. Let go past a quarter of the width, or flick, and it finishes: that day's text opens under it and the page fades away. Let go before and it springs back. Past the last day you can go to, the page only gives a little. A swipe from the very left edge is still the menu. The day bar's ‹ › use the same names (`_dayName`).

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
7. Commentary (Rashi) on a soft card under its verse (`.rd-comm`), with no label and no colour bar: it's the only commentary, and its bold opening words say it's Rashi, as in a printed chumash.

- **The reader's bottom button follows the day on screen** (`_setMarkBtn`, tested in `tools/test-mark-days.mjs`), not today: today, "Mark as learned" or a quiet "Learned"; a past day you learned, no button, a small line "✓ You learned this on Wednesday"; a past day you missed, within the last week, "Catch up · Mark Wednesday as learned", and after it the next step (the next missed day, or today); further back, read only. Chitas and More learning alike.

**When Sefaria doesn't send part of the day.** Rashi is always asked for as a verse range, chapter by chapter ("Rashi on Genesis 20:1-150"): asked for whole ("Rashi on Genesis 20"), Sefaria sends a chapter that shows nothing. Whatever still doesn't come, the reader says so under the heading ("Some of today's Rashi didn't load. Try again"), never just showing less (`tools/test-chumash-rashi.mjs`).

**Guide lines** for Chumash and Rambam are written ahead, one line per aliyah or chapter, from the text itself: `data/guides/chumash.json` ("Vayera 3") and `data/guides/rambam.json` ("Sales 13"). Each aliyah and each Rambam chapter is read in full before its line is written (not only its opening). Written in batches and reviewed before they go in; a day without a line simply shows no card and no Guide chip. Tanya's guide is written ahead too, in batches, where possible: `api/_lib/tanya-written-data.js`, one entry per day's portion ("Iggeret HaKodesh 29|1|8"), by the same rules the AI follows (`SYSTEM` in `api/_lib/tanya-guide.js`): small pieces cut at the first words of each, headings for the flow, an intro or recap, a summary. The server cuts it into the live text exactly as it would the AI's answer; if any cut isn't found, that day is made by the AI as before, so a written guide can never show broken text. Past the last written day, the AI makes it on demand, once per portion, shared by everyone. A batch is checked before it goes in: every cut found, pieces of about 5 to 15 English words.

- **Rambam headings** (`data/guides/rambam-heads.json`): under the Guide, small headings in Rambam's colour that show how the chapter moves, like Tanya's flow headings ("The main rule: better or worse than said", "A bigger mistake: the wrong kind", "One more example"), each before the halacha where that step starts. Their job is to help you keep track through one or three chapters. A few to a chapter, plain words, written from the whole chapter like the "This chapter" lines. The Guide switch hides them with the line.

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
The same app, laid out for the screen (one `@media (min-width: 1000px)` block at the end of the styles): a day pane instead of the bottom pill, the same on Today and in the reader (paper like the page: the logo, Home and Progress as small words; the day you're on as a heading with a calendar and ‹ › beside it, a thin bar of the four in their colours, and "Back to today" when you're away; then the day's learning, names and pieces, a check in its colour when learned, the open one highlighted, a click opens it; you at the foot, which opens Profile; `_renderSideList`, `_paneDay`, `_paneOpen`). Reading, the text sits beside the pane under a solid banner (no rounded corners), with no ☰ and no day bar: the pane has both. Back to Today: Home at the top of the pane (it says Home here; the day heading under it says Today), the logo, or Esc (which first closes the gear or a pop-up if one is open). "Hide" or the [ key folds the pane away for reading; a pill with the list icon and the day ("≡ Today · 1 of 4", on a card, plainly a button) brings it back; remembered on the device. Today has no chips row here: the parsha (or what kind of day it is) is a quiet line under the title (`#app-sub`), and the week runs across the page, each day with its date (the pane has the day and the calendar). The phone is unchanged, Today's tiles in one row, the reader's text in a page-wide column (about 900px, so lines stay readable), Progress in two columns, pop-ups as centred boxes. Below 1000px nothing changes. Everything on a page spans the same width as the tiles; Profile flows into two columns; the reader's text lines up with its header and buttons.

## Your place in the reader

The reader shows one piece of learning at a time: one section on one day. Each piece has one saved place: the passage at the top of the screen, which copy of it, and how far into it. Pixels alone break when the page changes height. Three rules (in `index.html`, "What the reader shows"):

1. **One owner.** Only the piece on screen may draw into the reader or move it. A text that arrives for a section or day you've left is kept for later, never drawn.
2. **Saved only when it's yours.** A place is saved only for the piece on screen, only once its text is in and put back, and only after you've touched it. It's saved when you stop scrolling, and at once when you close, switch, or the app goes out of view.
3. **Put back, and held.** The text goes back to your passage, and stays there for a few seconds while fonts, the Tanya guide or Tehillim names settle in. The moment you touch it, nothing moves it.

**On every device.** Signed in, your places go with your account: read halfway on the laptop, open on the phone at the same words (a place is words, not pixels, so a different width doesn't matter). Each place is its own field in `places` on your user document, written and removed one by one (`_fb.savePlaces`, `updateDoc` on one field), so it can never touch your progress, and the database rules don't change. The newer place, here or there, is used; "at the top" is a dated place too, so marking learned opens it at the top everywhere. Sent when you close, switch or leave the app, and at most every 10 seconds while you scroll; they come with your account when the app opens, and live after that (the same watch as your marks), so the next text you open opens where your other device left it, no reload. A text that's already open never jumps: if your other device is further on in it (more than about a screen), a quiet "Continue from your other device" appears above the bottom bar; tap it to go there, or scroll and it goes (it also fades after a few seconds). A place waiting to be sent loses to a newer one from the account. Places from more than a week ago are removed once a session. Signed out, they stay on the phone. Tests: `tools/test-place-sync.mjs` (`npm run test:placesync`, two devices, one account) and `tools/test-rules.mjs` (the real writes against the rules).

**Your reading choices, on every device.** Signed in, the choices you make in the readers follow you too: each reader's language, the Chumash and Tehillim translations, Rashi and the guides, Tanya's nekudos, Daf Yomi's commentary, the Omer's language, Hayom Yom's language. Each is its own dated field in `prefs` on your user document (`_fb.savePrefs`, like places), and the newest wins. A choice goes up a moment after the tap that made it, or when you leave the app; it comes with your account when the app opens or comes back (`_cloudPrefsIn`). A device's choices from before this existed count as old, so a new device takes your account's. A choice that arrives for the reader you have open draws it again at once, quietly, on the same words (`_redrawForPrefs`); a choice for another reader waits until you open it. Text size, light/dark and reminders stay with the device (they belong to its screen). Tests: `tools/test-prefs-sync.mjs` (`npm run test:prefsync`) and `tools/test-rules.mjs`.

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
- **Marks are kept by date, on every device, live.** Every mark lives under its date (`days`, and Review results in `reviews`; `js/progress.js`: "Marks by date"); "today" is just today's date in it, so nothing moves or is saved at 4 am. Each mark is saved on its own, as one field (`_fb.setMark`), so two devices never overwrite each other's marks; the full save (settings, totals) carries no marks at all. Every signed-in device watches the account (`_watchCloud`) and redraws when any device marks or un-marks something. Firestore keeps its own offline copy, so marks made without internet are sent when back online. Older saved formats (done + lastDate + pastDone) are read into the record (`daysFrom`), and marks only one device had are sent up once.
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
- **In the reader:** under the day's Tehillim, drawn with it. Each chapter fills in as it arrives (in the same translation as the day's, cleaned the same way), and it stays through every language change. Both is side by side, English left and Hebrew right, lined up passuk by passuk with no rules between them (one running paragraph each let the two sides drift apart).
- **Translation** (the reader's gear): Rabbi Shraga Silverstein (The Rashi Ketuvim) by default, or Koren. Silverstein weaves Rashi's explanation into the verse in [brackets] and (parentheses); the verse is shown in bold and his additions in regular weight, without the brackets, as the Rambam reader shows the translator's additions (grey was too faint, in light and dark). Koren is shown as it is. The English in Both is in the main ink (it was the secondary grey).
- **Text size** (the gear): the printed-page headings (chapter numbers, the day line, Tanya's and Rambam's headings) grow and shrink with the text, through `--rf-scale`, so a large text never sits under a small heading. Sefaria's copy has "L rd" and "G d" with the hyphen lost; they're shown as L-rd and G-d. Changing it loads the day's and the personal chapters again, keeping your place.
- **The sheet:** the Rebbe and Rebbetzin each with the shared switch, then your people with today's chapter. Tap a person to change them. A birthday is a Hebrew date (day, month, year back to 5660; Adar I and II only in a leap year; only the days a month can have) or an English date with "Born after sunset". The form says what the date means ("Hebrew birthday 14 Adar II 5784. Says chapter 3 now.") and Add waits until a name and a whole date are in. Remove offers Undo.
- **Elul** (`elulTehillim` in `js/tehillim.js`): from 1 Elul to 9 Tishrei three more chapters a day (1–3 … 112–114), and on Yom Kippur 115–150 in four nines (before Kol Nidrei, before sleep, after Musaf, after Ne'ilah), as in Hayom Yom, 1 Elul. They come after the day's chapters, before Personal Tehillim, and are marked with them (one "Mark as learned"). The Today line says "Psalms 10–17 + Elul 4–6". Counted in the Tehillim chapters on Progress. Tested for every year to 5805.
- English in Both is 15.5px (Tanya's is 14.5px); the chapter number is a little bigger than the text (28px Hebrew over 21px), not much. The Hebrew verse letters sit on the line, small, as in a printed Tehillim (the English numbers stay raised).
- Tested in the browser by `tools/test-tehillim-app.mjs` (`npm run test:tehillim`).

## Sefiras HaOmer and Sotah
- **The days** (`js/omer.js`, tested against Hebcal for every year to 5805 in `tools/test-omer.mjs`): night 1 is the night before 16 Nissan, day 49 is 5 Sivan. Sotah: day 1 has no daf; day n is daf n (2 to 49). Worked out on the phone, no internet.
- **On Today**, from the first day of Pesach to Erev Shavuos, a card under the four: the day and its sefirah, "Count tonight" (night n, after nightfall), and Sotah with today's daf and how many of the 48 are learned (all 48: the siyum); tap it to read, and the box marks the daf learned, like More learning's tiles. Optional: not one of the four rings. Sotah lives here, not in More learning.
- **Count tonight** opens the words as in the Chabad siddur (Tehillas Hashem): the bracha, the count, the night's line (its word in Ana Bekoach, its sefirah, its word in Lamenatzeach, its letter of ישמחו), then after counting Harachaman, Lamenatzeach and Ana Bekoach with the night's word marked, Baruch Shem, and Ribono shel Olam with the night's sefirah said in its place. Hebrew, or Both with our own English under each piece (remembered). At the end, what to do if you forgot (count by day without the bracha; after a whole day, go on without it).
- **The text** is `tools/data/sefirah-tehillas-hashem.txt` (from Sefaria); `tools/generate-omer.mjs` makes `js/omer-data.js` from it (fixing two typos: nights 25 and 39). `tools/test-omer.mjs` checks that for every night the marked words are the ones the siddur's line names, and that the letters spell ישמחו.
- **"Tonight"** follows the learning day: at 1:30 am after night 1 it is still day 1, and the count shown is night 2.
- **The Sotah reader** has the head of a page of Shas ("מסכת סוטה · דף ח") with the day of the Omer under it.
- Tested in the browser by `tools/test-omer-app.mjs` (`npm run test:omer`).

## Sefer HaMitzvos
- **The day** (`js/sefer-hamitzvos.js`): the 339-day cycle that runs with the 3-chapter Rambam, from 29 April 1984, worked out on the phone from Hebcal's list (`js/sefer-hamitzvos-data.js`, made by `tools/generate-sefer-hamitzvos.mjs`). The mitzvos keep their order (day 13 is N10, N47 … P186, N23, N24). Days that aren't mitzvos (the introduction, the Principles, the prayers, the Haggadah, Megillah and Chanukah) are named. `tools/test-sefer-hamitzvos.mjs` checks every day 2026–2045 against Hebcal.
- **Our own text** (`data/sefer-hamitzvos.json`, written ahead in batches like the guide lines): for each mitzvah its name, verse, a two-sentence digest and where it is (parsha, Rambam), then the whole text in our own plain English ("We are forbidden to…", Hebrew terms in italics, explained once) beside Ibn Tibbon's Hebrew, the only free Hebrew, tidied (punctuation, paragraphs that match the English, abbreviations spelled out). Each text is checked against the Hebrew line by line; a clear misprint is corrected and listed under "changes". Two rules from checking against Chabad.org's translation: translate what a word means here, not its dictionary sense (כולל: "sums up", not "covers"; סמכו לכתוב: "found support in a verse"); and when a short verse quote would mislead or leave "him" unclear on its own, give its context in [brackets] ("[If a man injures his fellow,] as he has done, so shall be done to him"). Not Kehot's or Rav Kafich's, which are copyrighted.
- **The reader**: the printed-page heading (ספר המצוות · מצות לא תעשה רנא), the digest card, then the text with no tap. A day that repeats yesterday's mitzvah says so. A mitzvah we haven't written yet shows Ibn Tibbon's Hebrew from Sefaria, in paragraphs, with a note. Tested by `tools/test-shm-app.mjs` (`npm run test:shm`).

## Reminders and touch
Ready for the app version (Capacitor); a browser never shows them. Profile has "On this phone" only inside the app.
- **Reminders** (`js/reminders.js`, tested in `tools/test-reminders.mjs`; Profile → Reminders): people learn each part at its own time ("Tanya in the morning, Rambam in the afternoon"), so each section has its own reminder: off, or a time, picked from Morning (07:00), After Shacharis (08:30), Afternoon (15:00), Evening (20:30) and then adjusted. Fixed times, nothing worked out from sunrise. Helpful, never guilt: a reminder says what's waiting ("Tehillim · Psalms 88–89", "Rambam · Sales 16–18") and a tap opens it; never "don't break your streak". Sections at the same time come as one. None for a section already learned that day. Never on Shabbos or Yom Tov; the day before, only reminders up to 12:00 go, and a later one doesn't go at all (it would ring on Shabbos; you still learn then, and mark it after). The phone holds the next two weeks, refreshed when the app opens and when you mark something. Kept on the phone, not in your account. An old single reminder becomes all four at its time.
- **In its season**: Counting the Omer, off unless chosen: "Count tonight: night 9 · Gevurah shebiGevurah" at your time during Sefirah, not on a night that is Shabbos or Yom Tov; a tap opens the count. In Elul the Tehillim reminder simply says "Psalms 10–17 + Elul 4–6".
- **A reminder that doesn't fit**: if its section wasn't learned on any of the last 7 learning days, Today asks once, kindly, whether another time would suit better ("Change it" / "Keep it"), and not again for a month.
- **Touch feedback** (`haptic()`): three moments only. A section learned is a light tap; the day finished and a milestone are the phone's "success". On by default; a switch turns it off. In a browser only Android can do it.
- **The app needs** the plugins `@capacitor/haptics` and `@capacitor/local-notifications`. Nothing else changes: the code finds them when it runs inside the app.

**Hayom Yom's reader looks like the printed page.** The day's line between two rules, as the book prints it: the date in the middle, and beside it that day's weekday and year in the book's own calendar (19 Kislev 5703 to 18 Kislev 5704: 23 Cheshvan is יום ראשון, ה׳תש״ד), never today's; the two dates that calendar didn't have (30 Cheshvan, 30 Kislev) show only the date. The weekday and year are `day` in `data/hayom-yom.json`, from `tools/generate-hayom-yom-days.mjs`. In Hebrew, or in English when reading English, (the day's line in Vilna, bold, like Dvar Malchus's), then the Hebrew in the Heilig face, justified (on a phone too, as in print), each paragraph's first line indented, no lines between paragraphs. The bracketed expansions in the source (צ"צ [צמח צדק]) are left out, as in print. Both: side by side like every reader, English on the left and Hebrew on the right, a paragraph against its paragraph (on a phone the columns' text is a little smaller and the Hebrew isn't stretched to the edge); when the paragraphs don't pair up, the whole English beside the whole Hebrew.

**The floating bar (phone).** What scrolls toward the dark bar at the bottom fades into the page first (a fade behind the bar, `#main-app::after`), so a dark button or text never meets the dark bar. Not on a computer (no floating bar there).

**Rambam's and Tanya's tiles name the day's piece.** As soon as the day's text is here (fetched in the background when the app opens, or when you open the reader), the tile says what it is: Rambam's chapters ("Gifts 6–8"), Tanya's chapter ("Iggeret HaKodesh · Epistle 29"), not the calendar's placeholder ("Daily Rambam") or only the date. Sefer HaMitzvos names itself. Moving to another day, the week's calendar is read for that day's own entries and the Rambam of your track (`parseHebcalForDate`).
