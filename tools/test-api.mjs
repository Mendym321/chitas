/**
 * End-to-end tests of api/quiz.js, api/tanya-enhance.js and api/delete-account.js with pretend
 * Sefaria, Claude and Firebase (no internet or API keys needed). Checks
 * sign-in, the quote check, verbatim Tanya text, saving results so they're
 * shared, admin-only regenerate, and the daily limits.
 * Run:  cd tools && npm run test:api
 */
import { mock } from 'node:test';
import { createServer } from 'node:http';

// ── Pretend Firebase: an in-memory Firestore and "token-<uid>" sign-in ──────
const store = new Map();
const deletedAuth = [];
const docRef = (col, id) => ({
  async get() { const k = col + '/' + id; return { exists: store.has(k), data: () => store.get(k) }; },
  async set(v) { store.set(col + '/' + id, v); },
  async create(v) { const k = col + '/' + id; if (store.has(k)) throw new Error('ALREADY_EXISTS'); store.set(k, v); },
  async delete() { store.delete(col + '/' + id); },
});
mock.module('../api/_lib/firebase.js', { namedExports: {
  getDb: () => ({
    collection: col => ({ doc: id => docRef(col, id) }),
    runTransaction: fn => fn({ get: r => r.get(), set: (r, v) => r.set(v) }),
  }),
  verifyUser: async req => (req.headers.authorization || '').match(/^Bearer token-(\w+)$/)?.[1] || null,
  verifyUserToken: async req => { const u = (req.headers.authorization || '').match(/^Bearer token-(\w+)$/)?.[1]; return u ? { uid: u, email: u + '@example.com' } : null; },
  isAdmin: who => who?.uid === 'admin',
  deleteAuthUser: async uid => { deletedAuth.push(uid); },
}});

// ── Pretend Vercel background work: collect it so tests can wait for it ──────
const background = [];
mock.module('@vercel/functions', { namedExports: { waitUntil: p => background.push(p) } });
const finishBackground = () => Promise.allSettled(background.splice(0));

// ── Pretend Claude: answers with 5 questions, one with a made-up quote ──────
let claudeCalls = 0;
const fakeQuiz = { questions: [
  { question: 'What did G-d plant?', options: ['A garden in Eden', 'A vineyard', 'A forest', 'Wheat'], correctIndex: 0, explanation: 'The verse says He planted a garden.', quote: 'planted a garden in Eden' },
  { question: 'Where did the river go out from?', options: ['Eden', 'Egypt', 'Sinai', 'Canaan'], correctIndex: 0, explanation: 'It went out of Eden.', quote: 'a river went out of Eden' },
  { question: 'What was man formed from?', options: ['Dust of the ground', 'Water', 'Fire', 'Light'], correctIndex: 0, explanation: 'Dust.', quote: 'dust of the ground' },
  { question: 'What did Rashi say?', options: ['Something invented', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x', quote: 'this sentence is not in the passage at all' },
  { question: 'Who was put in the garden?', options: ['The man', 'An angel', 'Noach', 'Moshe'], correctIndex: 0, explanation: 'He put the man there.', quote: 'there He put the man' },
]};
const claude = createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    claudeCalls++;
    claude.lastRequest = JSON.parse(body);
    const answer = JSON.stringify(claude.lastRequest.system.includes('PIECES') ? (tanyaAnswers.shift() || fakeSplits) : fakeQuiz);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
      content: [{ type: 'text', text: answer }],
      stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 },
    }));
  });
}).listen(0);
process.env.ANTHROPIC_BASE_URL = 'http://localhost:' + claude.address().port;
process.env.ANTHROPIC_API_KEY = 'test-key';

const tanyaAnswers = [];   // queued answers for particular tests (then fakeSplits)
// Pretend Claude for Tanya: a good split (typed without vowels, with a heading),
// a made-up start, a recap and a summary
const fakeSplits = { chapterIntro: 'should be dropped mid-chapter', recap: 'So far: every Jew has two souls.', summary: 'The Alter Rebbe continues explaining the two souls.', segments: [
  { index: 1, heading: 'Two souls', splits: [{ he: 'נפש אחת היא', en: 'One soul comes', heading: 'The first soul' }, { he: 'מילים שלא קיימות', en: 'The second soul', heading: 'never shown' }] },
  { index: 2, heading: '', splits: [] },
]};

// ── Pretend Sefaria ──────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.includes('sefaria.org')) return realFetch(url, opts);
  if (u.includes('/api/calendars')) {
    // Tanya Yomi: chapter 1 from verse 2 every day except the 3rd day, which is chapter 2
    // …and today is always chapter 1 from verse 2 to its end (tomorrow starts chapter 2)
    const [, y, m, d] = u.match(/year=(\d+)&month=(\d+)&day=(\d+)/).map(Number);
    const iso = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const tmrw = new Date(now + 'T12:00:00Z'); tmrw.setUTCDate(tmrw.getUTCDate() + 1);
    const day = d;
    const url = iso === now ? 'Tanya,_Part_I;_Likkutei_Amarim.1.2' : iso === tmrw.toISOString().slice(0, 10) ? 'Tanya,_Part_I;_Likkutei_Amarim.2.1' : day % 3 === 0 ? 'Tanya,_Part_I;_Likkutei_Amarim.2.1' : 'Tanya,_Part_I;_Likkutei_Amarim.1.' + (day % 3 === 1 ? 2 : 3);
    return new Response(JSON.stringify({ calendar_items: [{ title: { en: 'Tanya Yomi' }, url }] }), { headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('/api/texts/Tanya')) return new Response(JSON.stringify({
    he: ['ראשון', 'וְהִנֵּה בְּכָל נֶפֶשׁ יִשְׂרָאֵל יֵשׁ שְׁתֵּי נְפָשׁוֹת. נֶפֶשׁ אַחַת הִיא מִצַּד הַקְּלִיפָּה. ונפש השנית היא חלק אלוק ממעל ממש.', '<small>הגהה<br>הערה</small>'],
    text: ['First', 'Every Jew has two souls.<sup class="footnote-marker">1</sup><i class="footnote"> See ch. <i>2</i>.</i> One soul comes from the kelipah. The second soul is truly a part of G-d above.', '<small>NOTE: a gloss</small>'],
  }), { headers: { 'content-type': 'application/json' } });
  const text = u.includes('Rashi')
    ? ['<b>a garden</b> Rashi explains<sup class="footnote-marker">1</sup><i class="footnote">a note</i> the garden.']
    : ['And the Lord God formed man of dust of the ground.', 'And the Lord God planted a garden in Eden from the east, and there He put the man whom He had formed.', 'And a river went out of Eden to water the garden.'];
  return new Response(JSON.stringify({ versions: [{ language: 'en', text }] }), { headers: { 'content-type': 'application/json' } });
};

const { default: handler } = await import('../api/quiz.js');
const { default: tanyaHandler } = await import('../api/tanya-enhance.js');
const { tanyaPortion } = await import('../api/_lib/tanya-portion.js');
const fakeRes = () => { const r = { status(s) { r.code = s; return r; }, json(j) { r.body = j; return r; } }; return r; };
async function call(body, token = 'token-u1', method = 'POST') {
  const res = fakeRes();
  await handler({ method, body, headers: token ? { authorization: 'Bearer ' + token } : {} }, res);
  return { status: res.code, json: res.body };
}
async function tanya(query, token = 'token-u1') {
  const res = fakeRes();
  await tanyaHandler({ method: 'GET', query, headers: token ? { authorization: 'Bearer ' + token } : {} }, res);
  return { status: res.code, json: res.body };
}

let failed = 0;
function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}

console.log('Quiz API:');
const BODY = { section: 'chumash', level: 'quick', refs: ['Genesis 2:4-2:19'] };
check('not signed in → 401', (await call(BODY, null)).status, 401);
check('bad ref → 400 (and no AI call)', [(await call({ ...BODY, refs: ['hello'] })).status, claudeCalls], [400, 0]);

const first = await call(BODY);
check('signed in → 200', first.status, 200);
check('the question with a made-up quote was dropped; quick review = 4', first.json.questions.length, 4);
check('no dropped question slipped through', first.json.questions.some(q => q.q === 'What did Rashi say?'), false);
check('every "answer" points at the right option', first.json.questions.map(q => q.options[q.answer]),
  ['A garden in Eden', 'Eden', 'Dust of the ground', 'The man']);
check('Claude got the verses AND Rashi (footnotes stripped)', [claude.lastRequest.messages[0].content.includes('planted a garden'), claude.lastRequest.messages[0].content.includes('Rashi explains the garden')], [true, true]);
check('uses Opus 5.5 with structured output', [claude.lastRequest.model, claude.lastRequest.output_config?.format?.type], ['claude-opus-5-5', 'json_schema']);

const second = await call(BODY, 'token-u2');
check('second person, same passage → saved quiz, no new AI call', [second.status, second.json.cached, claudeCalls], [200, true, 1]);

// Daily limit: 20 new quizzes per person
for (let i = 1; i <= 19; i++) await call({ ...BODY, refs: ['Genesis 2:' + (i + 4) + '-2:19'] });
check('21st new quiz in a day → 429', (await call({ ...BODY, refs: ['Genesis 3:1-3:21'] })).status, 429);
check('…but saved quizzes still work', (await call(BODY)).status, 200);

console.log('Tanya enhance:');
// Today on the (pretend) schedule: chapter 1 from verse 2 to its end
const todayNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const P = await tanyaPortion(todayNY);
check('portion coordinates match the app (ends before tomorrow\'s start / runs to chapter end)',
  [await tanyaPortion('2031-03-01'), await tanyaPortion('2031-03-02'), P],
  [{ chapterSlug: 'Tanya,_Part_I;_Likkutei_Amarim.1', startVerse: 2, endVerse: 2 }, { chapterSlug: 'Tanya,_Part_I;_Likkutei_Amarim.1', startVerse: 3, endVerse: null },
   { chapterSlug: 'Tanya,_Part_I;_Likkutei_Amarim.1', startVerse: 2, endVerse: null }]);
const T = { date: todayNY };
check('bad date → 400', (await tanya({ date: 'tomorrow' })).status, 400);
const calls0 = claudeCalls;
check('a date far from today is never prepared (no AI cost)', [(await tanya({ date: '2020-01-01' }, null)).status, claudeCalls - calls0], [403, 0]);

const { guideDocId } = await import('../api/_lib/tanya-guide.js');
const lockKey = 'tanya_locks/' + guideDocId(P.chapterSlug, P.startVerse, P.endVerse);
store.set(lockKey, { at: Date.now(), state: 'preparing' });
check('while someone else prepares it → 202, no second AI call', [(await tanya(T, null)).status, background.length, claudeCalls - calls0], [202, 0, 0]);
store.set(lockKey, { at: Date.now() - 600000, state: 'preparing' });   // a stale lock from a run that died is ignored

const tFirst = await tanya(T, null);
check('first person (signed out) → 202 at once, preparing in the background', [tFirst.status, tFirst.json.preparing, background.length], [202, true, 1]);
await finishBackground();
check('…one AI call, and the lock is released', [claudeCalls - calls0, store.has(lockKey)], [1, false]);
const t1 = await tanya(T, null);
check('asking again → the saved guide (no AI call), with the portion it is for', [t1.status, t1.json.source, t1.json.startVerse, claudeCalls - calls0], [200, 'cache', 2, 1]);
check('split at the real start only (vowels ignored); the made-up one is ignored', t1.json.blocks.map(b => b.en.replace(/\uE000\d+\uE001/g, '[n]')),
  ['Every Jew has two souls.[n]', 'One soul comes from the kelipah. The second soul is truly a part of G-d above.', 'a gloss']);
check('Hebrew is the exact original text', t1.json.blocks.slice(0, 2).map(b => b.he).join(' '),
  'וְהִנֵּה בְּכָל נֶפֶשׁ יִשְׂרָאֵל יֵשׁ שְׁתֵּי נְפָשׁוֹת. נֶפֶשׁ אַחַת הִיא מִצַּד הַקְּלִיפָּה. ונפש השנית היא חלק אלוק ממעל ממש.');
check('the Alter Rebbe\'s gloss (hagahah) is marked, without its label', [t1.json.blocks.map(b => b.isHagahah), t1.json.blocks[2].he], [[false, false, true], 'הערה']);
check('headings: on the segment and on the cut that was found', t1.json.blocks.map(b => b.heading || ''), ['Two souls', 'The first soul', '']);
check('translator\'s footnote kept as a note', t1.json.notes, ['See ch. 2.']);
check('mid-chapter: recap and summary, no chapter intro', [t1.json.recap, t1.json.summary, t1.json.intro], ['So far: every Jew has two souls.', 'The Alter Rebbe continues explaining the two souls.', '']);
check('the real cost of each guide is kept with it', t1.json.source === 'cache' && typeof store.get('tanya_enhanced/' + guideDocId(P.chapterSlug, P.startVerse, P.endVerse)).usage?.costUSD, 'number');
check('the AI read the text without footnote markers', claude.lastRequest.messages[0].content.includes('\uE000'), false);

// A failed run is not retried right away (a lasting problem can't keep costing money)
const tmrwDate = new Date(todayNY + 'T12:00:00Z'); tmrwDate.setUTCDate(tmrwDate.getUTCDate() + 1);
const tomorrowISO = tmrwDate.toISOString().slice(0, 10);
const realFetch2 = globalThis.fetch;
globalThis.fetch = async (u, o) => String(u).includes('/api/texts/') ? new Response('{}', { headers: { 'content-type': 'application/json' } }) : realFetch2(u, o);
const f1 = await tanya({ date: tomorrowISO }, null); await finishBackground();
const f2 = await tanya({ date: tomorrowISO }, null);
globalThis.fetch = realFetch2;
check('a failed run → the next ask says why (502), without trying again', [f1.status, f2.status, /failed/.test(f2.json.error), background.length], [202, 502, true, 0]);

// The AI numbered segments by the chapter (2, 3) instead of 1, 2 → still lined up
const byChapter = JSON.parse(JSON.stringify(fakeSplits)); byChapter.segments.forEach(x => { x.index += P.startVerse - 1; });
// …and a first answer with no cuts or headings → asked once more, the better one kept
tanyaAnswers.push({ ...fakeSplits, segments: [] }, byChapter);
const callsR = claudeCalls;
await tanya({ ...T, bust: '1' }, 'token-admin'); await finishBackground();
const r1 = await tanya(T, null);
check('poor first answer → asked once more; chapter-numbered segments still line up', [claudeCalls - callsR, r1.json.blocks.map(b => b.heading || '')], [2, ['Two souls', 'The first soul', '']]);

check('prepare again (bust) by a normal user → 403', (await tanya({ ...T, bust: '1' })).status, 403);
const callsB = claudeCalls;
const b1 = await tanya({ ...T, bust: '1' }, 'token-admin'); await finishBackground();
check('prepare again by an admin → prepared again', [b1.status, claudeCalls - callsB], [202, 1]);

claude.close();
console.log('Delete account API:');
{
  const { default: del } = await import('../api/delete-account.js');
  const run = async (token, method = 'POST') => { const res = fakeRes(); await del({ method, headers: token ? { authorization: 'Bearer ' + token } : {} }, res); return res; };
  store.set('users/u9', { name: 'Someone' }); store.set('quiz_usage/u9', { n: 2 }); store.set('tanya_usage/u9', { n: 1 }); store.set('users/u8', { name: 'Someone else' });
  check('not signed in → 401, nothing deleted', [(await run(null)).code, store.has('users/u9')], [401, true]);
  check('GET → 405', (await run('token-u9', 'GET')).code, 405);
  const r = await run('token-u9');
  check('deletes their data and their sign-in, only theirs', [r.code, store.has('users/u9'), store.has('quiz_usage/u9'), store.has('tanya_usage/u9'), deletedAuth, store.has('users/u8')], [200, false, false, false, ['u9'], true]);
}

console.log(failed ? `\n${failed} FAILED` : '\nAll API tests passed');
process.exit(failed ? 1 : 0);
