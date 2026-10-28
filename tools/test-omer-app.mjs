/**
 * Browser test of Sefiras HaOmer on Today: the card (day, sefirah, tonight's
 * count, the day's daf of Sotah), the words to count, and the Sotah reader.
 * Internet blocked; Sefaria's texts are stand-ins.
 *
 * Run:  cd tools && npm run test:omer      (-- --shots saves pictures to tools/.look/)
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = process.argv.includes('--shots') ? join(ROOT, 'tools/.look') : null;
if (SHOTS) await mkdir(SHOTS, { recursive: true });
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

const asked = [];
async function openOn(iso, time = '10:00:00', extra = {}) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  p.__errors = []; p.on('pageerror', e => p.__errors.push(e.message.split('\n')[0]));
  await p.clock.install({ time: new Date(iso + 'T' + time) });
  await p.route(u => !u.href.startsWith(url), r => {
    const u = r.request().url(), H = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('hebcal.com')) return r.fulfill({ headers: H, json: { items: [] } });
    if (u.includes('sefaria.org') && u.includes('Sotah')) {
      asked.push(u.replace(/^.*api\//, '').split('?')[0]);
      if (u.includes('/links/')) return r.fulfill({ headers: H, json: [{ collectiveTitle: { en: 'Rashi' }, anchorRef: 'Sotah 8a:1', he: 'רש"י', text: 'Rashi says' }] });
      if (u.includes('/v3/')) return r.fulfill({ headers: H, json: { versions: [{ language: 'en', text: ['The Gemara says.', 'And more.'] }] } });
      return r.fulfill({ headers: H, json: { he: ['גמרא אומרת', 'ועוד'] } });
    }
    return r.abort();
  });
  await p.addInitScript(([d, x]) => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('chitas_v78', JSON.stringify({ uid: '', name: 'M', rambamTrack: '3', started: true, lastDate: d, done: {}, ...x })); } } catch {} }, [iso, extra]);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof schedule !== 'undefined' && schedule && schedule.tehillim, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById('app-loader')?.remove(); document.getElementById('main-app')?.classList.add('ready'); });
  return p;
}
const card = p => p.evaluate(() => { const e = document.getElementById('omer'); return e.style.display === 'none' ? null : [...e.querySelectorAll('.om-day, .om-sef, .ml-n, .ml-p, .om-note')].map(x => x.textContent); });

console.log('On Today:');
{
  const p = await openOn('2027-04-30');   // 23 Nissan: day 8
  ok('day 8: the day, its sefirah, tonight\'s count, Sotah daf 8', await card(p),
    ['Day 8 of the Omer', 'Chesed shebiGevurah · חֶסֶד שֶׁבִּגְבוּרָה', 'Count tonight', 'Night 9 · after nightfall', 'Sotah', 'Daf 8']);
  ok('Sotah isn\'t also in More learning', await p.evaluate(() => !!document.querySelector('#more-learning [data-id="sotah"]')), false);
  if (SHOTS) { await p.evaluate(() => document.getElementById('omer').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200); await p.screenshot({ path: join(SHOTS, 'omer-today.png') }); }
  await p.click('text=Count tonight');
  ok('night 9 as in the siddur, with its line', await p.evaluate(() => [document.getElementById('om-title').textContent, document.querySelector('.om-count').textContent,
    [...document.querySelectorAll('.om-line p[lang="he"]')].map(e => e.textContent)]),
    ['Night 9 of the Omer', 'הַיּוֹם תִּשְׁעָה יָמִים שֶׁהֵם שָׁבֽוּעַ אֶחָד וּשְׁנֵי יָמִים לָעֹֽמֶר:'.normalize('NFC'), ['רנת', 'גבורה שבגבורה', 'בארץ', 'נ']]);
  ok('with the bracha first', await p.evaluate(() => document.querySelector('#omer-modal .om-he').textContent.includes('סְפִירַת הָעֹמֶר')), true);
  ok('after counting, tonight\'s words are marked', await p.evaluate(() => [...document.querySelectorAll('#om-body mark')].map(e => e.textContent)),
    ['בָּאָֽרֶץ'.normalize('NFC'), 'רִנַּת'.normalize('NFC'), 'גְּבוּרָה שֶׁבִּגְבוּרָה']);
  if (SHOTS) { await p.screenshot({ path: join(SHOTS, 'omer-count.png') }); await p.evaluate(() => document.querySelector('.om-k').scrollIntoView()); await p.screenshot({ path: join(SHOTS, 'omer-after.png') }); }
  await p.evaluate(() => _setOmerLang('he'));
  ok('Hebrew only: no English, and it stays that way', [await p.evaluate(() => document.querySelectorAll('#om-body .om-en').length), await p.evaluate(() => localStorage.getItem('chitas_omer_lang'))], [0, 'he']);
  await p.evaluate(() => _setOmerLang('both'));
  await p.evaluate(() => document.getElementById('omer-modal').remove());
  await p.click('#omer >> text=Sotah');
  await p.waitForFunction(() => document.querySelector('#native-reader-content')?.textContent.includes('Gemara'), null, { timeout: 5000 }).catch(() => {});
  ok('Sotah opens on daf 8, with no Hebcal', [await p.textContent('#chabad-panel-sub'), asked.filter(a => a.includes('Sotah.8a')).length > 0], ['Daf 8 · Day 8 of the Omer', true]);
  if (SHOTS) { await p.evaluate(() => document.getElementById('app-loader')?.remove()); await p.screenshot({ path: join(SHOTS, 'omer-sotah.png') }); }
  ok('no errors', p.__errors, []);
  await p.close();
}
{
  const p = await openOn('2027-04-24', '01:30:00');   // 1:30 am on 17 Nissan: still 16 Nissan's learning day
  ok('1:30 am after the first night: still day 1, count night 2 tonight, Sotah from tomorrow', await card(p),
    ['Day 1 of the Omer', 'Chesed sheb\'Chesed · חֶסֶד שֶׁבְּחֶסֶד', 'Count tonight', 'Night 2 · after nightfall', 'Sotah starts tomorrow with daf 2, a daf a day until Shavuos.']);
  await p.close();
}
{
  const p = await openOn('2027-04-22');   // 15 Nissan, first day of Pesach
  ok('first day of Pesach: the Omer starts tonight', await card(p), ['The Omer starts tonight', 'Count tonight', 'Night 1 · after nightfall']);
  await p.close();
}
{
  const p = await openOn('2027-06-10');   // 5 Sivan: day 49
  ok('day 49: no count tonight, the last daf', await card(p), ['Day 49 of the Omer', 'Malchus sheb\'Malchus · מַלְכוּת שֶׁבְּמַלְכוּת', 'Sotah', 'Daf 49, the last']);
  await p.close();
}
{
  // Learned every daf from day 2 (24 Apr) to day 48 (9 Jun); today day 49 not yet
  const pastDone = {};
  for (let d = new Date('2027-04-24T12:00:00'); d <= new Date('2027-06-09T12:00:00'); d.setDate(d.getDate() + 1))
    pastDone[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')] = { sotah: true };
  const p = await openOn('2027-06-10', '10:00:00', { pastDone });
  ok('47 of 48 learned before the last', (await card(p))[3], 'Daf 49, the last · 47 of 48 learned');
  await p.evaluate(() => { user.done = { sotah: true }; _renderOmer('2027-06-10', true); });
  ok('and the last one makes the siyum', (await card(p))[3], 'All 48 dafim: a siyum on Maseches Sotah');
  await p.close();
}
{
  const p = await openOn('2027-06-11');   // Shavuos
  ok('Shavuos: no card', await card(p), null);
  await p.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll Omer app tests passed');
process.exit(failed ? 1 : 0);
