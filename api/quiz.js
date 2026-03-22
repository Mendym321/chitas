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
//
// Length: question ≤ 15 words. Each answer ≤ 8 words.

const SHARED_STYLE = `
DIFFICULTY TARGET: Someone who read today's section once, paying reasonable attention, should get about 3 out of 4 right.

STYLE (mandatory):
- Question max 12 words. Each answer max 8 words. If longer, cut it.
- Scenario questions: name the person, state ONE condition, ask what happens.
- Never start with "According to", "Based on", "Which of the following"
- REWRITE answers in plain English — do NOT quote the source text. Sefaria translations are dense. Simplify.
- Use plain words: "sin offering" not "purgation offering", "soul" not "neshamah" unless testing that term, "permitted" not "halachically valid"
- Wrong answers: plausible to a careless reader, clearly wrong to someone who read carefully. Never obviously absurd.
- Never test verse numbers or peripheral details

SPECIFICITY — the most common failure:
- Do NOT ask generic questions about the topic that someone could answer without reading today's text
- DO ask about the specific thing this section says, the specific analogy used, the specific case covered
- If this section uses an analogy or comparison, ask about it directly
- If this section makes a specific ruling or distinction, ask about that specific one
- Bad: "What does the Alter Rebbe say about kavanah?" (could apply to 50 chapters)
- Good: "A mitzvah without kavanah is compared to what?" (specific to this section's analogy)
- Bad: "What is important about fulfilling mitzvos?" (generic)
- Good: "Which gives more light — the mitzvah itself or the kavanah?" (tests this section's specific claim)

THE GOAL: Getting it right = "yes, I learned that today." Getting it wrong = "I should have caught that."

REWRITING ANSWERS:
BAD: "The neshamah draws forth light to perfect the nefesh and body by means of the letters of speech"
GOOD: "Speech draws divine light into the body"
BAD: "G-d wants us to cleave to Him through both action and intention"
GOOD: "Both action and kavanah together"
`

function chumashPrompt(c, diff) {
  return `You are writing quiz questions for a daily Chumash learning app. The user just read this aliyah with Rashi.

CONTENT — ${c.sectionLabel}:
${c.text}

Generate exactly 4 questions covering DIFFERENT aspects of the aliyah:
- Q1: The main law or event — use a scenario with a name to make it concrete. "Reuven did X. What does he bring?" "What happens if the animal has Y?"
- Q2: A detail or condition in the law — a case where the rule changes, an exception, or a specific requirement
- Q3: A specific Rashi — pick the Rashi that adds the most insight. Ask WHY Rashi says this, or what it teaches. Not "what does Rashi say on verse N" but "Rashi compares X to Y — why?"
- Q4: Another law or case from a different part of this aliyah — the aliyah covers multiple cases, test one more

Pick questions from DIFFERENT verses/cases. Don't ask 2 questions about the same halacha.

${SHARED_STYLE}

LEGITIMACY: Every correct answer must be explicitly in the text. No outside knowledge.

Respond ONLY with JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function tanyaPrompt(c, diff) {
  return `You are writing quiz questions for a daily Tanya learning app. The user just read this section of Chassidus.

CONTENT — ${c.sectionLabel}:
${c.text}

Tanya is a book of Chassidus — it explores the soul, G-d's relationship to the world, the inner meaning of mitzvos, and the path of avodah. It is NOT a halacha book. Do not frame questions as rulings or legal consequences.

First, read this section and identify what it's actually doing:
- Is it developing one central idea or concept?
- Is it drawing a distinction between two things (e.g. two types of love, two levels of soul)?
- Is it giving a reason or deeper explanation for something?
- Is it using a mashul (parable or analogy) to illuminate something?
- Is it making a psychological or spiritual observation about a person's inner life?

Then write 3 questions that together capture what matters in this section:
- Q1: The central idea or teaching — what is the Alter Rebbe saying? Make it concrete and direct.
- Q2: The reason, mechanism, or distinction — WHY is this true? What is the inner logic?
- Q3: If there's a second idea or nuance, test that. If it's one sustained idea, ask about an implication or the key term the Alter Rebbe uses.

${SHARED_STYLE}

Wrong answers for Tanya: use real Chassidus/Kabbalistic concepts that sound plausible but are NOT what this specific section teaches.

LEGITIMACY: Every correct answer must be in this text. Tanya concepts are precise — do not paraphrase in ways that shift the meaning.

Respond ONLY with JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function rambamPrompt(c, diff) {
  return `You are writing quiz questions for a daily Rambam learning app. The user just read these halachos.

CONTENT — ${c.sectionLabel}:
${c.text}

This text likely covers multiple distinct halachos. Your job: identify the 5 most interesting rulings and write one question per ruling.

Generate exactly 5 questions, each from a DIFFERENT halacha or case:
- Each question should cover a distinct ruling, case, or condition from the text
- Do NOT ask 2 questions about the same halacha
- Mix the question types naturally: some scenarios ("Reuven does X — permitted?"), some conditions ("What changes if Y?"), some reasons ("Why does the Rambam require Z?")
- Pick rulings that would genuinely surprise someone who didn't read carefully — the interesting distinctions, the unexpected exceptions, the specific conditions

Use scenarios with names where the ruling involves a person doing something.
Skip questions that just restate the obvious.

${SHARED_STYLE}

LEGITIMACY: Halacha is exact. Every correct answer must match precisely what the Rambam writes above. Wrong answers must be halachically plausible — things someone might genuinely think.

Respond ONLY with JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function mitzvosPrompt(c, diff) {
  return `You are writing quiz questions for a daily Sefer HaMitzvos learning app. The user just learned today's mitzvah.

CONTENT — ${c.sectionLabel}:
${c.text}

Sefer HaMitzvos entries are often brief — one mitzvah, its source verse, and a short explanation. Don't over-engineer this.

Generate exactly 2 questions:
- Q1: What this mitzvah requires or prohibits — make it concrete and direct
- Q2: Either the Torah source (which verse/book), a condition of when it applies, or the most interesting specific detail in the text

${SHARED_STYLE}

LEGITIMACY: Base on the text above. Wrong answers should be adjacent mitzvos or things someone might confuse with this one.

Respond ONLY with JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function weeklyPrompt(sections, diff) {
  const content = sections.map(s => `=== ${s.label} ===\n${s.text}`).join('\n\n');
  return `You are writing a weekly review quiz for a Jewish learning app. End-of-week, lively, rewarding.

THIS WEEK'S LEARNING:
${content}

Generate exactly 10 questions: 3-4 Chumash, 3 Tanya, 3-4 Rambam.
Tag each: "subject": "Chumash" / "Tanya" / "Rambam"

Use scenarios with names where possible. Pick the most memorable or surprising thing from each section.

${SHARED_STYLE}

LEGITIMACY: Every correct answer must be in the content above.

Respond ONLY with JSON array, no markdown:
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
