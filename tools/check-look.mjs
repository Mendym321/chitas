/**
 * Consistency check: the same kind of control looks and behaves the same
 * everywhere. Opens the real app (internet blocked), walks the reader's gear
 * for every reader, Profile on a phone and on a computer, and checks rules
 * from DESIGN.md that are easy to break by accident.
 *
 * Run:  cd tools && npm run test:look
 *       npm run test:look -- --shots   (also saves pictures to tools/.look/)
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = process.argv.includes('--shots') ? join(ROOT, 'tools/.look') : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  let body;
  try { body = await readFile(join(ROOT, path === '/' ? 'index.html' : path)); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
if (SHOTS) await mkdir(SHOTS, { recursive: true });

let failed = 0;
const ok = (name, good, detail) => { if (good) console.log('  ✓', name); else { failed++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); } };

const READERS = ['chumash', 'tehillim', 'tanya', 'rambam'];
const EXTRAS = ['dafYomi', 'nachYomi', 'kitzur'];

async function open(width, scheme) {
  const page = await browser.newPage({ viewport: { width, height: width > 900 ? 900 : 844 }, colorScheme: scheme, serviceWorkers: 'block' });
  page.__errors = [];
  // (a blocked text's frame can't use storage; that's the test's blocking, not the app)
  page.on('pageerror', e => { if (!/Access is denied for this document/.test(e.message)) page.__errors.push(e.message.split('\n')[0]); });
  // The day's schedule (so each reader opens); texts stay blocked, the gear doesn't need them
  await page.route(u => !u.href.startsWith(url), r => {
    const u = r.request().url(), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com/converter')) return r.fulfill({ json: { hd: 6, hm: 'Cheshvan', hy: 5787 }, headers: H });
    if (u.includes('hebcal.com/hebcal')) return r.fulfill({ headers: H, json: { items: [
      { category: 'parashat', title: 'Parashat Noach', leyning: { 1: 'Genesis 6:9-6:22', 2: 'Genesis 7:1-7:16', 3: 'Genesis 7:17-8:14', 4: 'Genesis 8:15-9:7', 5: 'Genesis 9:8-9:17', 6: 'Genesis 9:18-10:32', 7: 'Genesis 11:1-11:32' } },
      { category: 'dailyLearning', title: 'Psalms 18-22' }, { category: 'dailyLearning', title: 'Rambam: Robbery and Lost Property 13-14, Ownerless Property 1' },
      { category: 'dailyLearning', title: 'Rambam (1 Chapter): Hilchot Sechirut 5' }] } });
    return r.abort();
  });
  await page.addInitScript(extras => {
    const d = new Date(), iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: 'look', name: 'Look Check', rambamTrack: '3', started: true, lastDate: iso, extraTracks: ['hayomYom', ...extras], done: {} }));
  }, EXTRAS);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.chumash, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return page;
}

// What a switch looks like: the box, and its chosen and unchosen buttons
const SEG_LOOK = () => [...document.querySelectorAll('.tz-seg')].filter(s => s.offsetParent).map(s => {
  const st = (e, keys) => { const c = getComputedStyle(e); return keys.map(k => c[k]).join(' '); };
  const on = s.querySelectorAll('button.on, button[aria-pressed="true"]');
  const off = [...s.querySelectorAll('button')].find(b => !b.classList.contains('on'));
  return {
    where: s.closest('[id]')?.id || '?', chosen: on.length,
    pressedMatchesOn: [...s.querySelectorAll('button')].every(b => b.classList.contains('on') === (b.getAttribute('aria-pressed') === 'true')),
    box: st(s, ['backgroundColor', 'borderRadius', 'paddingTop']),
    on: on[0] ? st(on[0], ['backgroundColor', 'color', 'borderRadius', 'fontSize', 'fontWeight', 'fontFamily', 'boxShadow']) : null,
    off: off ? st(off, ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'fontFamily']) : null,
  };
});
// Buttons with no name a screen reader could say
const UNNAMED = root => [...document.querySelectorAll(root + ' button')].filter(b => b.offsetParent && !(b.textContent.trim() || b.getAttribute('aria-label') || b.title)).map(b => b.outerHTML.slice(0, 80));
// Rows of side-by-side choice buttons that aren't the shared switch
const HOMEMADE = root => [...document.querySelectorAll(root + ' div')].filter(d => d.offsetParent && !d.matches('.tz-seg, .tz-opts') && d.children.length >= 2
  && [...d.children].every(c => c.tagName === 'BUTTON') && /^(Hebrew|עברית|Both|English|Automatic|Light|Dark)$/.test(d.children[0].textContent.trim())).map(d => d.outerHTML.slice(0, 80));

for (const scheme of ['light', 'dark']) {
  console.log(`\nThe reader's gear (${scheme}):`);
  const page = await open(390, scheme);
  const looks = [];
  for (const id of [...READERS, 'hayomYom', ...EXTRAS]) {
    await page.evaluate(id => (['chumash', 'tehillim', 'tanya', 'rambam', 'hayomYom'].includes(id) ? openChabadPanel(id) : openExtraReader(id)), id).catch(e => ok(`${id}: opens`, false, e.message.split('\n')[0]));
    await page.waitForTimeout(400);
    await page.evaluate(() => openReaderSettings());
    await page.waitForTimeout(150);
    const seg = await page.evaluate(SEG_LOOK);
    looks.push(...seg.map(s => ({ ...s, reader: id })));
    ok(`${id}: every button has a name`, !(await page.evaluate(UNNAMED, '#reader-settings-popover')).length, await page.evaluate(UNNAMED, '#reader-settings-popover'));
    ok(`${id}: no home-made switch`, !(await page.evaluate(HOMEMADE, '#chabad-panel')).length, await page.evaluate(HOMEMADE, '#chabad-panel'));
    // Language and Appearance in the gear, in that order
    const rows = await page.evaluate(() => [...document.querySelectorAll('#reader-settings-popover .tz-seg')].map(s => s.getAttribute('aria-label')));
    ok(`${id}: gear has Language then Appearance`, JSON.stringify(rows) === '["Language","Appearance"]', rows);
    // Choosing a language keeps the gear open and moves the switch
    const moved = await page.evaluate(async () => {
      const seg = document.querySelector('#reader-settings-popover .tz-seg[aria-label="Language"]');
      const before = seg.querySelector('.on').textContent;
      const other = [...seg.querySelectorAll('button')].find(b => !b.classList.contains('on'));
      other.click(); await new Promise(r => setTimeout(r, 500));
      const pop = document.getElementById('reader-settings-popover');
      const now = pop.querySelector('.tz-seg[aria-label="Language"] .on')?.textContent;
      const res = { open: pop.style.display !== 'none', moved: now === other.textContent && now !== before };
      [...pop.querySelectorAll('.tz-seg[aria-label="Language"] button')].find(b => b.textContent === before)?.click();
      await new Promise(r => setTimeout(r, 400));
      return res;
    });
    ok(`${id}: a new language keeps the gear open and moves the switch`, moved.open && moved.moved, moved);
    if (SHOTS && id === 'tanya') await page.screenshot({ path: `${SHOTS}/gear-${scheme}.png` });
    await page.evaluate(() => { closeReaderSettings(); _closeReaderNow(); });
  }
  await page.evaluate(() => switchTab('profile'));
  await page.waitForTimeout(300);
  looks.push(...(await page.evaluate(SEG_LOOK)).map(s => ({ ...s, reader: 'profile' })));
  ok('Profile: every button has a name', !(await page.evaluate(UNNAMED, '#tab-profile')).length, await page.evaluate(UNNAMED, '#tab-profile'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/profile-${scheme}.png`, fullPage: true });

  // The readers share one set of pieces: printed-page heading, white guide
  // card, option chips, small numbers (DESIGN.md: "One look for the readers")
  console.log(`\nThe readers look alike (${scheme}):`);
  const pieces = await page.evaluate(async () => {
    const out = {};
    const open = sec => { _readerBegin(sec); _rv.iso = '2026-10-27'; _setReaderColour('var(--c-' + sec + ')', 'var(--on-' + sec + ')'); document.getElementById('chabad-panel').style.display = 'flex'; document.getElementById('native-reader-content').style.display = 'block'; };
    const look = () => {
      const c = document.getElementById('native-reader-content');
      const st = (sel, keys) => { const e = c.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return keys.map(k => cs[k]).join(' '); };
      return { head: st('.tz-head .tz-ch', ['fontFamily', 'fontSize', 'fontWeight']), label: st('.tz-head .tz-en-label', ['fontSize', 'color']),
        card: st('.tz-guide', ['backgroundColor', 'borderRadius']), cardLabel: !!c.querySelector('.tz-guide .tz-gl'),
        chips: [...c.querySelectorAll('.tz-opts > *')].every(b => b.matches('button.tz-opt')) && !!c.querySelector('.tz-opt'),
        numbers: c.querySelectorAll('.rd-vn').length > 0 || !c.querySelector('[style*="font-size:22px"]'),
        tinted: [...c.querySelectorAll('[style*="border-left:4px"]')].length };
    };
    for (const sec of ['chumash', 'rambam']) {
      open(sec);
      if (sec === 'chumash') { window._chumashData = { torahChunks: [{ ref: 'Genesis 19:1-19:2', chapter: 19, startVerse: 1, en: ['The two angels came to Sedom', 'He said'], he: ['וַיָּבֹאוּ', 'וַיֹּאמֶר'] }], rashiMap: { '19:1': [{ en: 'Two', he: 'שני' }] } }; }
      else { window._rambamData = { chapters: [{ ref: 'Mishneh Torah, Sales 13', title: 'Sales 13', heBook: 'הלכות מכירה', chapter: 13, en: ['When a person exchanges'], he: ['המחליף'], notes: [] }] }; }
      const render = () => sec === 'chumash' ? _renderChumashContent() : _renderRambamContent();
      render(); await new Promise(r => setTimeout(r, 400)); render();   // the guide lines arrive from their file
      out[sec] = look();
      _closeReaderNow();
    }
    return out;
  });
  for (const sec of ['chumash', 'rambam']) {
    const x = pieces[sec];
    ok(`${sec}: printed-page heading, guide card, chips, small numbers`, x.head && x.label && x.card && x.cardLabel && x.chips && x.numbers, x);
    ok(`${sec}: no old tinted heading boxes`, x.tinted === 0, x.tinted);
  }
  ok('Chumash and Rambam headings look the same', pieces.chumash.head === pieces.rambam.head && pieces.chumash.label === pieces.rambam.label, [pieces.chumash.head, pieces.rambam.head]);
  ok('Chumash and Rambam guide cards look the same', pieces.chumash.card === pieces.rambam.card, [pieces.chumash.card, pieces.rambam.card]);

  console.log(`\nOne switch, one look (${scheme}):`);
  ok('every switch shows exactly one choice', looks.every(s => s.chosen === 1 && s.pressedMatchesOn), looks.filter(s => s.chosen !== 1 || !s.pressedMatchesOn));
  for (const part of ['box', 'on', 'off']) {
    const kinds = [...new Set(looks.map(s => s[part]))];
    ok(`every switch's ${part === 'box' ? 'box' : part === 'on' ? 'chosen button' : 'other buttons'} looks the same`, kinds.length === 1, looks.map(s => s.reader + ' ' + s.where + ': ' + s[part]));
  }
  ok('no errors on the page', !page.__errors.length, page.__errors);
  await page.close();

  console.log(`\nOn a computer (${scheme}):`);
  const desk = await open(1280, scheme);
  await desk.evaluate(() => switchTab('profile'));
  await desk.waitForTimeout(300);
  const d = await desk.evaluate(() => {
    const tops = [...document.querySelectorAll('#tab-profile > .ps-label')].filter(e => e.offsetParent).map(e => ({ x: Math.round(e.getBoundingClientRect().left), y: Math.round(e.getBoundingClientRect().top) }));
    const firstOf = x => tops.filter(t => t.x === x)[0]?.y;
    const xs = [...new Set(tops.map(t => t.x))];
    const side = document.querySelector('.tabbar'), main = document.getElementById('main-app');
    return { cols: xs.length, firstRow: xs.map(firstOf), sideLeft: side.getBoundingClientRect().right <= main.getBoundingClientRect().left + 1, sideNamed: [...side.querySelectorAll('button')].every(b => b.textContent.trim()) };
  });
  ok('Profile is in two columns', d.cols === 2, d);
  ok('both columns start on the same line', new Set(d.firstRow).size === 1, d.firstRow);
  ok('the sidebar sits beside the page, not over it', d.sideLeft);
  ok('every sidebar item is labelled', d.sideNamed);
  if (SHOTS) await desk.waitForTimeout(1200);   // the loading screen finishes fading
  if (SHOTS) await desk.screenshot({ path: `${SHOTS}/desk-profile-${scheme}.png` });
  await desk.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll look checks passed' + (SHOTS ? ` (pictures in ${SHOTS})` : ''));
process.exit(failed ? 1 : 0);
