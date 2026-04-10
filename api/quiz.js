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

// ── Prompt philosophy ─────────────────────────────────────────────────────────
// Goal: make the person feel like they got something from today's learning.
// NOT an exam. NOT "according to the text...".
// A knowledgeable friend asking: "so what did you learn today?"
//
// Format: short scenario or direct question → 4 short answer choices
// The correct answer rewards careful reading.
// The wrong answers are things a careless reader might actually choose.

const SHARED_STYLE = `
FORMAT (non-negotiable):
- Question: 12 words max. Answer choices: 7 words max. Cut ruthlessly.
- 4 answer choices per question. Exactly one is correct.
- Never start a question with "According to", "Based on", or "Which of the following"
- Write answers in plain conversational English — never copy phrasing from the source text
- Use everyday words: "sin offering" not "purgation offering", "permitted" not "halachically valid"

WRONG ANSWERS must be:
- Plausible to someone who skimmed — not obviously absurd
- Things a real learner might genuinely mix up
- Never a trick of wording — wrong in substance, not grammar

SPECIFICITY (the #1 failure mode):
- Every question must be answerable ONLY by someone who read THIS specific section today
- If a learner could answer it from general knowledge, rewrite it
- Anchor to: the specific analogy used, the specific case covered, the specific condition stated
- ✗ "What does Rashi say about this mitzvah?" (too vague)
- ✓ "Rashi compares Shimon's case to — what?" (specific to this text)

TARGET READER: Paid reasonable attention. Gets 3 of 4 right. Misses one because they weren't careful enough.
GOAL: Correct answer = "yes, I remember learning that." Wrong answer = "I should have caught that."
`;

function chumashPrompt(c, diff) {
  return `You write quiz questions for a daily Chumash app. The learner just read this aliyah and Rashi.

CONTENT — ${c.sectionLabel}:
${c.text}

Write exactly 4 questions. Each must come from a DIFFERENT verse or case — no two questions about the same halacha.

Q1 — Main ruling or event: Frame as a scenario with a name. "Reuven does X — what must he bring?" "The animal has Y — what's the law?"
Q2 — A condition or exception: When does the rule change? What specific detail shifts the outcome?
Q3 — A Rashi: Pick the Rashi that adds the most. Don't ask "what does Rashi say on verse N." Ask about its content: "Rashi says the word X means — what?" or "Rashi compares this to — what?"
Q4 — A second law or case: Something from a different part of the aliyah. The aliyah covers multiple situations — test another one.

ACCURACY: Every correct answer must be explicitly stated in the text above. No outside knowledge, no inference.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function tanyaPrompt(c, diff) {
  return `You write quiz questions for a daily Tanya app. The learner just read this section of Chassidus.

CONTENT — ${c.sectionLabel}:
${c.text}

Tanya teaches about the soul, avodah, and the inner life — not halacha. Frame questions around ideas, not rulings.

Before writing, identify what this section is doing:
- One sustained idea being developed?
- A distinction between two things (two types, two levels, two paths)?
- An analogy or mashal?
- A psychological or spiritual insight about a person's inner life?

Write exactly 3 questions:
Q1 — The central teaching: What is the Alter Rebbe saying? Make it concrete and direct.
Q2 — The reason or logic: WHY is this true? What's the mechanism or inner distinction?
Q3 — If there's a second idea, test that. If it's one sustained idea, ask about a key term or the analogy used.

ACCURACY: Every correct answer must appear in the text above. Tanya's concepts are precise — paraphrasing that shifts the meaning is an error.
WRONG ANSWERS: Use real Chassidus/Kabbalistic concepts that sound plausible but are NOT what this specific section teaches.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function rambamPrompt(c, diff) {
  return `You write quiz questions for a daily Rambam app. The learner just read these halachos.

CONTENT — ${c.sectionLabel}:
${c.text}

Write exactly 5 questions — one per distinct halacha or ruling. No two questions about the same case.

How to pick what to ask:
- The ruling that would surprise someone who didn't read carefully
- The unexpected exception or specific condition
- The case where the outcome flips based on one detail

Mix question types naturally:
- Scenario: "Reuven does X — is it permitted?"
- Condition: "What changes if Y is present?"
- Reason: "Why does the Rambam require Z?"

Skip anything obvious. The wrong answers should be things a person might genuinely think is correct.

ACCURACY: Halacha is exact. Every correct answer must match precisely what the Rambam writes above. Wrong answers must be halachically plausible — rulings from adjacent cases or common misunderstandings.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function mitzvosPrompt(c, diff) {
  return `You write quiz questions for a daily Sefer HaMitzvos app. The learner just read today's mitzvah.

CONTENT — ${c.sectionLabel}:
${c.text}

Sefer HaMitzvos entries are short: one mitzvah, its Torah source, and a brief explanation. Keep questions tight.

Write exactly 2 questions:
Q1 — What this mitzvah requires or prohibits. Be concrete and direct.
Q2 — One of: the Torah source (which verse or book), when it applies, or the most interesting specific detail in this entry.

ACCURACY: Base every answer on the text above. Wrong answers should be adjacent mitzvos or things commonly confused with this one.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function weeklyPrompt(sections, diff) {
  const content = sections.map(s => `=== ${s.label} ===\n${s.text}`).join('\n\n');
  return `You write end-of-week review quiz questions for a Jewish learning app.

THIS WEEK'S LEARNING:
${content}

Write exactly 10 questions: 3–4 from Chumash, 3 from Tanya, 3–4 from Rambam.
Tag each question with "subject": "Chumash", "Tanya", or "Rambam".

Pick the most memorable or surprising thing from each section — the detail that sticks, the ruling that surprised, the analogy that clicked.

Use scenario questions with names where the content involves a person doing something.

ACCURACY: Every correct answer must come from the content above. No outside knowledge.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0,"subject":"Chumash"},...]`;
}

// ── Verifier ───────────────────────────────────────────────────────────────────

async function verifyQuestions(questions, text) {
  const prompt = `You are a Jewish learning content verifier. Your job: check that every quiz question is grounded in the source text.

SOURCE TEXT:
${text.slice(0, 4000)}

QUESTIONS TO CHECK:
${JSON.stringify(questions, null, 2)}

For each question, check: is the correct answer (the index in "answer") explicitly stated or clearly shown in the source text above?

If YES — keep the question exactly as-is.
If NO — fix it. You may:
  - Change the correct answer to one that IS in the text (and update the "answer" index)
  - Rewrite the question entirely to ask about something that IS in the text
  - Rewrite wrong answers if they are too similar to the correct one

Do not change the number of questions. Do not change the JSON structure.
Do not add explanations — output only the corrected JSON array.

Respond ONLY with the JSON array, no markdown.`;

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

    let questions = await callClaude(prompt, 2000);
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
