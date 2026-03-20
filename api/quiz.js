/**
 * Vercel Serverless Function: /api/quiz
 *
 * Fetches exact content from Sefaria/Hebcal → generates questions via Claude Haiku
 * → verifies answers are grounded in the actual text.
 *
 * Cache key = quiz:{sectionId}:{contentRef}:{difficulty}
 * Content-addressable: same ref = same cached questions, regardless of date.
 *
 * POST /api/quiz
 * Body: {
 *   type: 'daily' | 'weekly',
 *   sectionId: 'chumash' | 'tanya' | 'rambam' | 'mitzvos',
 *   rambamTrack: '1' | '3' | 'm',
 *   difficulty: 'basic' | 'standard' | 'deep',
 *   date: 'YYYY-MM-DD',
 *   weekSubs: [...],   // for weekly only
 * }
 * Returns: { questions, cacheKey, refs, sectionLabel }
 *
 * Set ANTHROPIC_API_KEY in Vercel environment variables.
 */

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SEFARIA = 'https://www.sefaria.org';
const HEBCAL  = 'https://www.hebcal.com';

// ── Text cleaning ──────────────────────────────────────────────────────────────

function cleanSefariaHtml(s) {
  if (!s) return '';
  function removeFootnotes(str) {
    let result = '', i = 0;
    function skipToMatchingCloseI(from) {
      let depth = 1, j = from;
      while (j < str.length && depth > 0) {
        const o = str.indexOf('<i', j);
        const c = str.indexOf('</i>', j);
        if (o !== -1 && (c === -1 || o < c)) { depth++; j = o + 2; }
        else if (c !== -1) { depth--; j = c + 4; }
        else break;
      }
      return j;
    }
    while (i < str.length) {
      const supM = str.slice(i).match(/^<sup\b[^>]*class="footnote-marker"[^>]*>/);
      if (supM) {
        const afterSup = str.indexOf('</sup>', i + supM[0].length);
        if (afterSup !== -1) {
          const afterSupClose = afterSup + 6;
          const rest = str.slice(afterSupClose).trimStart();
          const fiM = rest.match(/^<i\b[^>]*class="footnote"[^>]*>/);
          if (fiM) {
            const fiBodyStart = afterSupClose + str.slice(afterSupClose).indexOf(fiM[0]) + fiM[0].length;
            i = skipToMatchingCloseI(fiBodyStart);
            continue;
          }
          i = afterSupClose; continue;
        }
      }
      const fiM = str.slice(i).match(/^<i\b[^>]*class="footnote"[^>]*>/);
      if (fiM) { i = skipToMatchingCloseI(i + fiM[0].length); continue; }
      result += str[i]; i++;
    }
    return result;
  }
  s = removeFootnotes(s);
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/  +/g, ' ').trim();
  return s;
}

function flattenText(x) {
  if (!x) return [];
  if (typeof x === 'string') { const s = cleanSefariaHtml(x); return s ? [s] : []; }
  if (Array.isArray(x)) return x.flatMap(flattenText);
  return [];
}

// ── Sefaria fetcher ────────────────────────────────────────────────────────────

async function fetchSefariaText(ref) {
  const url = `${SEFARIA}/api/v3/texts/${encodeURIComponent(ref)}?version=english&fill_in_missing_segments=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sefaria ${r.status} for "${ref}"`);
  const d = await r.json();
  const eng = (d.versions || []).find(v => v.language === 'en') || d.versions?.[0];
  if (!eng?.text) throw new Error(`No English text for "${ref}"`);
  return { ref: d.ref || ref, segments: flattenText(eng.text) };
}

function sefariaCalUrl(d) {
  return `${SEFARIA}/api/calendars?year=${d.getFullYear()}&month=${d.getMonth()+1}&day=${d.getDate()}`;
}

// ── Content fetchers ───────────────────────────────────────────────────────────

async function fetchChumash(dateObj) {
  const dow = dateObj.getDay();
  const sat = new Date(dateObj); sat.setDate(dateObj.getDate() + (6 - dow));
  const sun = new Date(sat); sun.setDate(sat.getDate() - 6);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const hd = await fetch(`${HEBCAL}/hebcal?v=1&cfg=json&s=on&start=${fmt(sun)}&end=${fmt(sat)}&lg=s`).then(r => r.json());
  const pItem = (hd.items || []).find(i => i.category === 'parashat' && i.leyning);
  if (!pItem) throw new Error('No parsha leyning');

  const aliyahNum = dow === 6 ? 7 : dow + 1;
  const aliyahRef = (pItem.leyning[String(aliyahNum)] || '').replace(/\s*-\s*/g, '-').trim();
  if (!aliyahRef) throw new Error(`No aliyah ${aliyahNum}`);

  const [torah, rashi] = await Promise.all([
    fetchSefariaText(aliyahRef),
    fetchSefariaText(`Rashi on ${aliyahRef}`).catch(() => ({ ref: '', segments: [] })),
  ]);

  // Interleave verses with Rashi — verse-by-verse alignment
  const interleaved = torah.segments.map((verse, i) => {
    const r = rashi.segments[i] || '';
    return `[Verse ${i+1}] ${verse}${r ? `\n[Rashi on verse ${i+1}] ${r}` : ''}`;
  }).join('\n\n');

  return {
    sectionLabel: `${(pItem.title||'').replace('Parashat ','')} — Aliya ${aliyahNum}`,
    ref: aliyahRef,
    refs: [aliyahRef],
    cacheKey: `quiz:chumash:${aliyahRef}`,
    text: interleaved.slice(0, 6000),
    hasRashi: rashi.segments.length > 0,
  };
}

async function fetchTanya(dateObj) {
  const nextDate = new Date(dateObj); nextDate.setDate(dateObj.getDate() + 1);
  const [calToday, calTomorrow] = await Promise.all([
    fetch(sefariaCalUrl(dateObj)).then(r => r.json()),
    fetch(sefariaCalUrl(nextDate)).then(r => r.json()),
  ]);

  const findTanya = cal => (cal.calendar_items || []).find(i =>
    (i.title?.en || '').toLowerCase().includes('tanya')
  );
  const todayRef    = findTanya(calToday)?.ref  || '';
  const tomorrowRef = findTanya(calTomorrow)?.ref || '';
  if (!todayRef) throw new Error('Tanya not in calendar');

  const parseRef = ref => { const m = ref.match(/^(.*?)(\d+):(\d+)$/); return m ? { chapter: parseInt(m[2]), seg: parseInt(m[3]) } : null; };
  const tp = parseRef(todayRef);
  const tn = tomorrowRef ? parseRef(tomorrowRef) : null;
  if (!tp) throw new Error('Cannot parse Tanya ref: ' + todayRef);

  const chapterRef = todayRef.replace(/:\d+$/, '');
  const { segments } = await fetchSefariaText(chapterRef);
  const endSeg = (tn && tp.chapter === tn.chapter) ? tn.seg - 1 : segments.length;
  const portion = segments.slice(tp.seg - 1, endSeg);
  const portionRef = `${chapterRef}:${tp.seg}-${endSeg}`;

  return {
    sectionLabel: todayRef,
    ref: portionRef,
    refs: [portionRef],
    cacheKey: `quiz:tanya:${portionRef}`,
    text: portion.join('\n\n').slice(0, 5000),
  };
}

async function fetchRambam(dateObj, track) {
  const cal = await fetch(sefariaCalUrl(dateObj)).then(r => r.json());
  const items = cal.calendar_items || [];
  let refs = [];

  if (track === '3') {
    const r3items = items.filter(i => { const t = i.title?.en||''; return t.includes('3 Chapter') || t.includes('3 Chapters'); });
    refs = [...new Set(r3items.flatMap(item => item.refs?.length ? item.refs : item.ref ? [item.ref] : []))];
  } else {
    const r1 = items.find(i => { const t = i.title?.en||''; return t.toLowerCase().includes('rambam') && !t.includes('3 Chapter') && !t.includes('3 Chapters'); });
    if (r1) refs = r1.refs?.length ? r1.refs : r1.ref ? [r1.ref] : [];
  }

  refs = [...new Set(refs)];
  if (!refs.length) throw new Error('No Rambam refs for track ' + track);

  const texts = await Promise.all(refs.map(ref => fetchSefariaText(ref).catch(() => ({ ref, segments: [] }))));
  const combined = texts.map(t => `[${t.ref}]\n${t.segments.join('\n')}`).join('\n\n---\n\n');

  return {
    sectionLabel: refs.join(', '),
    ref: refs.join('|'),
    refs,
    cacheKey: `quiz:rambam:${refs.join('|')}`,
    text: combined.slice(0, 6000),
  };
}

async function fetchMitzvos(dateObj) {
  const iso = dateObj.toISOString().slice(0, 10);
  const hd = await fetch(`${HEBCAL}/hebcal?v=1&cfg=json&dsm=on&d=on&start=${iso}&end=${iso}&lg=s`).then(r => r.json());
  const mItem = (hd.items || []).find(i => i.category === 'seferHaMitzvot' || (i.title||'').match(/P\d+|N\d+/));
  if (!mItem) throw new Error('Sefer HaMitzvos not found');

  const title = mItem.title || '';
  const allPos = [...title.matchAll(/P(\d+)/g)].map(m => `Sefer HaMitzvot, Positive Commandments ${m[1]}`);
  const allNeg = [...title.matchAll(/N(\d+)/g)].map(m => `Sefer HaMitzvot, Negative Commandments ${m[1]}`);
  const refs = [...allPos, ...allNeg];

  const texts = await Promise.all(refs.map(ref => fetchSefariaText(ref).catch(() => null)));
  const fetched = refs.map((ref, i) => texts[i] ? `[${ref}]\n${texts[i].segments.join('\n')}` : null).filter(Boolean);
  const text = fetched.length
    ? fetched.join('\n\n').slice(0, 3000)
    : `Today's mitzvah: ${title}. Generate questions based on accurate knowledge of this mitzvah.`;

  return {
    sectionLabel: title,
    ref: title.replace(/\s+/g, '_'),
    refs,
    cacheKey: `quiz:mitzvos:${title.replace(/\s+/g,'_')}`,
    text,
  };
}

// ── Prompts ────────────────────────────────────────────────────────────────────

// Style rules applied to ALL questions regardless of difficulty:
// - Question max 15 words. Answer max 10 words. No exceptions.
// - No preamble: never start with "According to", "Based on", "In this passage"
// - Sound like a chavrusa asking, not a professor examining
// - Wrong answers must require real knowledge to eliminate — not obviously absurd
// - Correct answer should feel satisfying to get right, not like a trick
//
// Difficulty changes WHAT is tested, not how long the question is:
const DIFFICULTY_GUIDE = {
  basic:    'Test the most obvious main point — what happened, what is required, what is forbidden.',
  standard: 'Test the reasoning or condition — why, when, under what circumstances.',
  deep:     'Test a specific distinction or implication — what is the edge case, what follows from this.',
};

function chumashPrompt(c, diff) {
  return `You are writing quiz questions for a Jewish learning app. The user just read this aliyah with Rashi. Write questions that feel like a knowledgeable friend testing you — natural, clear, interesting.

CONTENT:
${c.text}

DIFFICULTY: ${diff} — ${DIFFICULTY_GUIDE[diff]}

STRICT STYLE RULES — violating these makes the quiz unusable:
1. Questions: max 12 words. Answers: max 8 words. Be ruthlessly concise.
2. NEVER start a question with "According to", "Based on", "In this passage", "What does the text say"
3. Questions sound like: "What animal did the woman bring?" not "According to verse 3, what animal does the Torah require?"
4. Answers sound like: "A female goat" not "A female goat without blemish as stated in the text"
5. Wrong answers must be things a careless reader might believe — not obviously absurd options
6. Q1: about what the Torah text says (pshat)
7. Q2: specifically about what Rashi explains — name Rashi in the question
8. Q3: connects text and Rashi — tests real understanding

LEGITIMACY: Every correct answer must be in the text above. No outside knowledge.

BAD example: "According to the plain text of this aliya, what animal can be brought as a sin offering by someone from the populace who unwittingly incurs guilt?" → "A female goat or a female sheep, both without blemish"
GOOD example: "What two animals can serve as a sin offering here?" → "A female goat or female sheep"

Respond ONLY with JSON, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function tanyaPrompt(c, diff) {
  return `You are writing quiz questions for a Jewish learning app. The user just read this section of Tanya. Test whether they understood the Alter Rebbe's actual teaching — not vocabulary, not metadata.

CONTENT:
${c.text}

DIFFICULTY: ${diff} — ${DIFFICULTY_GUIDE[diff]}

STRICT STYLE RULES:
1. Questions: max 12 words. Answers: max 10 words. Be ruthlessly concise.
2. NEVER start with "According to", "Based on", "What does the Alter Rebbe say about"
3. Ask about the SUBSTANCE: what IS the teaching, not who said it or where
4. Good question: "Why isn't kavanah alone enough for Shema?" Bad: "What does the Alter Rebbe explain about the necessity of verbal articulation?"
5. Wrong answers must use real Tanya/Chassidus concepts that are close but wrong — not nonsense
6. Q1: the core teaching or ruling in plain terms
7. Q2: the reason or mechanism the Alter Rebbe gives
8. Q3: a consequence or application of this teaching

LEGITIMACY: Every correct answer must be in the text. Tanya is precise — don't rephrase in ways that change the meaning.

BAD: "Why does the Alter Rebbe explain that verbal articulation through speech is necessary for fulfilling commandments?" → "Because the neshamah requires the letters of speech pronounced by the nefesh to draw forth light"
GOOD: "Why isn't mental recitation of Shema enough?" → "The neshamah needs the letters of speech to draw light"

Respond ONLY with JSON, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function rambamPrompt(c, diff) {
  return `You are writing quiz questions for a Jewish learning app. The user just read these halachos of Rambam. Make questions feel like testing a chavrusa — sharp, clear, about the actual halacha.

CONTENT:
${c.text}

DIFFICULTY: ${diff} — ${DIFFICULTY_GUIDE[diff]}

STRICT STYLE RULES:
1. Questions: max 12 words. Answers: max 8 words. No exceptions.
2. NEVER start with "According to the Rambam", "What is the Rambam's ruling", "Based on this halacha"
3. State the scenario directly: "May one rent a field to a non-Jew in Israel?" not "What is the Rambam's position on the rental of fields?"
4. Answers state the ruling cleanly: "No, never" / "Yes, but only..." / "Only if..."
5. Wrong answers must be halachically plausible alternatives — things someone could reasonably think
6. Spread questions across different halachos if the text covers multiple
7. Q1: a clear yes/no or what-is-required ruling
8. Q2: a condition or exception to a ruling
9. Q3: the reason given for a ruling

LEGITIMACY: Halacha is precise. Every correct answer must match exactly what the Rambam writes above.

BAD: "According to the Rambam, under what circumstances may one provide medical treatment to an idolater without payment?" → "Only if one fears negative consequences or ill feeling will be aroused"
GOOD: "When may a doctor treat a non-Jew for free?" → "Only if refusing would cause hostility"

Respond ONLY with JSON, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function mitzvosPrompt(c, diff) {
  return `You are writing quiz questions for a Jewish learning app. The user just learned today's mitzvah from Sefer HaMitzvos.

CONTENT:
${c.text}

DIFFICULTY: ${diff} — ${DIFFICULTY_GUIDE[diff]}

STRICT STYLE RULES:
1. Questions: max 12 words. Answers: max 8 words.
2. NEVER start with "According to", "What does the Rambam say", "Based on this source"
3. Ask directly: "What does Kiddush fulfill?" not "What is the mitzvah of remembering Shabbat?"
4. Answers are clean and direct: "Sanctifying Shabbat in words" not "To sanctify Shabbat and say blessings at its beginning and culmination"
5. Wrong answers must be adjacent mitzvos or common confusions — not obviously wrong
6. Q1: what this mitzvah requires in plain terms
7. Q2: the Torah source (book/verse) or when it applies
8. Q3: a specific detail, condition, or what this includes

Respond ONLY with JSON, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function weeklyPrompt(sections, diff) {
  const content = sections.map(s => `=== ${s.label} ===\n${s.text}`).join('\n\n');
  return `You are writing a weekly review quiz for a Jewish learning app. Make it feel like a lively end-of-week review — sharp questions that reward people who actually learned.

THIS WEEK'S CONTENT:
${content}

DIFFICULTY: ${diff} — ${DIFFICULTY_GUIDE[diff]}

Generate exactly 10 questions: 3-4 Chumash, 3 Tanya, 3-4 Rambam.

STRICT STYLE RULES (same as daily):
1. Questions: max 12 words. Answers: max 8 words.
2. No preamble ("According to...", "Based on...", "What does the text say about...")
3. Direct, natural phrasing — chavrusa style not exam style
4. Wrong answers must require real knowledge to eliminate
5. Spread across different topics/halachos covered this week
6. Tag each: "subject": "Chumash" / "Tanya" / "Rambam"

LEGITIMACY: Every correct answer must be in the content above.

Respond ONLY with JSON, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0,"subject":"Chumash"},...]`;
}

// ── Verifier ───────────────────────────────────────────────────────────────────

async function verifyQuestions(questions, text) {
  const prompt = `You are a Jewish learning content verifier. Check these quiz questions against the source text.

SOURCE TEXT:
${text.slice(0, 4000)}

QUESTIONS:
${JSON.stringify(questions, null, 2)}

For each question: is the correct answer (index given by "answer") explicitly supported by the source text?
- If yes, keep it unchanged.
- If no, fix the question or correct answer so it IS grounded in the text.
- Do not change the count or structure.

Respond ONLY with the corrected JSON array, no markdown.`;

  try {
    const verified = await callClaude(prompt, 1200);
    if (Array.isArray(verified) && verified.length === questions.length) return verified;
  } catch(e) {
    console.error('Verifier failed, using originals:', e.message);
  }
  return questions;
}

// ── Claude caller ──────────────────────────────────────────────────────────────

async function callClaude(prompt, maxTokens = 1500) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${(await resp.text()).slice(0,200)}`);
  const data = await resp.json();
  const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('Empty/invalid response');
  const valid = parsed.every(q =>
    q.q && Array.isArray(q.options) && q.options.length === 4 &&
    typeof q.answer === 'number' && q.answer >= 0 && q.answer <= 3
  );
  if (!valid) throw new Error('Malformed question structure');
  return parsed;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { type = 'daily', sectionId, rambamTrack = '1', difficulty = 'standard', date, weekSubs } = req.body || {};
  const dateObj = date ? new Date(date + 'T12:00:00') : new Date();

  try {
    // Weekly
    if (type === 'weekly') {
      if (!weekSubs?.length) return res.status(400).json({ error: 'weekSubs required' });
      const cacheKey = `quiz:weekly:${weekSubs.map(s=>s.ref||s.label).join('|')}:${difficulty}`;
      const questions = await callClaude(weeklyPrompt(weekSubs, difficulty), 2000);
      return res.status(200).json({ questions, cacheKey });
    }

    // Daily
    if (!sectionId) return res.status(400).json({ error: 'sectionId required' });

    let content;
    if      (sectionId === 'chumash') content = await fetchChumash(dateObj);
    else if (sectionId === 'tanya')   content = await fetchTanya(dateObj);
    else if (sectionId === 'rambam')  content = await fetchRambam(dateObj, rambamTrack);
    else if (sectionId === 'mitzvos') content = await fetchMitzvos(dateObj);
    else return res.status(400).json({ error: 'Invalid sectionId' });

    const cacheKey = `${content.cacheKey}:${difficulty}`;

    let prompt;
    if      (sectionId === 'chumash') prompt = chumashPrompt(content, difficulty);
    else if (sectionId === 'tanya')   prompt = tanyaPrompt(content, difficulty);
    else if (sectionId === 'rambam')  prompt = rambamPrompt(content, difficulty);
    else if (sectionId === 'mitzvos') prompt = mitzvosPrompt(content, difficulty);

    let questions = await callClaude(prompt, 1500);
    questions = await verifyQuestions(questions, content.text);

    return res.status(200).json({
      questions,
      cacheKey,
      refs: content.refs,
      sectionLabel: content.sectionLabel,
    });

  } catch(err) {
    console.error('Quiz error:', err);
    return res.status(500).json({ error: 'Quiz generation failed', detail: err.message });
  }
}
