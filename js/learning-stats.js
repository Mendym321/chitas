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

  // Parshiyos completed: a Sunday–Shabbos week with all its aliyos learned.
  // Shabbos can't be marked in the app, so the week is complete on Friday
  // (an unmarked Yom Tov is fine too, but at least one day must be marked)
  const parshiyos = [], parshaWeeks = [];
  for (const d of days) {
    if (d.getDay() !== 5) continue;
    let all = true, any = false;
    for (let back = 0; back < 6 && all; back++) {
      const x = new Date(d); x.setDate(d.getDate() - back);
      all = covered(x, 'chumash'); any = any || did(x, 'chumash');
    }
    if (all && any) { parshiyos.push(getParshaForDate(d)); parshaWeeks.push({ name: getParshaForDate(d), iso: progressISO(d) }); }
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

  // Chapters of Tehillim said (from each day's portion you marked)
  let tehillimChapters = 0;
  for (const d of days) if (did(d, 'tehillim')) tehillimChapters += tehillimChapterCount(getTehillimForDate(d).ref);

  // Rambam: chapters per day depends on your track
  const perDay = rambamTrack === '1' ? 1 : rambamTrack === 'm' ? 0 : 3;
  const rambamChapters = sections.rambam.total * perDay;

  // The section you miss most in the last 30 days (only when it's clearly behind)
  const ranked = SECTION_IDS.slice().sort((a, b) => sections[a].last30 - sections[b].last30);
  const weakest = ranked[0], strongest = ranked[ranked.length - 1];
  const needsAttention = sections[strongest].last30 - sections[weakest].last30 >= 3 ? weakest : null;

  return { sections, parshiyos, parshaWeeks, tehillimBooks, tehillimChapters, rambamChapters, rambamPerDay: perDay, needsAttention };
}

// ── "Your learning": totals, consistency, highlights ──────────────────────────
// Needs js/learning-data.js (pesukim per chapter, halachos per day) too.

// Pesukim in a Chumash ref: "Genesis 1:1-2:3", or several joined by "|"
function chumashVerseCount(ref) {
  return String(ref || '').split('|').reduce((sum, r) => {
    const m = r.trim().match(/^(\w+) (\d+):(\d+)-(\d+):(\d+)$/);
    const lens = m && typeof TORAH_CHAPTER_LENGTHS !== 'undefined' && TORAH_CHAPTER_LENGTHS[m[1]];
    if (!lens) return sum;
    const [c1, v1, c2, v2] = [+m[2], +m[3], +m[4], +m[5]];
    if (c1 === c2) return sum + (v2 - v1 + 1);
    let n = (lens[c1 - 1] || 0) - v1 + 1 + v2;
    for (let c = c1 + 1; c < c2; c++) n += lens[c - 1] || 0;
    return sum + n;
  }, 0);
}

// Halachos learned on a day for a Rambam track ('3' or '1'); 0 if unknown
let _rambamDaily = null;
function rambamHalachosOn(d, track) {
  if (typeof RAMBAM_DAILY_HALACHOS === 'undefined' || (track !== '3' && track !== '1')) return 0;
  if (!_rambamDaily) _rambamDaily = { '3': RAMBAM_DAILY_HALACHOS.three.split(',').map(Number), '1': RAMBAM_DAILY_HALACHOS.one.split(',').map(Number) };
  const i = Math.round((new Date(progressISO(d) + 'T12:00:00') - new Date(RAMBAM_DAILY_HALACHOS.start + 'T12:00:00')) / 86400000);
  return _rambamDaily[track][i] || 0;
}

// Runs of days in a row (Shabbos/Yom Tov you didn't mark don't break a run).
// isDone(d) → did the thing that day. Returns { current, best, bestEnd }.
function _runs(days, today, isDone) {
  let run = 0, best = 0, bestEnd = null;
  for (const d of days) {
    if (isDone(d)) { run++; if (run > best) { best = run; bestEnd = new Date(d); } }
    else if (!isRestDay(d) && progressISO(d) !== progressISO(today)) run = 0; // today isn't over yet
  }
  return { current: run, best, bestEnd };
}

// The browser's Hebrew calendar spells months its own way; use the usual Chabad spellings
const _MONTH_SPELLING = { Tishri: 'Tishrei', Heshvan: 'Cheshvan', Tevet: 'Teves', Nisan: 'Nissan', Tamuz: 'Tammuz', 'Adar I': 'Adar I', 'Adar II': 'Adar II' };
function hebMonthSpelling(text) {
  return text.replace(/Tishri|Heshvan|Tevet|Nisan|Tamuz/g, m => _MONTH_SPELLING[m]);
}
function _hebMonthName(d) {
  return hebMonthSpelling(new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', year: 'numeric' }).format(d)
    .replace(/^(\D+?)\s*(\d+)$/, '$1 $2'));
}

// Everything the "Your learning" screen shows
function learningOverview(user, today, rambamTrack) {
  const days = _historyDays(user, today);
  const base = learningStats(user, today, rambamTrack);
  const did = (d, id) => !!dayDone(user, d, today)[id];
  const isFull = d => isChitasDay(dayDone(user, d, today));

  // Totals
  let pesukim = 0, halachos = 0;
  for (const d of days) {
    if (did(d, 'chumash')) pesukim += chumashVerseCount(getChumashAliyaRef(d));
    if (did(d, 'rambam')) halachos += rambamHalachosOn(d, rambamTrack);
  }
  const tanyaChapters = Object.values(user.tanyaLog || {});
  const totals = {
    pesukim, parshiyos: base.parshiyos.length,
    tehillimChapters: Math.floor(base.tehillimChapters), tehillimBooks: base.tehillimBooks,
    tanyaDays: base.sections.tanya.total, tanyaLatest: tanyaChapters.length ? Math.max(...tanyaChapters) : null,
    rambamChapters: base.rambamChapters, rambamHalachos: halachos,
    seferHamitzvosDays: rambamTrack === 'm' ? base.sections.rambam.total : 0,
    daysBy: Object.fromEntries(SECTION_IDS.map(id => [id, base.sections[id].total])),
  };

  // Consistency
  const overall = _runs(days, today, isFull);
  const per = {};
  for (const id of SECTION_IDS) per[id] = { ..._runs(days, today, d => did(d, id)), last30: base.sections[id].last30 };
  let counted = 0, full = 0;
  for (const d of days) {
    if ((today - d) / 86400000 >= 30) continue;
    if (isFull(d)) { full++; counted++; } else if (!isRestDay(d)) counted++;
  }
  const consistency = {
    streak: overall.current, best: overall.best, bestEnd: overall.bestEnd,
    pct30: counted ? Math.round(100 * full / counted) : 0, per,
  };

  return { totals, consistency, highlights: _highlights(user, today, days, base, per, overall, rambamTrack), needsAttention: base.needsAttention };
}

const _SECTION_NAME = { chumash: 'Chumash', tehillim: 'Tehillim', tanya: 'Tanya', rambam: 'Rambam' };
const _WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Shabbos'];

function _highlights(user, today, days, base, per, overall, rambamTrack) {
  const out = [];
  const did = (d, id) => !!dayDone(user, d, today)[id];

  // 1. Your longest run going right now (a week or more)
  const top = SECTION_IDS.map(id => [id, per[id].current]).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 7) {
    const isBest = top[1] >= per[top[0]].best;
    out.push({ title: _SECTION_NAME[top[0]] + ' every day for ' + top[1] + ' days', sub: isBest ? 'Your longest run yet' : 'Your best is ' + per[top[0]].best + ' days' });
  }

  // 2. The most recent full parsha
  if (base.parshiyos.length) {
    const name = base.parshiyos[base.parshiyos.length - 1];
    out.push({ title: 'Learned all of Parshas ' + name, sub: base.parshiyos.length === 1 ? 'Your first full parsha' : base.parshiyos.length + ' full parshiyos so far' });
  }

  // 3. Best month (most full Chitas days)
  const months = {};
  for (const d of days) if (isChitasDay(dayDone(user, d, today))) { const k = _hebMonthName(d); months[k] = (months[k] || 0) + 1; }
  const bestMonth = Object.entries(months).sort((a, b) => b[1] - a[1])[0];
  if (bestMonth && bestMonth[1] >= 5) out.push({ title: 'Best month: ' + bestMonth[0], sub: bestMonth[1] + ' full Chitas days' });

  // 4. One gentle nudge: a weekday the weakest section keeps slipping on
  const weakest = base.needsAttention;
  if (weakest) {
    const misses = [0, 0, 0, 0, 0, 0, 0], seen = [0, 0, 0, 0, 0, 0, 0];
    for (const d of days) {
      if ((today - d) / 86400000 >= 56 || isRestDay(d) || progressISO(d) === progressISO(today)) continue;
      seen[d.getDay()]++; if (!did(d, weakest)) misses[d.getDay()]++;
    }
    const w = misses.indexOf(Math.max(...misses));
    if (misses[w] >= 3) out.push({ title: _SECTION_NAME[weakest] + ' slips on ' + _WEEKDAYS[w], sub: 'Missed ' + misses[w] + ' of the last ' + seen[w] + '. Try it earlier in the day.', nudge: true });
    else out.push({ title: _SECTION_NAME[weakest] + ' is the one you miss most', sub: per[weakest].last30 + ' of the last 30 days', nudge: true });
  }
  return out.slice(0, 4);
}

// ── Learning milestones: they follow the cycles ─────────────────────────────
// Chumash: each parsha, each book (at its last parsha), the whole Torah.
// Tehillim: all of it, each month. Rambam: each of the 14 books and the Siyum,
// on your track. (Tanya's parts come from the day's portion: see index.html.)
// A milestone comes when you reach the end of something and learned most of
// it, and says honestly how much ("28 of its 30 days").
// Compares learningStats() before and after marking section `id` on date d.
// Returns { key, id, title, sub } or null; the key is stable, so each one is
// celebrated once.
const CHUMASH_BOOKS = [
  ['Sefer Bereishis', ['Bereishit', 'Noach', 'Lech Lecha', 'Vayera', 'Chayei Sara', 'Toldot', 'Vayetzei', 'Vayishlach', 'Vayeshev', 'Miketz', 'Vayigash', 'Vayechi']],
  ['Sefer Shemos', ['Shemot', 'Vaera', 'Bo', 'Beshalach', 'Yitro', 'Mishpatim', 'Terumah', 'Tetzaveh', 'Ki Tisa', 'Vayakhel', 'Pekudei']],
  ['Sefer Vayikra', ['Vayikra', 'Tzav', 'Shemini', 'Tazria', 'Metzora', 'Acharei Mot', 'Kedoshim', 'Emor', 'Behar', 'Bechukotai']],
  ['Sefer Bamidbar', ['Bamidbar', 'Nasso', "Beha'alotcha", 'Shelach', 'Korach', 'Chukat', 'Balak', 'Pinchas', 'Matot', 'Masei']],
  ['Sefer Devarim', ['Devarim', 'Vaetchanan', 'Eikev', "Re'eh", 'Shoftim', 'Ki Teitzei', 'Ki Tavo', 'Nitzavim', 'Vayeilech', 'Haazinu', 'Vezot Haberakhah']],
];
const _plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const _isoDay = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(2025, 0, 1)) / 86400000);

function learningMilestone(id, before, after, d, user, today, track) {
  const did = x => !!dayDone(user, x, today)[id] || isRestDay(x);
  if (id === 'chumash' && after.parshiyos.length > before.parshiyos.length) {
    const shabbos = new Date(d); shabbos.setDate(d.getDate() + (6 - d.getDay()));
    const name = getParshaForDate(d), spell = typeof parshaSpelling === 'function' ? parshaSpelling : x => x;
    const last = name.split('-').pop();
    const bi = CHUMASH_BOOKS.findIndex(([, list]) => list[list.length - 1] === last);
    if (bi >= 0) {
      // The book's last parsha: how many of the book's parshiyos (and the year's) you learned
      const within = days => new Set(after.parshaWeeks
        .filter(w => (shabbos - new Date(w.iso + 'T12:00:00')) / 86400000 < days)
        .flatMap(w => w.name.split('-')));
      const inBook = [...within(bi === 4 ? 120 : 160)].filter(n => CHUMASH_BOOKS[bi][1].includes(n)).length;
      const total = CHUMASH_BOOKS[bi][1].length;
      if (inBook * 2 >= total) {
        if (bi === 4) {
          const year = [...within(370)].length;
          return { key: 'torah-' + progressISO(shabbos), id, title: 'The whole Torah',
            sub: 'Sefer Devarim done. You learned ' + year + ' of the year\'s 54 parshiyos.' };
        }
        return { key: 'chumash-book-' + progressISO(shabbos), id, title: CHUMASH_BOOKS[bi][0],
          sub: inBook === total ? 'Every parsha of it.' : 'You learned ' + inBook + ' of its ' + total + ' parshiyos.' };
      }
    }
    return { key: 'parsha-' + progressISO(shabbos), id, title: 'Parshas ' + spell(name), sub: 'Every aliyah of the parsha, all week.' };
  }
  if (id === 'tehillim' && after.tehillimBooks > before.tehillimBooks)
    return { key: 'tehillim-' + _hebrewMonthKey(d), id, title: 'All of Sefer Tehillim',
      sub: 'Every chapter this month' + (after.tehillimBooks > 1 ? ', ' + after.tehillimBooks + ' times through.' : '.') };
  if (id === 'rambam' && (track === '3' || track === '1') && typeof RAMBAM_BOOK_SPANS !== 'undefined') {
    const t = track === '3' ? 'three' : 'one', i = _isoDay(progressISO(d));
    const span = RAMBAM_BOOK_SPANS[t].find(([s, e]) => s <= i && i <= e);
    if (!span || span[1] !== i || span[2] === 0) return null;   // not the last day of a book
    const [s, e, b] = span, total = e - s + 1;
    let learned = 0;
    for (let k = s; k <= e; k++) { const x = new Date(d); x.setDate(d.getDate() - (e - k)); if (did(x)) learned++; }
    if (learned * 2 < total) return null;
    const how = learned === total ? 'every day of it' : learned + ' of its ' + total + ' days';
    return b === RAMBAM_BOOK_NAMES.length - 1
      ? { key: 'rambam-' + t + '-' + s, id, title: 'Siyum HaRambam', sub: 'All of Mishneh Torah. Sefer Shoftim: ' + how + '.' }
      : { key: 'rambam-' + t + '-' + s, id, title: RAMBAM_BOOK_NAMES[b], sub: 'You learned ' + how + '.' };
  }
  return null;
}
