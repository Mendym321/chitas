# Chitas Daily — Design

Read this before changing how anything looks or sounds. The full reasoning, the research and the mockups are in the design direction page (Oct 2026).

## The idea
The app should feel like **a well-made sefer, with a friend beside it who is glad you came**: reverent but warm, never a game and never a template. Every screen serves one of three jobs:
1. **Read it beautifully:** today's Chumash, Tehillim, Tanya and Rambam, laid out like the sefer.
2. **Stay accountable:** what's left today, gentle catch-up, years of learning adding up, Shabbos and Yom Tov built in.
3. **Remember it:** a short Review that sends you back to the text.

## Rules every screen follows
1. **The sefer is the design system.** Thin rules instead of boxes, centred headings with Hebrew numerals, the large opening word, the guide as a note in the margin.
2. **Ink on paper.** Warm paper, deep ink, high contrast. No gradients, no grey-on-grey, no tinted cards.
3. **Colour means something.** Each section has an ink, used only for its rule, glyph and tick. Gold is the main button and a finished day.
4. **One of everything.** One main button (gold), one quiet button (outline), one list row, one sheet, one label style. Six text sizes, two corner roundings.
5. **Text first, tools on request.** Controls stay out of the reading until asked for.
6. **A friend's voice.** Warm, brief, encouraging ("Nice!", "Keep it up!"), never scolding. Sentence case. No emoji; exclamation marks only when celebrating.
7. **Alive, not loud.** Warmth comes from the day itself and from the inks: the line under the greeting says what kind of day it is (Erev Shabbos, Rosh Chodesh, Yud-Tes Kislev, the Omer, the parsha); each section's glyph sits in a soft circle of its ink; a line of today's Hayom Yom; a little motion when you tick (the tick pops, a ring of its ink spreads, the day's line fills). Motion is short and stops for "reduce motion".
8. **Celebrate real things.** A small "Nice!" per section, one moment for the finished day, milestones for real accomplishments. No points or levels.

## Tokens (in `index.html`, `:root`)
| | |
|---|---|
| **Section inks** | `--c-chumash` ochre · `--c-tehillim` indigo · `--c-tanya` plum · `--c-rambam` olive. Code that builds colours (adds transparency to a hex) uses the mid tones `#C99A3A` `#5B7DB0` `#8E6AA3` `#6E9150`. |
| **Gold** | `--gold`: the main button and the finished day. |
| **Text** | `--t1` ink, `--t2` secondary, `--t3` captions. |
| **Text sizes** | `--fs-1` 12 · `--fs-2` 14 · `--fs-3` 16 · `--fs-4` 19 · `--fs-5` 24 · `--fs-6` 32. Reading text (Hebrew, English) has its own sizes. |
| **Corners** | `--r-s` 10 (controls) · `--r-m` 16 (cards, sheets) · 999 (pills). |
| **Fonts** | `--title-font` Crimson Pro for titles and names · `--read-font` Crimson Pro for English reading text · `--ui-font` DM Sans for small interface text · Hebrew: OT Siddur (Tehillim), Vilna (Tanya), Frank Ruhl (everything else). |

## Section glyphs (`SVG_ICONS`)
`torah` a Sefer Torah (Chumash) · `kinor` Dovid's kinor (Tehillim) · `flame` (Tanya) · `books` the 14 books of Mishneh Torah (Rambam) · `calendar` the Learning tab. One stroke weight (1.6). No stock icons for the sections.

## Buttons
`.btn-primary` gold, dark text: the one action that moves you forward (Mark as learned, Next). `.btn-quiet` outline: everything else (Review, Home). A finished state uses the quiet style. The reader's buttons follow these through `#chabad-mark-btn[data-state]`.

## The day's character (`js/day-note.js`)
`dayNote(date, parsha)` gives the parts of the line under the greeting, most important first, from the phone's Hebrew calendar (no network). Chabad spellings. Tested in `tools/test-day-note.mjs`.

## Toasts
Paper with ink text, never a black pill. `fire(msg, 'done')` adds a small gold tick, only when something was learned.

## Accountability
- **Streak** = Chitas days in a row. Shabbos and Yom Tov never break it; mark them afterwards and they count.
- **Catch up** any of the last 7 days; that keeps the streak.
- **Totals** grow forever (pesukim, chapters, halachos), shown beside the streak.
- **Learning page**: a month calendar with dates (gold circle = full day, a partly drawn ring = part of a day, a small sefer under Shabbos / Yom Tov). Tap a day to see it.
- **Milestones** (planned): 7, 30, 100, 365 days; a whole parsha; Sefer Tehillim; each book of Rambam and the cycle; the Tanya cycle.
- Points and the leaderboard were removed in Oct 2026 (`user.xp` is still stored so old data isn't lost, but never shown).

## Reminders and touch (planned)
At most one notification a day, only if the day isn't finished, never on Shabbos or Yom Tov. Location is asked only when someone turns on Shabbos quiet hours, as a city picked from a list. Three haptics in the whole app: a section learned, the day finished, a milestone.
