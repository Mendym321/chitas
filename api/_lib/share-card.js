// The picture a shared Review link shows in WhatsApp, iMessage and the rest
// (its "link preview"): drawn here, on the server, from the saved result, so
// what a link shows is always ours and no one can upload a picture to us.
// 1200 × 630, the shape link previews show large. Two kinds, as in the app's
// share sheet: 'score' (the section's colour) and 'challenge' (dark).
// Drawn with satori (a layout → SVG) and resvg (SVG → PNG), in the app's fonts.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const W = 1200, H = 630;
const SECTION = {
  chumash: { name: 'Chumash', acc: '#E0A030', on: '#2E1E00' },
  tanya: { name: 'Tanya', acc: '#8B54B0', on: '#FAF4FD' },
  rambam: { name: 'Rambam', acc: '#5E8A3C', on: '#F3F8EE' },
};
const LEVEL = { quick: 'Quick review', deep: 'Deep dive' };
const INK = '#2B2112', CREAM = '#FBF6EC', DARK = '#1E1A16';

// The fonts, read once per server: from the project's files when they're there
// (tests, a computer), else from our own site, where they're public files
// (Vercel runs this as older-style code, which can't find files beside itself)
const FONT_SITE = 'https://chitas.vercel.app/fonts/';
const fontFile = async name => {
  try { return await readFile(join(process.cwd(), 'fonts', name)); }
  catch (e) { const r = await fetch(FONT_SITE + encodeURIComponent(name)); if (!r.ok) throw new Error('font ' + name + ': ' + r.status); return Buffer.from(await r.arrayBuffer()); }
};
let fontsP = null;
const fonts = () => fontsP || (fontsP = Promise.all([
  fontFile('BricolageGrotesque-ExtraBold.ttf').then(data => ({ name: 'Bricolage', data, weight: 800 })),
  fontFile('DMSans-SemiBold.ttf').then(data => ({ name: 'DM', data, weight: 600 })),
  fontFile('DMSans-Bold.ttf').then(data => ({ name: 'DM', data, weight: 700 })),
  fontFile('CrimsonPro-Italic.ttf').then(data => ({ name: 'Crimson', data, style: 'italic', weight: 400 })),
  fontFile('OT Vilna Basic-VF.ttf').then(data => ({ name: 'Vilna', data, weight: 700 })),
]).catch(e => { fontsP = null; throw e; }));

// A small piece of layout: h('div', { style }, ...children)
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children: children.length <= 1 ? children[0] : children } });
const t = (style, text) => ({ type: 'div', props: { style, children: String(text) } });

// 35 → "לה", 15 → "טו"; the day of the Hebrew month in letters
function hebNumeral(n) {
  if (n === 15) return 'טו';
  if (n === 16) return 'טז';
  return ['', 'י', 'כ', 'ל'][Math.floor(n / 10)] + ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'][n % 10];
}
// "י״ד כסלו", as two words placed right to left (the drawing lays words out left to right)
function hebDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  let day = hebNumeral(+new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', timeZone: 'UTC' }).format(d));
  day = day.length > 1 ? day.slice(0, -1) + '"' + day.slice(-1) : day + "'";
  const month = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long', timeZone: 'UTC' }).format(d);
  return [month, day];
}
// The logo: the four rings on their tile
const LOGO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="230" fill="#FBF7EF"/><g fill="none" stroke-width="70" stroke-linecap="round" transform="translate(512 512)"><circle r="400" stroke="#E0A030"/><circle r="308" stroke="#3F6FC0"/><circle r="216" stroke="#8B54B0"/><circle r="124" stroke="#5E8A3C"/></g></svg>').toString('base64');
const mix = (hex, w) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - w) + 255 * w)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };

function head(ink, dateInk, iso) {
  const [month, day] = hebDate(iso);
  return h('div', { justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    h('div', { alignItems: 'center', gap: 14 }, { type: 'img', props: { src: LOGO, width: 58, height: 58 } }, t({ fontFamily: 'Bricolage', fontSize: 36, color: ink }, 'Chitas')),
    h('div', { gap: 12, fontFamily: 'Vilna', fontSize: 42, color: dateInk }, t({}, month), t({}, day)));
}

// The layout for one shared result: { s, l, r, n, d, t, q, k }, today = the server's date
function layout(x, todayISO) {
  const sec = SECTION[x.s] || SECTION.chumash, today = x.d === todayISO;
  const all = x.r === x.n, ask = all ? 'Can you get ' + x.n + ' of ' + x.n + '?' : 'Can you beat ' + x.r + '?';
  if (x.k === 'challenge') {
    const hi = mix(sec.acc, 0.3);
    const bars = Array.from({ length: x.n }, (_, i) => h('div', { flex: 1, height: 44, borderRadius: 12, background: i < x.r ? hi : '#3A332B' }));
    return h('div', { width: W, height: H, background: DARK, padding: '48px 56px', flexDirection: 'column', fontFamily: 'DM', color: CREAM },
      head(CREAM, '#CFC5B4', x.d),
      h('div', { marginTop: 40, flexDirection: 'column', fontFamily: 'Bricolage', fontSize: 74, lineHeight: 1.04 },
        h('div', {}, t({}, 'I got '), t({ color: hi }, x.r + ' of ' + x.n)),
        t({}, 'on ' + (today ? "today's " : '') + sec.name + '.')),
      t({ marginTop: 14, fontSize: 28, color: '#CFC5B4', fontWeight: 600 }, x.t || LEVEL[x.l]),
      h('div', { marginTop: 'auto', alignItems: 'flex-end', gap: 28, width: '100%' },
        h('div', { flex: 1, flexDirection: 'column', gap: 10 }, h('div', { gap: 10 }, ...bars), t({ fontSize: 22, color: '#A89D8B' }, LEVEL[x.l] + ' · ' + x.n + ' questions')),
        h('div', { width: 470, flexDirection: 'column', background: hi, color: DARK, borderRadius: 30, padding: '24px 30px' },
          t({ fontFamily: 'Bricolage', fontSize: 40 }, ask), t({ marginTop: 6, fontSize: 22, fontWeight: 700 }, 'Tap to try the same questions · free'))));
  }
  const bars = Array.from({ length: x.n }, (_, i) => h('div', { flex: 1, height: 18, borderRadius: 9, background: i < x.r ? sec.acc : '#E6DCC8' }));
  return h('div', { width: W, height: H, background: sec.acc, padding: '48px 56px', gap: 44, fontFamily: 'DM', color: sec.on },
    h('div', { width: 520, flexDirection: 'column' },
      head(sec.on, sec.on, x.d),
      t({ marginTop: 46, fontSize: 22, fontWeight: 700, letterSpacing: 1, opacity: 0.8 }, ((today ? "Today's " : '') + sec.name + ' review').toUpperCase()),
      t({ marginTop: 10, fontFamily: 'Bricolage', fontSize: 50, lineHeight: 1.06 }, x.t || LEVEL[x.l]),
      h('div', { marginTop: 'auto', flexDirection: 'column' },
        t({ fontFamily: 'Bricolage', fontSize: 44 }, ask),
        t({ marginTop: 6, fontSize: 22, opacity: 0.85 }, 'The same ' + x.n + ' questions · free'))),
    h('div', { flex: 1, flexDirection: 'column', background: CREAM, color: INK, borderRadius: 40, padding: '40px 44px', justifyContent: 'center' },
      h('div', { alignItems: 'flex-end', gap: 16 }, t({ fontFamily: 'Bricolage', fontSize: 170, lineHeight: 0.86, letterSpacing: -5 }, x.r + '/' + x.n), t({ fontFamily: 'Bricolage', fontSize: 34, color: '#6B5428', paddingBottom: 8 }, all ? 'all right' : 'right')),
      h('div', { marginTop: 30, gap: 12 }, ...bars),
      x.q ? t({ marginTop: 30, fontFamily: 'Crimson', fontStyle: 'italic', fontSize: 34, lineHeight: 1.3, color: '#4A3A1C' }, x.q.length > 110 ? x.q.slice(0, 108).replace(/\s+\S*$/, '') + '…' : x.q) : t({}, '')));
}

export async function shareCardPng(share, todayISO) {
  const svg = await satori(layout(share, todayISO), { width: W, height: H, fonts: await fonts() });
  return new Resvg(svg).render().asPng();
}
export const SHARE_CARD_SIZE = { width: W, height: H };
