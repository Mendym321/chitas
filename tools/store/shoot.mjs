// Store screenshots from the real app with real texts: the repo served locally,
// its /api answered by the live server, Sefaria / Hebcal / fonts fetched for real.
// Usage: node shoot.mjs <phone|ipad> <light|dark> [shot ...]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = new URL('./raw/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const [device = 'phone', mode = 'light', ...only] = process.argv.slice(2);
const VIEW = device === 'ipad' ? { width: 1032, height: 1376, scale: 2 } : { width: 430, height: 932, scale: 3 };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2' };
const srv = createServer(async (q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let body;
  try { body = await readFile(ROOT + (u === '/' ? '/index.html' : u)); } catch { return r.writeHead(404).end(); }
  r.writeHead(200, { 'Content-Type': TYPES[extname(u)] || 'text/html' }).end(body);
}).listen(8850);
const BASE = 'http://localhost:8850';

import { existsSync } from 'node:fs';
const br = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const ctx = await br.newContext({ serviceWorkers: 'block', viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: VIEW.scale, colorScheme: mode, isMobile: device === 'phone', hasTouch: device === 'phone' });
// Everything outside the app goes through Node (which knows this machine's proxy)
const cache = new Map();
await ctx.route('**/*', async r => {
  const req = r.request(), u = req.url();
  if (u.startsWith(BASE) && !u.startsWith(BASE + '/api/')) return r.continue();
  if (/gstatic\.com\/firebasejs/.test(u)) return r.abort();             // no account in screenshots
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
  } catch (e) { return r.abort(); }
});

// A learner six weeks in: most days full, a few gaps, today Chumash and Tehillim done
const seed = () => {
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ALL = { chumash: true, tehillim: true, tanya: true, rambam: true }, pastDone = {}, pastQuizDone = {};
  for (let i = 1; i <= 46; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (d.getDay() === 6) continue;
    if (i === 23 || i === 31) continue;                        // two days off
    pastDone[iso(d)] = i === 12 || i === 27 ? { chumash: true, tehillim: true, tanya: true } : { ...ALL };
    if (i % 4 === 1) pastQuizDone[iso(d)] = { chumash: { quick: { r: i % 3 ? 4 : 3, n: 4 } }, ...(i % 8 === 1 ? { tanya: { deep: { r: 5, n: 6 } } } : {}) };
  }
  localStorage.setItem('chitas_v78', JSON.stringify({ uid: 'demo', name: 'Mendy Cohen', rambamTrack: '3', started: true, rambamTrackAsked: true,
    done: { chumash: true, tehillim: true }, pastDone, pastQuizDone, lastDate: iso(new Date()), extraTracks: ['hayomYom'],
    tehillimFixedOpts: { rebbe: true, rebbetzin: false },
    tehillimPeople: [{ label: 'Me', heDay: 14, heMonth: 'Adar', heYear: 5752 }, { label: 'Chana', heDay: 3, heMonth: 'Tammuz', heYear: 5779 }, { label: 'Levi', heDay: 22, heMonth: 'Shevat', heYear: 5784 }] }));
  localStorage.setItem('chitas_lang_chumash', 'both');
  localStorage.setItem('chitas_chumash_rashi', '1');
  localStorage.setItem('chitas_lang_tanya', 'both');
  localStorage.setItem('chitas_tanya_guide', '1');
  localStorage.setItem('chitas_lang_tehillim', 'both');
  localStorage.setItem('chitas_reminders', JSON.stringify({ chumash: '07:30', tehillim: '07:45', tanya: '21:00', rambam: '21:30' }));
};

async function open(dayShift = 0) {
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  page error:', e.message.split('\n')[0]));
  await p.clock.install({ time: (() => { const d = new Date(); d.setDate(d.getDate() + dayShift); d.setHours(8, 40, 0, 0); return d; })() });
  await p.addInitScript(seed);
  await p.goto(BASE + '/');
  await p.waitForFunction(() => typeof init === 'function' && typeof dayNote === 'function', null, { timeout: 20000 });
  await p.evaluate(async () => { await init(); document.getElementById('main-app').classList.add('ready'); try { hideLoader(); } catch (e) {} document.getElementById('app-loader')?.remove(); });
  await p.waitForTimeout(2500);
  return p;
}
const settle = (p, ms = 2500) => p.waitForTimeout(ms);
const scrollReaderTo = (p, sel, off = 0) => p.evaluate(([sel, off]) => {
  const r = document.getElementById('native-reader'), el = document.querySelector(sel);
  if (r && el) r.scrollTop += el.getBoundingClientRect().top - r.getBoundingClientRect().top - off;
}, [sel, off]);

const SHIFT = { hayomyom: -1 };   // a day whose Hayom Yom fills the page
const SHOTS = {
  today: async p => {},
  chumash: async p => { await p.evaluate(() => { user.done = { tehillim: true }; openChabadPanel('chumash'); }); await settle(p, 6000); await scrollReaderTo(p, '.rd-comm', 470); await settle(p, 800); },
  tanya: async p => { await p.evaluate(() => openChabadPanel('tanya')); await settle(p, 8000); },
  tehillim: async p => { await p.evaluate(() => openChabadPanel('tehillim')); await settle(p, 6000); await scrollReaderTo(p, '.th-personal', 10); await p.evaluate(() => _openTehillimPeopleManager()); await settle(p, 1200); },
  hayomyom: async p => { await p.evaluate(() => openExtraReader('hayomYom')); await settle(p, 4000); },
  hayomyom2: async p => { await p.evaluate(() => openExtraReader('hayomYom')); await settle(p, 3000); await p.evaluate(() => _readerGoDay(1)); await settle(p, 3000); },
  hayomyom3: async p => { await p.evaluate(() => openExtraReader('hayomYom')); await settle(p, 3000); await p.evaluate(() => _readerGoDay(-1)); await settle(p, 3000); },
  progress: async p => { await p.evaluate(() => switchTab('stats')); await settle(p, 1800); },
  reminders: async p => { await p.evaluate(() => { switchTab('profile'); openReminders(); }); await settle(p, 1200); },
  rambam: async p => { await p.evaluate(() => openChabadPanel('rambam')); await settle(p, 6000); },
};
for (const [name, fn] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  const p = await open(SHIFT[name] || 0);
  try { await fn(p); } catch (e) { console.log(name, 'ERR', e.message.split('\n')[0]); }
  await p.screenshot({ path: `${OUT}${device}-${name}-${mode}.png` });
  console.log('shot', name);
  await p.close();
}
await br.close(); srv.close();
