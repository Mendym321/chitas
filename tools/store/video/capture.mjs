// The app preview video, part 1: the real app, filmed frame by frame.
// Each scene is set up in the real app with real texts, then stepped one frame
// (1/30 s) at a time: the page's clock moves exactly one frame, and every CSS
// animation and transition is set to exactly that moment, then the frame is
// taken. So the motion is perfectly smooth, whatever this computer's speed.
// Frames go to tools/store/video/frames/<scene>/ (not kept in git).
// Usage (from tools/):  node store/video/capture.mjs [scene ...]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { SCENES as TIMING, FPS } from './timing.mjs';

const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = new URL('./frames/', import.meta.url).pathname;
const only = process.argv.slice(2);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2' };
const srv = createServer(async (q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let body;
  try { body = await readFile(ROOT + (u === '/' ? '/index.html' : u)); } catch { return r.writeHead(404).end(); }
  r.writeHead(200, { 'Content-Type': TYPES[extname(u)] || 'text/html' }).end(body);
}).listen(8860);
const BASE = 'http://localhost:8860';

// 443 × 960 at 2× is exactly Apple's 886 × 1920 for the 6.9-inch iPhone
const br = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const ctx = await br.newContext({ serviceWorkers: 'block', viewport: { width: 443, height: 960 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true });

// The same Review questions as the screenshots (store/shoot.mjs), from the day's real Chumash
const { REVIEW } = await import('../review.mjs');
const cache = new Map();
await ctx.route('**/*', async r => {
  const req = r.request(), u = req.url();
  if (u === BASE + '/api/quiz') return r.fulfill({ json: REVIEW });
  if (u.startsWith(BASE) && !u.startsWith(BASE + '/api/')) return r.continue();
  if (/gstatic\.com\/firebasejs/.test(u)) return r.abort();
  const target = u.startsWith(BASE + '/api/') ? 'https://chitas.vercel.app' + u.slice(BASE.length) : u;
  try {
    const key = req.method() + ' ' + target + ' ' + (req.postData() || '');
    let got = cache.get(key);
    if (!got) {
      const res = await fetch(target, { method: req.method(), headers: { 'content-type': req.headers()['content-type'] || 'application/json' }, body: req.method() === 'GET' ? undefined : req.postData() });
      got = { status: res.status, type: res.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await res.arrayBuffer()) };
      cache.set(key, got);
    }
    return r.fulfill({ status: got.status, contentType: got.type, body: got.body, headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch { return r.abort(); }
});

const seed = (today) => {                                          // today: what's learned so far today
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true }, pastDone = {}, pastQuizDone = {};
  for (let i = 1; i <= 46; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (d.getDay() === 6 || i === 23 || i === 31) continue;
    pastDone[iso(d)] = i === 12 || i === 27 ? { chumash: true, tehillim: true, tanya: true } : { ...ALL };
    if (i % 4 === 1) pastQuizDone[iso(d)] = { chumash: { quick: { r: i % 3 ? 4 : 3, n: 4 } } };
  }
  localStorage.setItem('chitas_v78', JSON.stringify({ uid: 'demo', name: 'Mendy Cohen', rambamTrack: '3', started: true, rambamTrackAsked: true,
    done: today, pastDone, pastQuizDone, lastDate: iso(new Date()), extraTracks: ['hayomYom'],
    tehillimFixedOpts: { rebbe: true, rebbetzin: false },
    tehillimPeople: [{ label: 'Me', heDay: 14, heMonth: 'Adar', heYear: 5752 }, { label: 'Chana', heDay: 3, heMonth: 'Tammuz', heYear: 5779 }, { label: 'Levi', heDay: 22, heMonth: 'Shevat', heYear: 5784 }] }));
  localStorage.setItem('chitas_lang_chumash', 'both'); localStorage.setItem('chitas_chumash_rashi', '1');
  localStorage.setItem('chitas_lang_tanya', 'both'); localStorage.setItem('chitas_tanya_guide', '1');
  localStorage.setItem('chitas_lang_tehillim', 'both');
};

async function open(today = { chumash: true, tehillim: true }) {
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  page error:', e.message.split('\n')[0]));
  await p.clock.install({ time: (() => { const d = new Date(); d.setHours(8, 40, 0, 0); return d; })() });
  await p.addInitScript(seed, today);
  await p.goto(BASE + '/');
  await p.waitForFunction(() => typeof init === 'function' && typeof dayNote === 'function', null, { timeout: 20000 });
  await p.evaluate(async () => { await init(); document.getElementById('main-app').classList.add('ready'); try { hideLoader(); } catch (e) {} document.getElementById('app-loader')?.remove(); });
  await p.waitForTimeout(2500);
  return p;
}
const wait = (p, ms) => p.waitForTimeout(ms);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // in and out, like a hand scrolling
const scrollTo = (p, y) => p.evaluate(y => { const r = document.getElementById('native-reader'); r.scrollTop = y; if (window._rv) _rv.touched = true; }, y);   // as a finger does: yours now, so the app doesn't put its place back
const readerY = (p, sel, off) => p.evaluate(([sel, off]) => { const r = document.getElementById('native-reader'), el = document.querySelector(sel); return el ? Math.max(0, r.scrollTop + el.getBoundingClientRect().top - r.getBoundingClientRect().top - off) : 0; }, [sel, off]);

// A text opened with its guide on, the guide's box brought to about a quarter of the way down
const guideScene = (sid, on) => ({
  today: { tehillim: true },
  lead: 20,
  setup: async p => {
    await p.evaluate(on); await p.evaluate(sid => openChabadPanel(sid), sid);
    await wait(p, 15000);                                           // everything in, and the app done putting back your place (no jump mid-scene)
    const y = await readerY(p, '#native-reader-content .tz-guide', 150); await scrollTo(p, y);
    await wait(p, 2500); await scrollTo(p, await readerY(p, '#native-reader-content .tz-guide', 150));
  },
  act: async (p, f) => {                                            // measured on the first frame filmed, once the page has settled
    if (f === 0) p._where = await p.evaluate(() => { const r = document.querySelector('#native-reader-content .tz-guide')?.getBoundingClientRect(); return { guide: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null }; });
  },
});

// Each scene: set up (time flows), then act(frame) once per frame while filmed
const SCENES = {
  today: {
    setup: async p => { await wait(p, 4000); },                    // the tiles name the day's pieces once their texts are in
    act: async (p, f) => {                                          // marking, then the list drawn again, as the tick's own flow does
      if (f === 14) await p.evaluate(() => { markDone('tanya'); renderSectionsForOffset(_viewedISO()); });
      if (f === 44) await p.evaluate(() => { markDone('rambam'); renderSectionsForOffset(_viewedISO()); });
    },
  },
  // Keeping your place, all real: reading Chumash with Rashi; the text closed (back to Today, in
  // the morning); later that day (the greeting turns to afternoon); Chumash tapped open again:
  // the same line. Where the Chumash tile is goes next to the frames, for the tap mark.
  place: {
    today: { tehillim: true },
    setup: async p => { await p.evaluate(() => openChabadPanel('chumash')); await wait(p, 6000);
      p._at = await p.evaluate(() => { const r = document.getElementById('native-reader'); return Math.round((r.scrollHeight - r.clientHeight) * .22); });
      await scrollTo(p, p._at - 120); },
    act: async (p, f) => {
      if (f < 15) await scrollTo(p, Math.round(p._at - 120 + 120 * ease(f / 14)));                           // reading on a little, then resting on a line
      if (f === 57) {                                                                                       // closed: back to Today; the place is kept
        await p.evaluate(() => { _rv.touched = true; closeChabadPanel(); });
        p._where = await p.evaluate(() => { const r = document.getElementById('card-chumash').getBoundingClientRect(); return { chumash: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] }; });
      }
      if (f === 90) { const d = new Date(await p.evaluate(() => Date.now())); d.setHours(14, 10); await p.clock.setSystemTime(d); await p.evaluate(() => setGreeting()); }   // later that day
      if (f === 120) await p.evaluate(() => openChabadPanel('chumash'));                                    // opened again: straight back there
    },
  },
  // The guides: each text opened with its guide on, the guide's box in view (its place goes
  // next to the frames, for the outline the video draws around it)
  guide_chumash: guideScene('chumash', () => localStorage.setItem('chitas_chumash_guide', 'on')),
  guide_tanya:   guideScene('tanya',   () => localStorage.setItem('chitas_tanya_guide', '1')),
  guide_rambam:  guideScene('rambam',  () => localStorage.setItem('chitas_rambam_guide', 'on')),
  review: {
    setup: async p => { await p.evaluate(async () => { window._fb = { ...(window._fb || {}), getIdToken: async () => 't', saveUser: async () => {} }; openQuiz('chumash'); });
      await wait(p, 600); await p.evaluate(() => _startQuiz('quick')); await wait(p, 1500); },
    act: async (p, f) => { if (f === 26) await p.evaluate(() => selectAnswer(1)); },
  },
  family: {
    setup: async p => { await p.evaluate(() => openChabadPanel('tehillim')); await wait(p, 6000);
      await p.evaluate(() => { const r = document.getElementById('native-reader'), el = document.querySelector('.th-personal'); if (el) r.scrollTop += el.getBoundingClientRect().top - r.getBoundingClientRect().top - 10; }); },
    act: async (p, f) => { if (f === 12) await p.evaluate(() => _openTehillimPeopleManager()); },
  },
  progress: {
    setup: async p => { await p.evaluate(() => switchTab('stats')); await wait(p, 800); },
    act: async (p, f, n) => {
      if (f === 0) await p.evaluate(() => renderStats());          // the numbers count up from here
      await p.evaluate(y => window.scrollTo(0, y), Math.round(520 * ease(Math.min(1, Math.max(0, (f - 30) / (n - 40))))));
    },
  },
};

// One frame of time: the page's clock, then every animation to the same moment
const step = (p, t) => p.evaluate(t => {
  document.body.offsetWidth;                                     // let new transitions start
  for (const a of document.getAnimations()) {
    if (a.__t0 == null) a.__t0 = t;
    a.pause();
    const total = a.effect?.getComputedTiming?.().endTime;
    a.currentTime = Math.min(t - a.__t0, Number.isFinite(total) ? total : t - a.__t0);
  }
}, t);

for (const [name, scene] of Object.entries(SCENES)) {
  if (only.length && !only.includes(name)) continue;
  const n = TIMING[name].frames;
  const dir = OUT + name + '/';
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const p = await open(scene.today);
  await scene.setup(p);
  if (scene.where) await writeFile(dir + 'where.json', JSON.stringify(await p.evaluate(sels => Object.fromEntries(Object.entries(sels).map(([k, sel]) => {
    const r = document.querySelector(sel)?.getBoundingClientRect(); return [k, r ? [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] : null];
  })), scene.where)));
  const now = await p.evaluate(() => Date.now());
  await p.clock.pauseAt(now + 1000);
  const lead = scene.lead || 0;                                     // frames run before recording (last settling happens off camera)
  for (let f = -lead; f < n; f++) {
    if (f >= 0) await scene.act(p, f, n);
    await p.clock.runFor(1000 / FPS);
    await step(p, (f + lead) * 1000 / FPS);
    if (f >= 0) await p.screenshot({ path: dir + String(f).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 94 });
  }
  if (p._where) await writeFile(dir + 'where.json', JSON.stringify(p._where));
  console.log('scene', name, n, 'frames');
  await p.close();
}
await br.close(); srv.close();
