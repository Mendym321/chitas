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
 *
 * Shared reviews ({ ..., shared: true }): someone sent a friend their result,
 * and the friend answers the same questions, with no account. Such a request
 * only ever READS a saved quiz: it never makes one, so a shared link can't
 * cost anything. 404 when that quiz isn't saved.
 *
 * Short links: { makeShare: { s, l, p, r, n, d, k, nm } } saves what a shared
 * link needs (the passage, the score, the day, and the sharer's first name if
 * they chose to show it: letters only, up to 20) under a short code, kept in
 * share_links/, and answers { id }. The same result
 * gets the same code. Up to 60 a day per address (hashed). { shareId } reads
 * it back with the saved questions: { share, questions, level }.
 *
 * GET ?page=<code> (the link chitas.vercel.app/r/<code>, by a rewrite): a tiny
 * page that sends people on to the app, with the tags WhatsApp, iMessage and
 * the rest read for a link preview. GET ?img=<code>: that preview picture,
 * drawn here from the saved result (api/_lib/share-card.js). Everything on
 * the picture and the page is worked out here from the passage; nothing a
 * phone sends is printed on it.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createHash } from 'node:crypto';
import { getDb, verifyUser } from './_lib/firebase.js';
import { takeDailyQuota } from './_lib/quota.js';
import { englishSegments, tanyaSegments } from './_lib/sefaria.js';
import { LEVELS, validateQuizRequest, checkQuestions } from './_lib/quiz-core.js';
// The preview-picture tools are loaded only when a picture is asked for, so the
// quiz itself never depends on them
const SHARE_CARD_SIZE = { width: 1200, height: 630 };
const shareCard = () => import('./_lib/share-card.js');

export const config = { maxDuration: 60 };

const MODEL = 'claude-opus-5-5';
const CACHE_VERSION = 'v2';   // v2: options alike in length (the longest was usually the answer)          // bump to regenerate every saved quiz
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
- Make the 4 options alike in length, grammar and detail, within a few words of each other, so nothing but the content gives the answer away. Write each wrong option as fully and specifically as the right one. The right answer must not be the longest or the most carefully worded: sometimes make it the shortest.
- "explanation": 1–2 warm, plain sentences that teach why the answer is right, pointing back to the text.
- Spread the questions across the whole passage, in the order it is learned.
- Write respectfully, the way the passage itself does (for example "G-d" if it writes that).`;

const LEVEL_TEXT = {
  quick: `Level: Quick review. Write ${LEVELS.quick.count + 2} questions on the main points — what happened or was said, who did what, what the law is, the central idea. Keep the wording simple and direct.`,
  deep: `Level: Deep dive. Write ${LEVELS.deep.count + 2} questions that test understanding, not just recall — why something is so; for Chumash, what Rashi is bothered by and how he answers; for Tanya, the reasoning and the analogies; for Rambam, how similar cases differ and why. Make the wrong options close but wrong.`,
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

// The portion's name, from the passage itself: "Bereishis 32:31–33:5",
// "Kuntres Acharon 6", "Creditor and Debtor 4–6"
const BOOKS = { Genesis: 'Bereishis', Exodus: 'Shemos', Leviticus: 'Vayikra', Numbers: 'Bamidbar', Deuteronomy: 'Devarim' };
export function passageLabel(s, p) {
  if (s === 'tanya') {
    const m = String(p?.tanya?.chapterSlug || '').match(/;_?([A-Za-z_']+)\.(\d+)$/);
    return m ? m[1].replace(/_/g, ' ') + ' ' + m[2] : 'Tanya';
  }
  const refs = (p?.refs || []).map(String);
  if (s === 'chumash') return refs.map(r => r.replace(/^(\w+)/, b => BOOKS[b] || b).replace(/-/g, '–')).join(' · ');
  const parts = refs.map(r => r.replace(/^Mishneh Torah, /, '').match(/^(.*) (\d+)$/)).filter(Boolean);
  if (parts.length && parts.every(x => x[1] === parts[0][1]))
    return parts[0][1] + ' ' + parts[0][2] + (parts.length > 1 ? '–' + parts.at(-1)[2] : '');
  return parts.map(x => x[1] + ' ' + x[2]).join(', ');
}
// A first name, as letters only (any alphabet), with a space, ' or - inside; up to 20
export function cleanName(v) {
  const s = String(v || '').normalize('NFC').trim().split(/\s+/)[0] || '';
  return /^[\p{L}][\p{L}'\-]{0,19}$/u.test(s) ? s : '';
}
const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const SEC_NAME = { chumash: 'Chumash', tanya: 'Tanya', rambam: 'Rambam' };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const quizDocId = key => createHash('sha256').update(key + '|' + CACHE_VERSION).digest('hex').slice(0, 40);
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const shortCode = str => { let n = BigInt('0x' + createHash('sha256').update(str).digest('hex').slice(0, 16)), out = ''; for (let i = 0; i < 8; i++) { out += B62[Number(n % 62n)]; n /= 62n; } return out; };

async function makeShare(req, res) {
  const b = req.body.makeShare || {};
  if (b.day) return makeDayShare(req, res, b);
  const q = validateQuizRequest({ section: b.s, level: b.l, ...(b.p || {}) });
  const r = Number(b.r), n = Number(b.n);
  if (q.error || !Number.isInteger(n) || n < 1 || n > 10 || !Number.isInteger(r) || r < 0 || r > n || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.d)))
    return res.status(400).json({ error: 'bad share' });
  const share = { s: q.section, l: q.level, p: q.section === 'tanya' ? { tanya: q.tanya } : { refs: q.refs }, r, n, d: String(b.d), k: b.k === 'challenge' ? 'challenge' : 'score' };
  const nm = cleanName(b.nm);
  if (nm) share.nm = nm;   // shown as "Mendy got 3 of 4" on the friend's page; never on the picture
  try {
    const db = getDb();
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (!await takeDailyQuota(db, 'ip-' + createHash('sha256').update(ip).digest('hex').slice(0, 24), 'shares', 60)) return res.status(429).json({ error: 'enough for today' });
    const id = shortCode(JSON.stringify(share));
    await db.collection('share_links').doc(id).set({ ...share, createdAt: new Date().toISOString() });
    return res.status(200).json({ id });
  } catch (e) { console.error('quiz share:', e.message); return res.status(502).json({ error: 'not saved' }); }
}
// A short link's result and its saved questions, or { status, error }
// A finished day ("All four done"): { day: true, d, st (the streak), nm }
async function makeDayShare(req, res, b) {
  const st = Number(b.st);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.d)) || !Number.isInteger(st) || st < 0 || st > 10000) return res.status(400).json({ error: 'bad share' });
  const share = { kind: 'day', d: String(b.d), st };
  const nm = cleanName(b.nm);
  if (nm) share.nm = nm;
  try {
    const db = getDb();
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (!await takeDailyQuota(db, 'ip-' + createHash('sha256').update(ip).digest('hex').slice(0, 24), 'shares', 60)) return res.status(429).json({ error: 'enough for today' });
    const id = shortCode(JSON.stringify(share));
    await db.collection('share_links').doc(id).set({ ...share, createdAt: new Date().toISOString() });
    return res.status(200).json({ id });
  } catch (e) { console.error('quiz day share:', e.message); return res.status(502).json({ error: 'not saved' }); }
}
async function loadShare(id) {
  if (!/^[0-9A-Za-z]{8}$/.test(String(id))) return { status: 400, error: 'bad link' };
  const db = getDb();
  const doc = await db.collection('share_links').doc(id).get();
  if (!doc.exists) return { status: 404, error: 'This link isn\'t available any more' };
  const { createdAt, ...share } = doc.data();
  if (share.kind === 'day') return { share, questions: [] };
  const q = validateQuizRequest({ section: share.s, level: share.l, ...share.p });
  if (q.error) return { status: 404, error: 'This link isn\'t available any more' };
  const hit = await db.collection('quiz_cache').doc(quizDocId(q.key)).get();
  if (!hit.exists) return { status: 404, error: 'These questions aren\'t available any more' };
  return { share: { ...share, t: passageLabel(share.s, share.p) }, questions: hit.data().questions, level: q.level };
}
async function readShare(req, res) {
  try {
    const x = await loadShare(req.body.shareId);
    if (x.error) return res.status(x.status).json({ error: x.error });
    return res.status(200).json(x);
  } catch (e) { console.warn('quiz share read:', e.message); return res.status(502).json({ error: 'Couldn\'t load the questions' }); }
}
// The link preview: the picture, and the page that carries it
async function shareImage(req, res) {
  try {
    const x = await loadShare(req.query.img);
    if (x.error) return res.status(x.status).send(x.error);
    const { shareCardPng } = await shareCard();
    const png = await shareCardPng({ ...x.share, q: x.questions[0]?.q || '' }, todayNY());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).send(png);
  } catch (e) { console.error('share image:', e); return res.status(502).send('not drawn: ' + String(e?.message || e).slice(0, 300)); }   // the reason, to put it right
}
async function sharePage(req, res) {
  const code = String(req.query.page || '');
  const host = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'chitas.vercel.app');
  let x = null;
  try { x = await loadShare(code); } catch (e) {}
  const go = host + '/?r=' + encodeURIComponent(/^[0-9A-Za-z]{8}$/.test(code) ? code : '');
  const ok = x && !x.error;
  // The preview sits in the sharer's own message, so it speaks as them ("I got…");
  // the page the friend opens names them (the app, index.html)
  const day = ok && x.share.kind === 'day';
  const title = !ok ? 'Chitas'
    : day ? 'I learned all of today\'s Chitas' + (x.share.st > 1 ? ' · ' + x.share.st + ' days in a row' : '')
    : 'I got ' + x.share.r + ' of ' + x.share.n + ' on the ' + SEC_NAME[x.share.s] + ' review. Can you ' + (x.share.r === x.share.n ? 'too?' : 'beat it?');
  const desc = !ok || day ? 'Chumash, Tehillim, Tanya and Rambam, ready each day. Learn it with me, free.' : x.share.t + ' · The same ' + x.share.n + ' questions, free on Chitas';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + esc(title) + '</title>'
    + '<meta property="og:type" content="website"><meta property="og:site_name" content="Chitas">'
    + '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">'
    + '<meta property="og:url" content="' + esc(host + '/r/' + code) + '">'
    + (ok ? '<meta property="og:image" content="' + esc(host + '/api/quiz?img=' + code) + '"><meta property="og:image:width" content="' + SHARE_CARD_SIZE.width + '"><meta property="og:image:height" content="' + SHARE_CARD_SIZE.height + '"><meta property="og:image:alt" content="' + esc(title) + '"><meta name="twitter:card" content="summary_large_image">' : '')
    + '<meta http-equiv="refresh" content="0;url=' + esc(go) + '"></head><body style="font-family:sans-serif;background:#FBF7EF;color:#2B2112">'
    + '<p><a href="' + esc(go) + '">Open Chitas</a></p><script>location.replace(' + JSON.stringify(go) + ')</script></body></html>');
}

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query?.img) return shareImage(req, res);
  if (req.method === 'GET' && req.query?.page !== undefined) return sharePage(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (req.body?.makeShare) return makeShare(req, res);
  if (typeof req.body?.shareId === 'string') return readShare(req, res);
  if (req.body?.shared === true) {
    const q = validateQuizRequest(req.body);
    if (q.error) return res.status(400).json({ error: q.error });
    try {
      const hit = await getDb().collection('quiz_cache').doc(createHash('sha256').update(q.key + '|' + CACHE_VERSION).digest('hex').slice(0, 40)).get();
      if (hit.exists) return res.status(200).json({ questions: hit.data().questions, level: q.level, shared: true });
    } catch (e) { console.warn('quiz shared read:', e.message); return res.status(502).json({ error: 'Couldn\'t load the questions' }); }
    return res.status(404).json({ error: 'These questions aren\'t available any more' });
  }

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
