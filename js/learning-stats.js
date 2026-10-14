// Learning stats — what the Progress tab shows. Everything is DERIVED from the
// days you marked done + the real calendar, so the numbers are always
// consistent (nothing is counted twice, unmarking a day updates them).
// Needs js/progress.js, js/tehillim.js and js/chumash.js loaded first.
// Tested by tools/test-learning-stats.mjs.

const RAMBAM_TOTAL_CHAPTERS = 1000; // Mishneh Torah

function _hebrewMonthKey(d) {
  return new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', year: 'numeric' }).format(d);
}

// Every day from your first recorded day until today (oldest first)
function _historyDays(user, today) {
  const isos = Object.keys(user.pastDone || {}).sort();
  const first = isos.length ? new Date(isos[0] + 'T12:00:00') : new Date(today);
  // Step back over a Shabbos/Yom Tov right before your first day (e.g. Rosh
  // Hashana on 1 Tishrei) — you couldn't have marked it anyway
  for (let i = 0; i < 3; i++) { const prev = new Date(first); prev.setDate(first.getDate() - 1); if (!isRestDay(prev)) break; first.setDate(first.getDate() - 1); }
  const days = [];
  for (let d = new Date(first); d <= today && days.length < 4000; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  if (!days.length || progressISO(days[days.length - 1]) !== progressISO(today)) days.push(new Date(today));
  return days;
}

function learningStats(user, today, rambamTrack) {
  const days = _historyDays(user, today);
  const did = (d, id) => !!dayDone(user, d, today)[id];
  // Shabbos/Yom Tov can't be marked in the app, so an unmarked one doesn't
  // break a parsha or a month (same rule as the streak)
  const covered = (d, id) => did(d, id) || isRestDay(d);

  // Days learned per section — all time, and in the last 30 days
  const sections = {};
  for (const id of SECTION_IDS) {
    let total = 0, last30 = 0;
    for (const d of days) if (did(d, id)) {
      total++;
      if ((today - d) / 86400000 < 30) last30++;
    }
    sections[id] = { total, last30 };
  }

  // Parshiyos completed: a Sunday–Shabbos week with all 7 aliyos learned
  // (an unmarked Shabbos/Yom Tov is fine, but at least one day must be marked)
  const parshiyos = [];
  for (const d of days) {
    if (d.getDay() !== 6) continue;
    let all = true, any = false;
    for (let back = 0; back < 7 && all; back++) {
      const x = new Date(d); x.setDate(d.getDate() - back);
      all = covered(x, 'chumash'); any = any || did(x, 'chumash');
    }
    if (all && any) parshiyos.push(getParshaForDate(d));
  }

  // Times through Tehillim: a Hebrew month where every day's Tehillim was said
  const months = {};
  for (const d of days) {
    const key = _hebrewMonthKey(d);
    const m = months[key] || (months[key] = { firstDay: getTehillimForDate(d).day, count: 0, done: 0 });
    m.count++;
    if (covered(d, 'tehillim')) m.done++;
  }
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const thisMonth = _hebrewMonthKey(today);
  const thisMonthOver = _hebrewMonthKey(tomorrow) !== thisMonth; // today is the last day
  let tehillimBooks = 0;
  for (const key in months) {
    const m = months[key];
    const monthOver = key !== thisMonth || thisMonthOver;
    // Complete = you were tracking from the 1st, the month is over, every day done
    if (monthOver && m.firstDay === 1 && m.done === m.count) tehillimBooks++;
  }

  // Rambam: chapters per day depends on your track
  const perDay = rambamTrack === '1' ? 1 : rambamTrack === 'm' ? 0 : 3;
  const rambamChapters = sections.rambam.total * perDay;

  // The section you miss most in the last 30 days (only when it's clearly behind)
  const ranked = SECTION_IDS.slice().sort((a, b) => sections[a].last30 - sections[b].last30);
  const weakest = ranked[0], strongest = ranked[ranked.length - 1];
  const needsAttention = sections[strongest].last30 - sections[weakest].last30 >= 3 ? weakest : null;

  return { sections, parshiyos, tehillimBooks, rambamChapters, rambamPerDay: perDay, needsAttention };
}
