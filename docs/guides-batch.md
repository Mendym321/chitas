# The weekly guide batch

Once a week a scheduled Claude session writes the guides for the coming days,
checks every word of them against the real text, and puts them live. This page
is its playbook: follow it exactly. The style rules here were worked out with
the owner over many rounds (November 2026); don't drift from them.

**What it writes** (data files only, never app code):

| Text | File | What |
|---|---|---|
| Tanya | `api/_lib/tanya-written-data.js` | intro or recap, summary, small pieces, a few **bridges** |
| Rambam | `data/guides/rambam-ai.json` | a line on the chapter, headings, **plain-words notes**, the Hebrew **splits** |
| Chumash | `data/guides/chumash.json` | one line a day |

Anything not written in time is covered by the server's AI (the same style, a
few cents), so a missed batch never breaks a day.

---

## 1. Set up

```
cd tools && npm ci && cd .. && npm ci
export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
cd tools && node batch.mjs plan --days 10
```

`plan` lists the next 10 days, from tomorrow: each day's Tanya portion, Rambam
chapters (3 a day and 1 a day) and Chumash aliyah, with ✓ for written and ✗
for to write, and a TO WRITE list at the end. Write everything on that list.
(Days the app reads with its own built-in reader, the Tanya's opening pages and
the Rambam's introduction and mitzvos, aren't listed: leave them.)

## 2. Tanya: bridges

`node batch.mjs tanya "Likkutei Amarim 5|1|7"` prints the portion: each
segment's Hebrew (without vowels) and English.

Add an entry to `WRITTEN` in `api/_lib/tanya-written-data.js`, keyed exactly as
`plan` shows it, after the last entry:

```js
'Likkutei Amarim 1|1|12': {
  flow: 'bridges',
  intro: '…',      // when the portion starts the chapter (verse 1); otherwise recap: '…'
  summary: '…',
  segs: [          // one entry per segment, in order: [bridge, [[Hebrew start, English start, bridge?], …]]
    ['', [['ואפילו כל העולם', 'and even if the whole world'], ['היה בעיניך', 'in your own eyes regard']]],
    ['Two problems with the oath, then. …', [['כי הנה מצינו', 'We find in the Gemara', 'Before he can answer, …']]],
  ],
},
```

**Pieces (the cuts).** Cut each segment into small pieces a beginner takes in
one breath: about 5 to 15 English words, never over about 20 where the text has
a matching break. Cut at sentence ends, semicolons, colons, dashes, and before
a new step ("therefore", "for", "however", "as is written", a quoted verse),
wherever both languages have a matching break. Each cut is the first 3 to 6
words of the new piece, copied exactly from the text, in Hebrew and in the
English that translates it (vowels and punctuation don't matter). A segment
marked GLOSS gets no bridge.

**Intro / recap / summary** (the owner likes these as they are):
- intro: at most 2 short sentences, under 35 words: where the previous chapter left off and what this one takes up.
- recap: at most 2 short sentences, under 35 words: the thread so far, leading into today ("Today he …").
- summary: at most 2 short sentences, under 30 words: where today landed.

**Bridges** (the heart of it). Plain-English explanation, shown in a shaded box,
that helps a beginner follow the argument, like the explanatory notes in a good
translation. A bridge:
- sums up in plain words what the last few pieces established ("Two problems with the oath, then. It seems to contradict the Mishnah. And seeing yourself as wicked should lead either to sadness or to not caring at all."), or
- says what the next pieces set out to do or ask, when the text doesn't make it obvious ("Before he can answer, he needs to say what 'tzaddik,' 'rasha' and 'beinoni' actually mean. He starts with how the Gemara divides people."), or
- gives context a beginner lacks, only when the argument depends on it ("Rabbah was one of the great sages of the Talmud. If even he could think of himself as a beinoni, a beinoni must be someone on a very high level.").

Rules: strictly inside the text (no ideas, sources, opinions or lessons it
doesn't contain); one or two plain sentences, under 40 words, warm and direct,
the way a good chavrusa talks; **don't overdo it**: one per real step of the
argument, usually 3 to 6 a portion, none where the text is already clear, never
the next piece in other words; no dramatic build-ups ("X matters: everything
turns on it"), no remarks about the structure ("this comes up again below"), no
definitions for their own sake. A bridge goes just before the piece it leads
into: on the segment (first slot) or on a cut (third slot).

What was tried and dropped, so don't do it: headings that only label topics;
tags like "THE QUESTION"; short "notes" that point at words or define terms.

## 3. Rambam: line, headings, plain-words notes, splits

`node batch.mjs rambam "Hiring 11"` prints each halacha: the Hebrew (without
vowels) and the English paragraphs, numbered, and says which halachos need
splits.

Add an entry to `data/guides/rambam-ai.json`, keyed by the chapter's name as
`plan` shows it:

```json
"Hiring 11": {
 "about": "The mitzvah to pay a worker on time, for his life depends on it; when it applies, hiring through an agent, and settling disputes over wages.",
 "heads": [[1, "Pay on time"], [3, "When it doesn't apply"], [6, "Disputes over wages"]],
 "notes": {
  "6": { "text": "With witnesses to the hiring, on payday: the worker swears and is paid, since the employer is busy and may forget. Without witnesses, or after payday: the employer is believed, with an oath.",
         "term": "Sh'vuat hesset: a lighter oath the Sages added, for claims the Torah's oath doesn't cover." }
 },
 "splits": { "2": ["אי זהו זמנו", "ושכיר לילה גובה", "ושכיר שעות של יום", "שכיר שבת שכיר חדש"] }
}
```

- **about**: one line, under 35 words, the chapter's topics in order.
- **heads**: short headings, 2 to 7 plain words, where a new topic begins, roughly every 2 to 4 halachos, the first at halacha 1.
- **notes**: after the halachos that are hard to follow (several cases or conditions, a long list, a ruling easy to lose): the ruling in plain words, with its reason only if the text gives one. Usually 3 to 6 a chapter; none for a clear halacha; never the halacha again in other words. One or two plain sentences, under 45 words. Strictly with the text: no opinions, sources, practical rulings for today, or anything it doesn't say. **term**: a technical term the translation leaves unexplained (sh'vuat hesset, miggo, chazakah, k'nas), with a short meaning, the first time it comes up in the chapter; otherwise "".
- **splits**: for every halacha with more than one English paragraph, the Hebrew start of English paragraphs 2, 3, … (as many as paragraphs minus one): the first 3 to 6 Hebrew words where the Hebrew that paragraph translates begins, copied exactly from the Hebrew (no vowels needed), in order. If a paragraph has no clear start in the Hebrew (the translator's own addition, or a sentence carried over), give "" for it.

## 4. Chumash

Add a line to `data/guides/chumash.json` for each key `plan` lists
("Vayigash 3"), in the existing style: one or two sentences, about 25 to 35
words, telling what happens in that day's aliyah, plainly, with the Hebrew
names the app uses (Yosef, Yaakov, Binyamin). Look at the neighbouring lines
and match them.

## 5. Check, test, and put it live

```
node batch.mjs check --days 10     # must end "0 errors"
for t in test test:app test:api test:place test:look; do npm run -s $t; done   # all must pass
```

`check` tests every Tanya cut, every Rambam split, note and heading against the
real text. Fix every error it reports; warnings are worth a look (a piece too
long, a bridge too long). If an error can't be fixed, drop that entry: the
server's AI covers the day.

Then, only if `check` shows 0 errors and the tests pass:
1. Commit (data files only) with a message like "Guide batch: Tanya 29 Nov to 8 Dec, Rambam …", ending with the session's attribution lines.
2. Push the branch, open a pull request to `main` with a short summary (days, chapters, counts, check result), and squash-merge it (the owner has asked for the weekly batch to go live on its own when every check passes).
3. Wait for the site (https://chitas.vercel.app/data/guides/rambam-ai.json shows the new chapters), and report.

If `check` or the tests can't be made to pass, don't merge: leave the pull
request open and say exactly what failed.

Never: change app code, settings or other files; skip the check; merge with
errors; rewrite guides already written for past days.
