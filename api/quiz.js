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

const DIFFICULTY_GUIDE = {
  basic:    'Focus on direct recall of the main points clearly stated in the text.',
  standard: 'Test understanding of meaning and reasoning, not just surface facts.',
  deep:     'Test specific distinctions, edge cases, deeper reasoning, and implications.',
};

function chumashPrompt(c, diff) {
  return `You are generating quiz questions for a Jewish daily learning app. The user just read this Torah portion with Rashi.

CONTENT — ${c.sectionLabel}:
${c.text}

Generate exactly 3 multiple-choice questions:
- Q1: Plain meaning (pshat) — what the Torah text itself says
- Q2: Rashi's explanation — specifically what Rashi adds or clarifies${!c.hasRashi ? ' (no Rashi available — ask a second pshat question instead)' : ''}
- Q3: Understanding — combines text and Rashi to test real comprehension

Difficulty: ${diff} — ${DIFFICULTY_GUIDE[diff]}

LEGITIMACY (non-negotiable):
- Every correct answer must be explicitly stated in the text above — no outside knowledge
- Wrong options must be plausible but clearly wrong based on the text
- Do not ask about anything not covered in the text above

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function tanyaPrompt(c, diff) {
  return `You are generating quiz questions for a Jewish daily learning app. The user just read this Tanya section.

CONTENT — ${c.sectionLabel}:
${c.text}

Generate exactly 3 multiple-choice questions:
- Q1: The main concept — what specific teaching does the Alter Rebbe present?
- Q2: The reasoning — what argument or explanation does he give?
- Q3: Implication — what follows from this teaching?

Difficulty: ${diff} — ${DIFFICULTY_GUIDE[diff]}

LEGITIMACY (non-negotiable):
- Every correct answer must be directly stated or clearly implied in the text above
- Tanya concepts are precise — do not paraphrase in ways that shift the meaning
- Wrong options should use real Chassidic concepts that are NOT what this passage says

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function rambamPrompt(c, diff) {
  return `You are generating quiz questions for a Jewish daily learning app. The user just read these halachos.

CONTENT — ${c.sectionLabel}:
${c.text}

Generate exactly 3 multiple-choice questions:
- Q1: A specific ruling — what does the Rambam rule in a particular case?
- Q2: A condition or distinction — when does it apply vs. not apply?
- Q3: The reason — what reasoning does the Rambam give?

Difficulty: ${diff} — ${DIFFICULTY_GUIDE[diff]}

LEGITIMACY (non-negotiable — halacha must be exact):
- Every correct answer must match exactly what the Rambam writes above
- Do not soften, generalize, or round off rulings
- Wrong options should describe real halachic positions that differ from what this Rambam says
- If text covers multiple halachos, spread questions across them

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function mitzvosPrompt(c, diff) {
  return `You are generating quiz questions for a Jewish daily learning app. The user just studied this mitzvah.

CONTENT — ${c.sectionLabel}:
${c.text}

Generate exactly 3 multiple-choice questions:
- Q1: What the mitzvah requires or prohibits
- Q2: Its Torah source or scope
- Q3: A specific condition, exception, or application

Difficulty: ${diff} — ${DIFFICULTY_GUIDE[diff]}

LEGITIMACY: Base questions on the text. If minimal text, use accurate knowledge of this specific mitzvah only.

Respond ONLY with a JSON array, no markdown:
[{"q":"...","options":["...","...","...","..."],"answer":0},...]`;
}

function weeklyPrompt(sections, diff) {
  const content = sections.map(s => `=== ${s.label} ===\n${s.text}`).join('\n\n');
  return `You are generating a weekly review quiz for a Jewish daily learning app.

THIS WEEK'S CONTENT:
${content}

Generate exactly 10 multiple-choice questions — 3-4 Chumash, 3 Tanya, 3-4 Rambam.
Difficulty: ${diff} — ${DIFFICULTY_GUIDE[diff]}

LEGITIMACY: Every correct answer must be in the text above. Tag each with "subject": "Chumash"/"Tanya"/"Rambam".

Respond ONLY with a JSON array, no markdown:
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
