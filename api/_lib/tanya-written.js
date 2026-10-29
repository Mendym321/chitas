// Tanya guides written ahead of time, in batches, and reviewed before they go
// in, so the AI isn't called for these portions (see tanya-guide.js). Each is
// written exactly like the AI's answer, by the same rules (SYSTEM there), and
// is cut into the live text the same way. If any cut can't be found in the
// live text, the written guide isn't used and the AI prepares that day instead.
//
// Key: "<book> <chapter>|<startVerse>|<endVerse or 'end'>", in the same
// coordinates as the portion (tanya-portion.js), e.g. "Iggeret HaKodesh 29|1|8".
import { WRITTEN } from './tanya-written-data.js';

export const writtenKey = (slug, startVerse, endVerse) =>
  String(slug).replace(/^.*;_?/, '').replace(/_/g, ' ').replace(/\.(\d+)$/, ' $1') + '|' + startVerse + '|' + (endVerse ?? 'end');

// Written compactly, as { intro, recap, summary, segs: [[heading, [[he, en, heading?], ...]], ...] }
// (one entry per segment: its heading, then its cuts); returned in the AI's shape
export function writtenGuide(slug, startVerse, endVerse) {
  const w = WRITTEN[writtenKey(slug, startVerse, endVerse)];
  if (!w) return null;
  if (w.segments) return w;
  return {
    chapterIntro: w.intro || '', recap: w.recap || '', summary: w.summary || '',
    segments: (w.segs || []).map(([heading, cuts], i) => ({ index: i + 1, heading: heading || '',
      splits: (cuts || []).map(([he, en, h]) => ({ he, en, heading: h || '' })) })),
  };
}
