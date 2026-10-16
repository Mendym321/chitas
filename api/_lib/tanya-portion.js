// Which Tanya the daily schedule has on a date, in the exact coordinates the
// app asks for (chapter slug + 1-based verses). Used so the guide is only ever
// prepared for a portion that is really on the schedule. Mirrors the
// "tomorrow-slice" logic in index.html.
import { fetchChapter } from './tanya-guide.js';

// Sefaria's Tanya Yomi calendar item for a date (YYYY-MM-DD)
export async function tanyaYomiItem(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  try {
    const r = await fetch(`https://www.sefaria.org/api/calendars?year=${y}&month=${m}&day=${d}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chitas-daily/1.0)' } });
    if (!r.ok) return null;
    return (await r.json()).calendar_items?.find(i => i.title?.en === 'Tanya Yomi') || null;
  } catch { return null; }
}

// "Tanya,_Part_I;_Likkutei_Amarim.41.5" → { chapterSlug: "…Amarim.41", verse: 5 }
export function parseTanyaUrl(url) {
  const m = String(url || '').match(/^(.*\.\d+)\.(\d+)$/);
  return m ? { chapterSlug: m[1], verse: +m[2] } : null;
}

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// The portion from a date's calendar item and the next day's:
// { chapterSlug, startVerse, endVerse (null = to the end of the chapter) } or null
async function portionFrom(today, tomorrow, chapterLength) {
  const t = parseTanyaUrl(today?.url);
  if (!t) return null;
  const n = today.url === tomorrow?.url ? null : parseTanyaUrl(tomorrow?.url);
  let endVerse = n && n.chapterSlug === t.chapterSlug && n.verse > t.verse ? n.verse - 1 : null;
  // The app leaves endVerse off when the portion runs to the chapter's end
  if (endVerse !== null && endVerse === await chapterLength(t.chapterSlug)) endVerse = null;
  return { chapterSlug: t.chapterSlug, startVerse: t.verse, endVerse };
}

export const nextDay = iso => addDays(iso, 1);

const lengthOf = () => { const seen = {}; return slug => seen[slug] ??= fetchChapter(slug).then(c => c.allHe.length); };

// The portion on one date
export async function tanyaPortion(iso) {
  const [today, tomorrow] = await Promise.all([tanyaYomiItem(iso), tanyaYomiItem(nextDay(iso))]);
  return portionFrom(today, tomorrow, lengthOf());
}

// Every portion on the schedule from `back` days ago through `ahead` days from
// `iso` (what the app can open: catching up a week back, and tomorrow)
export async function scheduledPortions(iso, back = 7, ahead = 1) {
  const dates = []; for (let i = -back; i <= ahead + 1; i++) dates.push(addDays(iso, i));
  const items = await Promise.all(dates.map(tanyaYomiItem));
  const len = lengthOf();
  return (await Promise.all(items.slice(0, -1).map((it, i) => portionFrom(it, items[i + 1], len)))).filter(Boolean);
}

export const samePortion = (a, b) => a.chapterSlug === b.chapterSlug && a.startVerse === b.startVerse && (a.endVerse ?? null) === (b.endVerse ?? null);
