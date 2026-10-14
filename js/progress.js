// Progress rules — points, streak, Chitas days, milestones.
// Pure functions: they only read the user's history and return numbers, so
// they're easy to test (tools/test-progress.mjs). Design: see DESIGN.md.
// Needs js/holidays-data.js (YOM_TOV_DATES) loaded first.

const SECTION_IDS = ['chumash', 'tehillim', 'tanya', 'rambam'];

// The whole points system. A full Chitas day = 4×10 + 10 = 50.
const POINTS = {
  section:     10, // each Chitas section learned
  chitasDay:   10, // bonus for finishing all 4
  extra:        5, // each extra-learning track (Daf Yomi, Hayom Yom…)
  quizCorrect:  5, // each correct quiz answer
};

// Celebrated once each, for streaks and for total Chitas days (18 = חי)
const MILESTONES = [3, 7, 18, 30, 50, 100, 180, 365, 500, 1000];

const _YOM_TOV = new Set(typeof YOM_TOV_DATES !== 'undefined' ? YOM_TOV_DATES : []);

function progressISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Shabbos or Yom Tov — days many people don't use a phone
function isRestDay(d) {
  return d.getDay() === 6 || _YOM_TOV.has(progressISO(d));
}

// What was marked done on a given day ({ chumash: true, … })
function dayDone(user, d, today) {
  return progressISO(d) === progressISO(today) ? (user.done || {}) : ((user.pastDone || {})[progressISO(d)] || {});
}

function isChitasDay(done) {
  return SECTION_IDS.every(id => done && done[id]);
}

function sectionsDone(done) {
  return SECTION_IDS.filter(id => done && done[id]).length;
}

// Points a day is worth. When anything changes, add (after − before):
// unmarking then always takes back exactly what marking gave.
function pointsForDay(done) {
  done = done || {};
  let pts = sectionsDone(done) * POINTS.section;
  if (isChitasDay(done)) pts += POINTS.chitasDay;
  for (const id in done) if (done[id] && !SECTION_IDS.includes(id)) pts += POINTS.extra;
  return pts;
}

// Streak = Chitas days in a row, counting back from today.
//  • Today only counts once it's done — but doesn't break the streak until it's over.
//  • Shabbos / Yom Tov never break it: counted if done, skipped if not.
// Returns { current, atRisk } — atRisk = streak > 0 but today isn't done yet.
function computeStreak(user, today) {
  const todayDone = isChitasDay(dayDone(user, today, today));
  let current = todayDone ? 1 : 0;
  for (let back = 1; back <= 4000; back++) {
    const d = _addDays(today, -back);
    if (isChitasDay(dayDone(user, d, today))) current++;
    else if (!isRestDay(d)) break;
  }
  return { current, atRisk: current > 0 && !todayDone && !isRestDay(today) };
}

// Total Chitas days ever (today + history)
function countChitasDays(user, today) {
  const todayISO = progressISO(today);
  let n = isChitasDay(user.done) ? 1 : 0;
  for (const iso in (user.pastDone || {})) if (iso !== todayISO && isChitasDay(user.pastDone[iso])) n++;
  return n;
}

// Points earned this week (Sunday → today)
function weekPoints(user, today) {
  let pts = 0;
  for (let back = 0; back <= today.getDay(); back++) pts += pointsForDay(dayDone(user, _addDays(today, -back), today));
  return pts;
}

// The milestone just reached (if `before` → `after` crossed one), else null
function milestoneReached(before, after) {
  return MILESTONES.find(m => before < m && after >= m) || null;
}
function nextMilestone(n) {
  return MILESTONES.find(m => m > n) || null;
}

// Chitas days so far this week (Sunday → today)
function chitasDaysThisWeek(user, today) {
  let n = 0;
  for (let d = _addDays(today, -today.getDay()); progressISO(d) <= progressISO(today); d = _addDays(d, 1)) {
    if (isChitasDay(dayDone(user, d, today))) n++;
  }
  return n;
}
