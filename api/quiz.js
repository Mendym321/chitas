/**
 * POST /api/quiz — a short quiz on exactly what the user learned today.
 *
 * Body:  { section: 'chumash'|'tanya'|'rambam', level: 'quick'|'deep',
 *          refs: [...] (Chumash/Rambam) | tanya: { chapterSlug, startVerse, endVerse } }
 * Header: Authorization: Bearer <Firebase ID token>   (signed-in users only)
 * Returns: { questions: [{ q, options[4], answer, explanation, quote }], level }
 *
 * How it stays accurate and cheap:
 *  - The server fetches the text itself from Sefaria (the app only says WHICH passage).
 *  - Claude must quote the line that proves each answer; questions whose quote
 *    isn't really in the text are dropped (api/_lib/quiz-core.js).
 *  - One quiz per passage + level is saved in Firestore and shared by everyone,
 *    so most requests never call the AI. New quizzes are limited per user per day.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createHash } from 'node:crypto';
import { getDb, verifyUser } from './_lib/firebase.js';
import { takeDailyQuota } from './_lib/quota.js';
import { englishSegments, tanyaSegments } from './_lib/sefaria.js';
import { LEVELS, validateQuizRequest, checkQuestions } from './_lib/quiz-core.js';

export const config = { maxDuration: 60 };

const MODEL = 'claude-opus-5-5';
const CACHE_VERSION = 'v1';          // bump to regenerate every saved quiz
const NEW_QUIZZES_PER_DAY = 20;      // per user; saved quizzes don't count
const MAX_CHARS = 16000;             // keep the passage a sensible size

const QuizSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctIndex: z.number().int(),
    explanation: z.string(),
    quote: z.string(),
  })),
});

const SYSTEM = `You write short multiple-choice quizzes for people doing Chitas, the daily Chabad learning cycle (Chumash with Rashi, Tanya, Rambam). The quiz comes right after they finish today's portion, to help them remember and understand it.

Rules for every question:
- It must be answerable from the passage alone, not from outside knowledge.
- "quote": copy 5–25 consecutive words from the passage, exactly as written, that show the answer is right.
- Exactly 4 options with one correct answer ("correctIndex" is 0–3). Wrong options should tempt someone who skimmed but be clearly wrong to someone who read carefully. No "all of the above" or "none of the above".
- "explanation": 1–2 warm, plain sentences that teach why the answer is right, pointing back to the text.
- Spread the questions across the whole passage, in the order it is learned.
- Write respectfully, the way the passage itself does (for example "G-d" if it writes that).`;

const LEVEL_TEXT = {
  quick: `Level: Quick review. Write ${LEVELS.quick.count} questions on the main points — what happened or was said, who did what, what the law is, the central idea. Keep the wording simple and direct.`,
  deep: `Level: Deep dive. Write ${LEVELS.deep.count} questions that test understanding, not just recall — why something is so; for Chumash, what Rashi is bothered by and how he answers; for Tanya, the reasoning and the analogies; for Rambam, how similar cases differ and why. Make the wrong options close but wrong.`,
};

async function fetchPassage(req) {
  if (req.section === 'tanya') {
    const t = req.tanya;
    return { label: 'Tanya', text: (await tanyaSegments(t.chapterSlug, t.startVerse, t.endVerse)).join('\n') };
  }
  if (req.section === 'rambam') {
    const parts = await Promise.all(req.refs.map(async r => r + '\n' + (await englishSegments(r)).map((h, i) => `(${i + 1}) ${h}`).join('\n')));
    return { label: 'Rambam (Mishneh Torah)', text: parts.join('\n\n') };
  }
  // Chumash: each verse followed by Rashi on it, when Sefaria has it
  const parts = await Promise.all(req.refs.map(async ref => {
    const [verses, rashi] = await Promise.all([
      englishSegments(ref),
      englishSegments('Rashi on ' + ref).catch(() => []),
    ]);
    return ref + '\n' + verses.join('\n') + (rashi.length ? '\n\nRashi on ' + ref + ':\n' + rashi.join('\n') : '');
  }));
  return { label: 'Chumash with Rashi', text: parts.join('\n\n') };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Please sign in to take quizzes' });

  const q = validateQuizRequest(req.body);
  if (q.error) return res.status(400).json({ error: q.error });

  const db = getDb();
  const cacheDoc = db.collection('quiz_cache').doc(createHash('sha256').update(q.key + '|' + CACHE_VERSION).digest('hex').slice(0, 40));
  try {
    const hit = await cacheDoc.get();
    if (hit.exists) return res.status(200).json({ questions: hit.data().questions, level: q.level, cached: true });
  } catch (e) { console.warn('quiz cache read:', e.message); }

  if (!(await takeDailyQuota(db, uid, 'quiz', NEW_QUIZZES_PER_DAY))) return res.status(429).json({ error: 'That\'s a lot of quizzes for one day — try again tomorrow' });

  let passage;
  try { passage = await fetchPassage(q); }
  catch (e) { console.error('quiz passage:', e.message); return res.status(502).json({ error: 'Couldn\'t load today\'s text' }); }
  if (passage.text.length < 80) return res.status(502).json({ error: 'Couldn\'t load today\'s text' });
  const text = passage.text.slice(0, MAX_CHARS);

  let questions;
  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: zodOutputFormat(QuizSchema) },
      messages: [{ role: 'user', content: `${LEVEL_TEXT[q.level]}\n\nToday's ${passage.label}:\n<passage>\n${text}\n</passage>` }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('no quiz returned (' + response.stop_reason + ')');
    questions = checkQuestions(response.parsed_output.questions, text, q.level);
  } catch (e) {
    console.error('quiz generate:', e.message);
    return res.status(502).json({ error: 'Couldn\'t make a quiz right now — try again in a minute' });
  }

  if (questions.length < LEVELS[q.level].min) {
    console.warn('quiz: only', questions.length, 'questions passed the checks for', q.key);
    return res.status(502).json({ error: 'Couldn\'t make a good quiz for this one — try the other level' });
  }

  // Awaited: Vercel may freeze the function as soon as the reply is sent
  await cacheDoc.set({ key: q.key, questions, model: MODEL, createdAt: new Date().toISOString() })
    .catch(e => console.warn('quiz cache write:', e.message));
  return res.status(200).json({ questions, level: q.level });
}
