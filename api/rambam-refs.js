/**
 * /api/rambam-refs?date=YYYY-MM-DD&track=3|1
 *
 * Fetches Rambam chapter refs for a specific date from Sefaria server-side.
 * Sefaria ignores date params from the browser (CORS) but respects them server-side.
 *
 * Returns: { refs: string[], title: string, date: string }
 */

const SEFARIA = 'https://www.sefaria.org';

function expandRambamRefs(refs) {
  const out = [];
  refs.forEach(ref => {
    if (!ref) return;
    const rangeMatch = ref.match(/^(.+?)\s+(\d+)-(\d+)$/);
    if (rangeMatch) {
      const base = rangeMatch[1];
      const from = parseInt(rangeMatch[2]);
      const to   = parseInt(rangeMatch[3]);
      for (let ch = from; ch <= to; ch++) out.push(base + ' ' + ch);
    } else {
      out.push(ref);
    }
  });
  return [...new Set(out)];
}

async function getRefsForDate(date, track) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();

  const url = `${SEFARIA}/api/calendars?timezone=America/New_York&gy=${y}&gm=${m}&gd=${d}`;
  const cal = await fetch(url, {
    headers: { 'User-Agent': 'chitas-daily/1.0' }
  }).then(r => r.json()).catch(() => null);

  const items = cal?.calendar_items || [];

  let refs = [];
  let title = '';

  if (track === '3') {
    let candidates = items.filter(i => {
      const t = i.title?.en || '';
      return t.includes('3 Chapter') || t.includes('3 Chapters');
    });
    if (!candidates.length) {
      candidates = items.filter(i => {
        const t = i.title?.en || '';
        return (t.toLowerCase().includes('rambam') || (i.ref || '').startsWith('Mishneh Torah'))
          && (i.refs?.length >= 2);
      });
    }
    if (!candidates.length) {
      candidates = items.filter(i => {
        const t = i.title?.en || '';
        return (t.toLowerCase().includes('rambam') || (i.ref || '').startsWith('Mishneh Torah'))
          && !t.includes('1 Chapter');
      });
    }
    const rawRefs = [...new Set(candidates.flatMap(i =>
      i.refs?.length ? i.refs : i.ref ? [i.ref] : []
    ))];
    refs = expandRambamRefs(rawRefs);
    title = candidates[0]?.displayValue?.en || candidates[0]?.ref || '';
  } else {
    const item = items.find(i => (i.title?.en || '').includes('1 Chapter'))
      || items.find(i => {
        const t = i.title?.en || '';
        return t.toLowerCase().includes('rambam') && !t.includes('3 Chapter') && !t.includes('3 Chapters');
      });
    if (item) {
      refs = expandRambamRefs(item.refs?.length ? item.refs : item.ref ? [item.ref] : []);
      title = item.displayValue?.en || item.ref || '';
    }
  }

  return { refs, title };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { date, track = '3' } = req.query;

  let targetDate;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    targetDate = new Date(date + 'T12:00:00Z');
  } else {
    targetDate = new Date();
  }

  try {
    const { refs, title } = await getRefsForDate(targetDate, track);
    if (!refs.length) {
      return res.status(404).json({ error: 'No Rambam refs found', date, track });
    }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).json({ refs, title, date: targetDate.toISOString().slice(0, 10), track });
  } catch (e) {
    console.error('rambam-refs error:', e);
    return res.status(500).json({ error: e.message });
  }
}
