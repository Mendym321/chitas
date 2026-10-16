// Which Tanya the daily schedule has on a date, in the exact coordinates the
// app uses (chapter slug + 1-based verses), so a guide prepared ahead of time
// is found by the app. Mirrors the "tomorrow-slice" logic in index.html.
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

export const nextDay = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

// { chapterSlug, startVerse, endVerse (null = to the end of the chapter) } or null
export async function tanyaPortion(iso) {
  const [today, tomorrow] = await Promise.all([tanyaYomiItem(iso), tanyaYomiItem(nextDay(iso))]);
  const t = parseTanyaUrl(today?.url);
  if (!t) return null;
  const n = today.url === tomorrow?.url ? null : parseTanyaUrl(tomorrow?.url);
  let endVerse = n && n.chapterSlug === t.chapterSlug && n.verse > t.verse ? n.verse - 1 : null;
  if (endVerse !== null) {
    // The app leaves endVerse off when the portion runs to the chapter's end
    const { allHe } = await fetchChapter(t.chapterSlug);
    if (endVerse === allHe.length) endVerse = null;
  }
  return { chapterSlug: t.chapterSlug, startVerse: t.verse, endVerse };
}
