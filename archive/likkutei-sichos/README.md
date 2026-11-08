# Likkutei Sichos (and Sha'ar HaBitachon): kept for later

These readers were part of Chitas until November 2026, hidden from the menu
("parked"). They were taken out of the app before launch, to keep it small and
free of other people's servers. Nothing is lost: everything is here, and in
git history.

## What's in this folder

| File | What it is |
|---|---|
| `chitas-full-app-nov-2026.html` | The whole Chitas app the day before the readers came out, readers included. The easiest place to start: it is a working app. |
| `sichos-and-shaar-habitachon.js` | Just the two readers' code, cut out of the app as it was. |
| `sichos.css` | Their styles. |
| `sichos-markup.html` | The pop-up and the dictionary box they put on the page. |

The website never serves this folder (`.vercelignore` keeps it off).

## What the Likkutei Sichos reader needs

- **The sichos themselves** come from a Firebase project called `dach-dev`
  (the config is in the `.js` file, under "Firebase (dach.dev)"). It isn't
  Chitas's. Before building on it, ask its owner for permission, or move the
  texts into a database of your own.
- **Its dictionary** (tap a word, see its translation) is the `lsDict`
  collection in Chitas's own Firestore. It is still there; admins could add
  words.
- **Pasuk detection**: quotes from Tanach and Gemara are found in the text and
  their translation is fetched from Sefaria.
- **Fonts**: DachHeilig (`/fonts/Heilig.otf`, bold from dach.dev).
- **From the rest of Chitas** it used the reader frame (`#chabad-panel`,
  `_readerBegin`, the gear pop-up, `fire()` for messages, the colour tokens
  like `--card` and `--t1`). In a project of its own, those are the parts to
  bring along or replace.

## Sha'ar HaBitachon

Same file. Its text comes from Sefaria and its unit summaries from the
`shbSummaries` collection in Chitas's Firestore. It saved each person's place
as `shbProgress` in their user document.

## Starting a project of its own

1. Make a new GitHub repository (for example `likkutei-sichos`).
2. Copy this folder into it.
3. Open `chitas-full-app-nov-2026.html` and keep only what the reader needs, or
   start a fresh page and bring in the `.js`, `.css` and markup files.

Mishnah Yomi, the third parked reader, was a few lines (Sefaria's calendar plus
the shared bilingual reader) and is in the full app file too.
