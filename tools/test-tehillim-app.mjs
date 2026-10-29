/**
 * Browser test of the Tehillim reader and the Personal Tehillim sheet: the
 * personal chapters are there with the day's (even when they arrive slowly)
 * and stay through every language change; Both is side by side; the gear and
 * the page agree; birthdays are saved as picked, English dates included.
 * The internet is blocked; Sefaria's texts are stand-ins.
 *
 * Run:  cd tools && npm run test:tehillim
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  let body;
  try { body = await readFile(join(ROOT, path === '/' ? 'index.html' : path)); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });

let failed = 0;
const ok = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
};

// Wednesday 28 Oct 2026 = 17 Cheshvan 5787: Psalms 83–87. The Rebbe says 125, the Rebbetzin 126.
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const errors = [];
page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
await page.clock.install({ time: new Date('2026-10-28T10:00:00') });
const HE = 'לַמְנַצֵּחַ מִזְמוֹר לְדָוִד {פ}', EN = 'For the leader. A psalm of David.';
const asked = [];
await page.route(u => !u.href.startsWith(url), async r => {
  const u = r.request().url(), H = { 'Access-Control-Allow-Origin': '*' };
  if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [] } });
  if (!u.includes('sefaria.org/api/texts/Psalms')) return r.abort();
  const ref = u.replace(/^.*texts\//, '').split('?')[0], range = ref.includes('-');
  asked.push(ref);
  if (!range) await new Promise(res => setTimeout(res, 1200));   // a person's chapter comes slowly
  const ch = Array(3).fill(HE), ce = Array(3).fill(EN);
  return r.fulfill({ headers: H, json: range ? { he: Array(5).fill(ch), text: Array(5).fill(ce) } : { he: ch, text: ce } }).catch(() => {});
});
await page.addInitScript(() => {
  try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: '3', started: true, lastDate: '2026-10-28', done: {},
      tehillimPeople: [{ label: 'Devorah', heDay: 3, heMonth: 'Kislev', heYear: 5750 }] })); } } catch {}
});
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.tehillim, null, { timeout: 8000 }).catch(() => {});
const personal = () => page.evaluate(() => [...document.querySelectorAll('#tehillim-personal .th-chapter')].map(c => c.querySelector('.th-day')?.textContent + (c.querySelector('.th-text, .th-en') ? '' : ' (waiting)')));

console.log('Personal Tehillim in the reader:');
await page.evaluate(() => openChabadPanel('tehillim'));
await page.waitForFunction(() => document.querySelector('#native-reader-content .th-chapter'), null, { timeout: 5000 });
ok('the people are there with the day\'s chapters, while theirs download', await personal(), ['Rebbe (waiting)', 'Rebbetzin (waiting)', 'Devorah (waiting)']);
await page.waitForFunction(() => document.querySelectorAll('#tehillim-personal .th-text').length === 3, null, { timeout: 5000 }).catch(() => {});
ok('and their chapters fill in when they arrive, without reopening', await personal(), ['Rebbe', 'Rebbetzin', 'Devorah']);
ok('chapters 125, 126 and 37', await page.evaluate(() => [...document.querySelectorAll('#tehillim-personal .th-ch-num')].map(e => e.textContent)), ['קכה.', 'קכו.', 'לז.']);
ok('each downloaded once, in Koren', [asked.filter(a => a === 'Psalms.125').length, asked.filter(a => a === 'Psalms.37').length], [1, 1]);
ok('no {פ} marks anywhere', await page.evaluate(() => document.getElementById('native-reader-content').textContent.includes('{')), false);

console.log('Languages:');
ok('the gear\'s switch agrees with the page\'s (Hebrew)', await page.evaluate(() => { const top = document.querySelector('#native-reader-content .tz-seg .on')?.textContent; openReaderSettings(); const gear = document.querySelector('#rs-section-opts .tz-seg .on')?.textContent; closeReaderSettings(); return [top, gear]; }), ['עברית', 'עברית']);
await page.evaluate(() => _setTehillimLang('en'));
ok('English: the people stay', await personal(), ['For Rebbe', 'For Rebbetzin', 'For Devorah']);
await page.evaluate(() => _setReaderLang('tehillim', 'both'));
ok('Both from the gear: the people stay', (await personal()).length, 3);
await page.evaluate(() => document.querySelector('#native-reader-content .th-chapter:not(#tehillim-personal *)')?.scrollIntoView()); await page.waitForTimeout(400);
await page.screenshot({ path: new URL('./.look/tehillim-both.png', import.meta.url).pathname }).catch(() => {});
ok('Both is side by side: English left, Hebrew right', await page.evaluate(() => { const r = document.querySelector('.th-row'); const [en, he] = r.children; return [getComputedStyle(r).display, en.getBoundingClientRect().left < he.getBoundingClientRect().left, en.classList.contains('th-en')]; }), ['grid', true, true]);

console.log('The people sheet:');
await page.evaluate(() => _openTehillimPeopleManager());
ok('the list: switches and today\'s chapters', await page.evaluate(() => [...document.querySelectorAll('.tpm-who p:last-child')].map(p => p.textContent)), ['Chapter 125', 'Chapter 126', '3 Kislev 5750 · Chapter 37']);
await page.click('text=Add a person');
ok('Add waits for a name and a whole date', await page.evaluate(() => document.getElementById('tpm-save').disabled), true);
await page.fill('#tpm-name', 'Shmuel');
await page.selectOption('#tpm-year', '5784');
ok('a leap year offers Adar I and Adar II', await page.evaluate(() => [...document.querySelectorAll('#tpm-month option')].map(o => o.value).filter(v => v.startsWith('Adar'))), ['Adar I', 'Adar II']);
await page.selectOption('#tpm-month', 'Adar II'); await page.selectOption('#tpm-day', '14');
ok('it says what the date means', await page.textContent('#tpm-result'), 'Hebrew birthday 14 Adar II 5784. Says chapter 3 now.');
await page.selectOption('#tpm-year', '5785');
ok('an ordinary year turns Adar II into Adar', await page.evaluate(() => _tpm.he.month), 'Adar');
await page.selectOption('#tpm-year', '5660');
ok('years go back to 5660 (1899)', await page.evaluate(() => _tpm.he.year), 5660);
await page.selectOption('#tpm-year', '5784'); await page.selectOption('#tpm-month', 'Adar II'); await page.selectOption('#tpm-day', '14');
await page.click('#tpm-save');
await page.click('text=Add a person');
await page.fill('#tpm-name', 'Baby');
await page.click('text=English date');
await page.fill('#tpm-en', '2024-03-24');
await page.click('.tpm-sunset .ml-sw');
await page.click('#tpm-save');   // at once: nothing to wait for
ok('saved as picked, the English date after sunset the next Hebrew day', await page.evaluate(() => user.tehillimPeople.slice(1)),
  [{ label: 'Shmuel', heDay: 14, heMonth: 'Adar II', heYear: 5784 }, { label: 'Baby', heDay: 15, heMonth: 'Adar II', heYear: 5784, enDate: '2024-03-24', afterSunset: true }]);
ok('the reader shows them straight away', (await personal()).length, 5);
await page.click('#tpm-people >> text=Baby');
ok('editing reopens on the English date', await page.evaluate(() => [_tpm.tab, document.getElementById('tpm-en').value]), ['en', '2024-03-24']);
await page.click('.tpm-remove');
ok('Remove offers Undo', [await page.textContent('.tpm-undo'), await page.evaluate(() => user.tehillimPeople.length)], ['Baby removed. Undo', 2]);
await page.click('.tpm-undo button');
ok('Undo puts them back in their place', await page.evaluate(() => user.tehillimPeople.map(p => p.label)), ['Devorah', 'Shmuel', 'Baby']);
await page.click('[aria-label="Rebbe\'s chapter"]');
ok('turning the Rebbe off takes his chapter out of the reader', [await page.evaluate(() => user.tehillimFixedOpts.rebbe), (await personal()).length], [false, 4]);
ok('no errors', errors, []);

// Elul: a fresh page on 2 Elul 5787 (Sat 4 Sep 2027), then on Yom Kippur (Mon 11 Oct 2027)
async function openOn(iso) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  p.__errors = []; p.on('pageerror', e => p.__errors.push(e.message.split('\n')[0]));
  await p.clock.install({ time: new Date(iso + 'T10:00:00') });
  await p.route(u => !u.href.startsWith(url), r => {
    const u = r.request().url(), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [] } });
    if (!u.includes('sefaria.org/api/texts/Psalms')) return r.abort();
    const m = u.match(/Psalms\.(\d+)(?:[:\d]*-(\d+))?/), n = m[2] ? +m[2] - +m[1] + 1 : 1;
    const ch = Array(2).fill(HE), ce = Array(2).fill(EN);
    return r.fulfill({ headers: H, json: n > 1 ? { he: Array(n).fill(ch), text: Array(n).fill(ce) } : { he: ch, text: ce } });
  });
  await p.addInitScript(d => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: '3', started: true, lastDate: d, done: {}, tehillimFixedOpts: { rebbe: false, rebbetzin: false } })); } } catch {} }, iso);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.tehillim, null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => openChabadPanel('tehillim'));
  await p.waitForFunction(() => document.querySelector('#native-reader-content .th-chapter'), null, { timeout: 5000 }).catch(() => {});
  return p;
}
const elulPart = p => p.evaluate(() => {
  const e = document.querySelector('.th-elul');
  return e && [e.querySelector('.th-personal-head p').textContent, [...e.querySelectorAll('.th-ch-num')].length, [...e.querySelectorAll('.th-day')].map(x => x.textContent)];
});

console.log('Elul:');
{
  const p = await openOn('2027-09-04');
  ok('Today\'s line says the Elul chapters too', await p.evaluate(() => schedule.tehillim.subtitle), 'Psalms 10–17 + Elul 4–6');
  ok('the reader has the three after the day\'s', await elulPart(p), ['Elul Tehillim', 3, []]);
  ok('chapters 4, 5, 6 (ד ה ו)', await p.evaluate(() => [...document.querySelectorAll('.th-elul .th-ch-num')].map(e => e.textContent)), ['ד.', 'ה.', 'ו.']);
  ok('they come before Personal Tehillim', await p.evaluate(() => !!(document.querySelector('.th-elul').compareDocumentPosition(document.getElementById('tehillim-personal')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
  await p.evaluate(() => _setTehillimLang('both'));
  ok('and stay through a language change', (await elulPart(p))[1], 3);
  await p.evaluate(() => { document.getElementById('app-loader')?.remove(); document.querySelector('.th-elul').scrollIntoView(); });
  await p.screenshot({ path: new URL('./.look/tehillim-elul.png', import.meta.url).pathname }).catch(() => {});
  ok('no errors', p.__errors, []);
  await p.close();
}
{
  const p = await openOn('2027-10-11');
  ok('Yom Kippur: 36 chapters in four nines, each under when it\'s said', await elulPart(p), ['Yom Kippur Tehillim', 36, ['Before Kol Nidrei', 'Before going to sleep', 'After Musaf', 'After Ne\'ilah']]);
  ok('Today\'s line', await p.evaluate(() => schedule.tehillim.subtitle), 'Psalms 55–59 + Yom Kippur 115–150');
  ok('no errors', p.__errors, []);
  await p.close();
}
{
  const p = await openOn('2027-10-12');
  ok('the day after: no Elul part', await elulPart(p), null);
  await p.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll Tehillim app tests passed');
process.exit(failed ? 1 : 0);
