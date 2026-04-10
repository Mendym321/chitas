/**
 * Vercel Serverless Function: /api/quiz
 *
 * Fetches exact content from Sefaria/Hebcal → generates questions via Claude Haiku
 * → verifies answers are grounded in the actual text.
 *
 * POST /api/quiz
 * Body: { type, sectionId, rambamTrack, difficulty, date, weekSubs }
 * Returns: { questions, cacheKey, refs, sectionLabel }
 */

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SEFARIA = 'https://www.sefaria.org';
const HEBCAL  = 'https://www.hebcal.com';

// ── Text cleaning ──────────────────────────────────────────────────────────────

function cleanSefariaHtml(s) {
  if (!s) return '';
  function removeFootnotes(str) {
    let result = '', i = 0;
    function skipClose(from) {
      let depth = 1, j = from;
      while (j < str.length && depth > 0) {
        const o = str.indexOf('<i', j), c = str.indexOf('</i>', j);
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
          if (fiM) { i = skipClose(afterSupClose + str.slice(afterSupClose).indexOf(fiM[0]) + fiM[0].length); continue; }
          i = afterSupClose; continue;
        }
      }
      const fiM = str.slice(i).match(/^<i\b[^>]*class="footnote"[^>]*>/);
      if (fiM) { i = skipClose(i + fiM[0].length); continue; }
      result += str[i]; i++;
    }
    return result;
  }
  s = removeFootnotes(s);
  s = s.replace(/<[^>]+>/g, '').replace(/  +/g, ' ').trim();
  return s;
}

function flattenText(x) {
  if (!x) return [];
  if (typeof x === 'string') { const s = cleanSefariaHtml(x); return s ? [s] : []; }
  if (Array.isArray(x)) return x.flatMap(flattenText);
  return [];
}

function expandRefs(refs) {
  const out = [];
  (refs || []).forEach(ref => {
    if (!ref) return;
    const m = ref.match(/^(.+?)\s+(\d+)-(\d+)$/);
    if (m) { for (let i = parseInt(m[2]); i <= parseInt(m[3]); i++) out.push(m[1] + ' ' + i); }
    else out.push(ref);
  });
  return [...new Set(out)];
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

// ── Content fetchers ───────────────────────────────────────────────────────────

async function fetchChumash(dateObj) {
  const dow = dateObj.getDay();
  const sat = new Date(dateObj); sat.setDate(dateObj.getDate() + (6 - dow));
  const sun = new Date(sat); sun.setDate(sat.getDate() - 6);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const hd = await fetch(`${HEBCAL}/hebcal?v=1&cfg=json&s=on&leyning=on&start=${fmt(sun)}&end=${fmt(sat)}&lg=s`).then(r => r.json());
  const pItem = (hd.items || []).find(i => i.category === 'parashat' && i.leyning);
  if (!pItem) throw new Error('No parsha leyning');

  const aliyahNum = dow === 6 ? 7 : dow + 1;
  const aliyahRef = (pItem.leyning[String(aliyahNum)] || '').trim();
  if (!aliyahRef) throw new Error(`No aliyah ${aliyahNum}`);

  const [torah, rashi] = await Promise.all([
    fetchSefariaText(aliyahRef),
    fetchSefariaText(`Rashi on ${aliyahRef}`).catch(() => ({ ref: '', segments: [] })),
  ]);

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
  // Use /api/tanya-boundary (server-side, respects date params correctly)
  const iso = dateObj.toISOString().slice(0, 10);
  const boundary = await fetch(`https://chitas.vercel.app/api/tanya-boundary?date=${iso}`)
    .then(r => r.json()).catch(() => null);

  if (!boundary?.today) throw new Error('Tanya boundary not found');

  // Parse refs using the url slug method (same as the app)
  function parseTanyaUrl(url) {
    if (!url) return null;
    const m = url.match(/\.([0-9]+)\.([0-9]+)$/);
    if (!m) return null;
    return { chapterSlug: url.slice(0, url.lastIndexOf('.')), chapter: parseInt(m[1]), verse: parseInt(m[2]) };
  }

  const t = parseTanyaUrl(boundary.todayUrl);
  const n = parseTanyaUrl(boundary.tomorrowUrl);

  // Fetch the chapter
  const chapterSlug = t ? t.chapterSlug : boundary.today.replace(/:\d+$/, '').replace(/ /g, '_');
  const chRes = await fetch(`${SEFARIA}/api/texts/${encodeURIComponent(chapterSlug)}?lang=bi&context=0&commentary=0`)
    .then(r => r.json()).catch(() => null);

  function flatRaw(x) {
    if (!x) return [];
    if (typeof x === 'string') return x ? [cleanSefariaHtml(x)] : [];
    if (Array.isArray(x)) return x.flatMap(flatRaw);
    return [];
  }

  const allEn = flatRaw(chRes?.text || []);
  const startV = t ? t.verse : 1;
  const sameChapter = n && t && t.chapterSlug === n.chapterSlug;
  const endV = sameChapter && n.verse > startV ? n.verse - 1 : allEn.length;
  const portion = allEn.slice(startV - 1, endV);
  const portionRef = `${(boundary.today || '').replace(/:\d+$/, '')}:${startV}-${endV}`;

  return {
    sectionLabel: boundary.displayEn || boundary.today,
    ref: portionRef,
    refs: [portionRef],
    cacheKey: `quiz:tanya:${portionRef}`,
    text: portion.join('\n\n').slice(0, 5000),
  };
}

async function fetchRambam(dateObj, track) {
  // Use Hebcal single-day fetch — correctly returns per-day chapters
  const iso = dateObj.toISOString().slice(0, 10);
  const hebData = await fetch(
    `${HEBCAL}/hebcal?v=1&cfg=json&dps=on&dr3=on&dr1=on&d=on&start=${iso}&end=${iso}&lg=s`
  ).then(r => r.json()).catch(() => null);

  const items = hebData?.items || [];
  const cat = track === '1' ? 'dailyRambam1' : 'dailyRambam3';
  const item = items.find(i => i.category === cat);

  if (!item) throw new Error(`No Rambam item (${cat}) for ${iso}`);

  // Extract refs — same logic as the app
  let refs = [];
  if (item.refs?.length) {
    refs = item.refs;
  } else if (item.memo?.includes('sefaria.org/')) {
    const urls = item.memo.match(/https:\/\/www\.sefaria\.org\/[^\s]+/g) || [];
    refs = urls.flatMap(url => {
      try {
        const path = decodeURIComponent(url.split('sefaria.org/').pop().split('?')[0]);
        const clean = path.replace(/_/g, ' ');
        const dot = clean.lastIndexOf('.');
        const ref = dot === -1 ? clean : clean.slice(0, dot) + ' ' + clean.slice(dot + 1);
        return expandRefs([ref]);
      } catch(e) { return []; }
    });
  } else if (item.link?.includes('sefaria.org/')) {
    const path = decodeURIComponent(item.link.split('sefaria.org/').pop().split('?')[0]);
    const clean = path.replace(/_/g, ' ');
    const dot = clean.lastIndexOf('.');
    refs = expandRefs([dot === -1 ? clean : clean.slice(0, dot) + ' ' + clean.slice(dot + 1)]);
  } else if (item.title) {
    refs = expandRefs(['Mishneh Torah, ' + item.title]);
  }

  if (!refs.length) throw new Error('No Rambam refs for ' + iso);

  const texts = await Promise.all(refs.map(ref => fetchSefariaText(ref).catch(() => ({ ref, segments: [] }))));
  const combined = texts.map(t => `[${t.ref}]\n${t.segments.join('\n')}`).join('\n\n---\n\n');

  return {
    sectionLabel: item.title || refs.join(', '),
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

TARGET READER: Paid reasonable attention. Gets 3 of 4 right. Misses one because they weren't careful enough.
GOAL: Correct answer = "yes, I remember learning that." Wrong answer = "I should have caught that."
`;

function chumashPrompt(c, diff) {
  return `You write quiz questions for a daily Chumash app. The learner just read this aliyah and Rashi.

CONTENT — ${c.sectionLabel}:
${c.text}

Write exactly 4 questions. Each must come from a DIFFERENT verse or case.

Q1 — Main ruling or event: Frame as a scenario with a name. "Reuven does X — what must he bring?"
Q2 — A condition or exception: When does the rule change?
Q3 — A Rashi: Ask about its content, not "what does Rashi say on verse N."
Q4 — A second law or case from a different part of the aliyah.

ACCURACY: Every correct answer must be explicitly stated in the text above.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function tanyaPrompt(c, diff) {
  return `You write quiz questions for a daily Tanya app. The learner just read this section of Chassidus.

CONTENT — ${c.sectionLabel}:
${c.text}

Tanya teaches about the soul, avodah, and the inner life — not halacha. Frame questions around ideas, not rulings.

Write exactly 3 questions:
Q1 — The central teaching: What is the Alter Rebbe saying?
Q2 — The reason or logic: WHY is this true?
Q3 — If there's a second idea, test that. If one sustained idea, ask about a key term or analogy.

ACCURACY: Every correct answer must appear in the text above.
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

Mix question types:
- Scenario: "Reuven does X — is it permitted?"
- Condition: "What changes if Y is present?"
- Reason: "Why does the Rambam require Z?"

ACCURACY: Halacha is exact. Every correct answer must match precisely what the Rambam writes above.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function mitzvosPrompt(c, diff) {
  return `You write quiz questions for a daily Sefer HaMitzvos app. The learner just read today's mitzvah.

CONTENT — ${c.sectionLabel}:
${c.text}

Write exactly 2 questions:
Q1 — What this mitzvah requires or prohibits.
Q2 — The Torah source, when it applies, or the most interesting specific detail.

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

Pick the most memorable or surprising thing from each section.

ACCURACY: Every correct answer must come from the content above.

${SHARED_STYLE}

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0,"subject":"Chumash"},...]`;
}

// ── Verifier ───────────────────────────────────────────────────────────────────

async function verifyQuestions(questions, text) {
  const prompt = `You are a Jewish learning content verifier. Check that every quiz question is grounded in the source text.

SOURCE TEXT:
${text.slice(0, 4000)}

QUESTIONS TO CHECK:
${JSON.stringify(questions, null, 2)}

For each question: is the correct answer explicitly stated in the source text?
If YES — keep exactly as-is.
If NO — fix it by rewriting the question or changing the answer to one that IS in the text.

Do not change the number of questions or JSON structure.
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

  const { type = 'daily', sectionId, rambamTrack = '3', difficulty = 'standard', date, weekSubs } = req.body || {};
  const dateObj = date ? new Date(date + 'T12:00:00') : new Date();

  try {
    if (type === 'weekly') {
      if (!weekSubs?.length) return res.status(400).json({ error: 'weekSubs required' });
      const cacheKey = `quiz:weekly:${weekSubs.map(s=>s.ref||s.label).join('|')}:${difficulty}`;
      const questions = await callClaude(weeklyPrompt(weekSubs, difficulty), 2000);
      return res.status(200).json({ questions, cacheKey });
    }

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
