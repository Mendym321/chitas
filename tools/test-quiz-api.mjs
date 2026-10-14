/**
 * End-to-end test of api/quiz.js with pretend Sefaria, Claude and Firebase
 * (no internet or API keys needed). Checks sign-in, the quote check, saving
 * the quiz so it's shared, and the daily limit.
 * Run:  cd tools && npm run test:api
 */
import { mock } from 'node:test';
import { createServer } from 'node:http';

// ── Pretend Firebase: an in-memory Firestore and "token-<uid>" sign-in ──────
const store = new Map();
const docRef = (col, id) => ({
  async get() { const k = col + '/' + id; return { exists: store.has(k), data: () => store.get(k) }; },
  async set(v) { store.set(col + '/' + id, v); },
});
mock.module('../api/_lib/firebase.js', { namedExports: {
  getDb: () => ({
    collection: col => ({ doc: id => docRef(col, id) }),
    runTransaction: fn => fn({ get: r => r.get(), set: (r, v) => r.set(v) }),
  }),
  verifyUser: async req => (req.headers.authorization || '').match(/^Bearer token-(\w+)$/)?.[1] || null,
}});

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
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
      content: [{ type: 'text', text: JSON.stringify(fakeQuiz) }],
      stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 },
    }));
  });
}).listen(0);
process.env.ANTHROPIC_BASE_URL = 'http://localhost:' + claude.address().port;
process.env.ANTHROPIC_API_KEY = 'test-key';

// ── Pretend Sefaria ──────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.includes('sefaria.org')) return realFetch(url, opts);
  const text = u.includes('Rashi')
    ? ['<b>a garden</b> Rashi explains<sup class="footnote-marker">1</sup><i class="footnote">a note</i> the garden.']
    : ['And the Lord God formed man of dust of the ground.', 'And the Lord God planted a garden in Eden from the east, and there He put the man whom He had formed.', 'And a river went out of Eden to water the garden.'];
  return new Response(JSON.stringify({ versions: [{ language: 'en', text }] }), { headers: { 'content-type': 'application/json' } });
};

const { default: handler } = await import('../api/quiz.js');
async function call(body, token = 'token-u1', method = 'POST') {
  let status, json;
  const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  await handler({ method, body, headers: token ? { authorization: 'Bearer ' + token } : {} }, res);
  return { status, json };
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

claude.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll quiz API tests passed');
process.exit(failed ? 1 : 0);
