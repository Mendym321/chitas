// Frames the raw screenshots for the stores: a headline and one line over the
// screen, in a device outline, on the app's colours.
// Usage: node compose.mjs <apple|google|ipad|feature>
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';

const RAW = new URL('./raw/', import.meta.url).pathname;   // made by shoot.mjs (not kept in git)
const OUTROOT = new URL('../../docs/store/', import.meta.url).pathname;   // straight into docs/store
const target = process.argv[2] || 'apple';

const C = { cream: ['#F3EBDB', '#1F1B16', '#6B6152'], gold: ['#E0A030', '#2E1E00', '#5A3E06'], purple: ['#8B54B0', '#FFFFFF', '#EBDDF5'],
  blue: ['#3F6FC0', '#FFFFFF', '#DCE6F7'], ink: ['#1F1B16', '#FBF7EF', '#BFB5A4'], green: ['#5E8A3C', '#FFFFFF', '#E1EED6'] };
export const SET = [
  { n: 1, raw: 'today-light',     bg: 'cream',  head: 'Chitas and Rambam,<br>ready every day',      sub: 'Today’s portions, worked out for you' },
  { n: 2, raw: 'chumash-light',   bg: 'gold',   head: 'Chumash with Rashi',                         sub: 'Hebrew and English, side by side' },
  { n: 3, raw: 'tanya-light',     bg: 'purple', head: 'Understand<br>the Tanya',                     sub: 'A plain-English guide walks you through' },
  { n: 4, raw: 'tehillim-light',  bg: 'blue',   head: 'Your Tehillim,<br>and your family’s',         sub: 'Each person’s chapter, from their Hebrew birthday' },
  { n: 5, raw: 'hayomyom-light',  bg: 'ink',    head: 'Hayom Yom,<br>every day',                     sub: 'The original, with a clear English translation' },
  { n: 6, raw: 'progress-light',  bg: 'cream',  head: 'Watch your learning<br>add up',               sub: 'Every passuk, chapter and halacha you’ve learned' },
  { n: 7, raw: 'reminders-light', bg: 'gold',   head: 'Reminders,<br>at your times',                 sub: 'One for each part, when you learn it' },
  { n: 8, raw: 'rambam-dark',     bg: 'green',  head: 'Rambam your way',                             sub: 'Three chapters, one, or Sefer HaMitzvos. Light or dark.' },
];
const SIZES = {
  apple:  { w: 1290, h: 2796, dev: 'phone', screenW: 980,  top: 560, head: 92,  sub: 44, radius: 92, bezel: 22 },
  google: { w: 1080, h: 2160, dev: 'phone', screenW: 740,  top: 450, head: 74,  sub: 36, radius: 70, bezel: 17 },
  ipad:   { w: 2064, h: 2752, dev: 'ipad',  screenW: 1620, top: 520, head: 104, sub: 50, radius: 56, bezel: 26 },
};

import { existsSync } from 'node:fs';
const br = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const ctx = await br.newContext({ deviceScaleFactor: 1 });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async r => {
  const res = await fetch(r.request().url());
  r.fulfill({ status: res.status, contentType: res.headers.get('content-type') || 'text/css', body: Buffer.from(await res.arrayBuffer()), headers: { 'Access-Control-Allow-Origin': '*' } });
});
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Frank+Ruhl+Libre:wght@700&display=block" rel="stylesheet">';

if (target === 'feature') {
  const p = await ctx.newPage(); await p.setViewportSize({ width: 1024, height: 500 });
  const ring = (r, c) => `<circle cx="46" cy="46" r="${r}" fill="none" stroke="${c}" stroke-width="8"/>`;
  await p.setContent(`<html><head>${FONTS}<style>body{margin:0;width:1024px;height:500px;background:#1F1B16;color:#FBF7EF;font-family:'Bricolage Grotesque';display:flex;align-items:center;gap:60px;padding:0 84px;box-sizing:border-box}
h1{margin:0;font-size:92px;font-weight:800;letter-spacing:-3px;line-height:1}p{margin:14px 0 0;font-size:31px;font-weight:700;color:#D8CEBC;line-height:1.2}
.he{font-family:'Frank Ruhl Libre';font-size:30px;display:flex;gap:18px;margin-top:24px;direction:rtl;justify-content:flex-end}</style></head><body>
<svg width="290" height="290" viewBox="0 0 92 92">${ring(40, '#E0A030')}${ring(30, '#4E7ACB')}${ring(20, '#9560BA')}${ring(10, '#659444')}</svg>
<div><h1>Chitas</h1><p>Chumash, Tehillim, Tanya<br>and Rambam, every day</p>
<div class="he"><span style="color:#E0A030">חומש</span><span style="color:#7FA3E6">תהלים</span><span style="color:#B98CDB">תניא</span><span style="color:#8DBB6A">רמב״ם</span></div></div></body></html>`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await mkdir(OUTROOT, { recursive: true });
  await p.screenshot({ path: OUTROOT + 'feature-graphic.png' });
  console.log('feature-graphic.png');
} else {
  const S = SIZES[target];
  await mkdir(OUTROOT + target, { recursive: true });
  const p = await ctx.newPage(); await p.setViewportSize({ width: S.w, height: S.h });
  for (const it of SET) {
    const [bg, fg, sub] = C[it.bg];
    const img = 'data:image/png;base64,' + (await readFile(`${RAW}${S.dev}-${it.raw}.png`)).toString('base64');
    const ratio = S.dev === 'ipad' ? 1376 / 1032 : 932 / 430, sh = Math.round(S.screenW * ratio);
    await p.setContent(`<html><head>${FONTS}<style>
      body{margin:0;width:${S.w}px;height:${S.h}px;overflow:hidden;background:${bg};font-family:'Bricolage Grotesque';display:flex;flex-direction:column;align-items:center}
      .cap{height:${S.top}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 60px;box-sizing:border-box}
      h1{margin:0;color:${fg};font-size:${S.head}px;font-weight:800;letter-spacing:-.02em;line-height:1.04}
      p{margin:${Math.round(S.sub * .55)}px 0 0;color:${sub};font-size:${S.sub}px;font-weight:600;line-height:1.25}
      .dev{position:relative;width:${S.screenW}px;height:${sh}px;padding:${S.bezel}px;border-radius:${S.radius + S.bezel}px;background:#111;box-shadow:0 40px 90px rgba(0,0,0,.28),0 0 0 2px rgba(255,255,255,.06) inset}
      .dev img{display:block;width:${S.screenW}px;height:${sh}px;border-radius:${S.radius}px}
    </style></head><body><div class="cap"><h1>${it.head}</h1><p>${it.sub}</p></div><div class="dev"><img src="${img}"></div></body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    const file = `${OUTROOT}${target}/${it.n}-${it.raw.replace(/-(light|dark)$/, '')}.png`;
    await p.screenshot({ path: file });
    console.log(file.split('/').slice(-2).join('/'));
  }
}
await br.close();
