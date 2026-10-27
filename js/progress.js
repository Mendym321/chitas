// Progress rules — streak, Chitas days, milestones. (No points: see DESIGN.md.)
// Pure functions: they only read the user's history and return numbers, so
// they're easy to test (tools/test-progress.mjs). Design: see DESIGN.md.
// Needs js/holidays-data.js (YOM_TOV_DATES) loaded first.

const SECTION_IDS = ['chumash', 'tehillim', 'tanya', 'rambam'];

// Celebrated once each, for streaks and for total Chitas days (18 = חי)
const MILESTONES = [3, 7, 18, 30, 50, 100, 180, 365, 500, 1000];

const _YOM_TOV = new Set(typeof YOM_TOV_DATES !== 'undefined' ? YOM_TOV_DATES : []);

// The learning day starts at 4 am, not at midnight. Someone learning at 1 am
// is almost always finishing the day before (up late, not up early), so until
// 4 am the app still shows, marks and counts the previous day. Every "what day
// is it" in the app asks appNow(); only real clock things (reminders, the
// greeting) use the plain time. Always the phone's own time zone.
const DAY_STARTS_AT = 4;
function appNow(now = new Date()) {
  const d = new Date(now);
  d.setHours(d.getHours() - DAY_STARTS_AT);
  return d;
}

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

// The milestone just reached (if `before` → `after` crossed one), else null
function milestoneReached(before, after) {
  return MILESTONES.find(m => before < m && after >= m) || null;
}
function nextMilestone(n) {
  return MILESTONES.find(m => m > n) || null;
}

// "Welcome back": after a break, when nothing is marked today yet.
// Returns null, or { missedOff } — the latest missed day (-1 = yesterday)
// that can still be caught up (within 7 days), or null if none can.
function welcomeBack(user, today) {
  const learnedBefore = Object.values(user.pastDone || {}).some(d => d && SECTION_IDS.some(id => d[id]));
  if (!learnedBefore) return null;                                   // new: nothing to come back to
  if (SECTION_IDS.some(id => (user.done || {})[id])) return null;    // already started today
  if (computeStreak(user, today).current > 0) return null;           // no break
  for (let back = 1; back <= 7; back++) {
    const d = _addDays(today, -back);
    if (!isRestDay(d) && !isChitasDay(dayDone(user, d, today))) return { missedOff: -back };
  }
  return { missedOff: null };
}

// ── A new day, and more than one device ──────────────────────────────────────
// Today's marks (user.done, user.quizDone) belong to user.lastDate. When the
// phone's date has moved past it, they move into the history for that day.
// Dates are compared as the phone's own calendar dates ("2026-10-26"), never
// through UTC: new Date("2026-10-26") is midnight in London, which in New York
// is the evening before, and that once filed (or dropped) the night's marks.

function _lastISO(u) {
  if (!u || !u.lastDate) return null;
  const s = String(u.lastDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);                       // very old data: "Mon Oct 26 2026"
  return isNaN(d) ? null : progressISO(d);
}

// Two days' Review results, the newer one winning for a level both have
function _mergeQuizDay(a, b) {
  const out = { ...(a || {}) };
  for (const id in (b || {})) {
    const x = out[id], y = b[id];
    out[id] = (x && typeof x === 'object' && y && typeof y === 'object') ? { ...x, ...y } : y;
  }
  return out;
}

// What moves when the day has changed, or null when nothing needs to. The
// marks are added to whatever that day already has; nothing is dropped.
function archiveOldToday(u, todayISO) {
  const last = _lastISO(u);
  const done = u.done || {}, quizDone = u.quizDone || {};
  if (!last || last >= todayISO) return null;   // still today (or the clock went back)
  if (!Object.keys(done).length && !Object.keys(quizDone).length) return null;
  const pastDone = { ...(u.pastDone || {}) }, pastQuizDone = { ...(u.pastQuizDone || {}) };
  if (Object.keys(done).length) pastDone[last] = { ...(pastDone[last] || {}), ...done };
  if (Object.keys(quizDone).length) pastQuizDone[last] = _mergeQuizDay(pastQuizDone[last], quizDone);
  return { pastDone, pastQuizDone, done: {}, quizDone: {} };
}

// This phone's copy and the cloud's copy (saved by another device), as one.
// Both are first brought up to today, then every day is combined mark by
// mark: a mark either one has is kept; where both have one, the cloud's wins
// (it is the later save). Settings come from the cloud.
function syncFromCloud(local, remote, today) {
  const t = progressISO(today);
  const upToToday = u => ({ ...u, ...(archiveOldToday(u, t) || {}) });
  const a = upToToday(local || {}), b = upToToday(remote || {});
  const days = (x = {}, y = {}) => { const o = { ...x }; for (const d in y) o[d] = { ...(x[d] || {}), ...y[d] }; return o; };
  const quizDays = (x = {}, y = {}) => { const o = { ...x }; for (const d in y) o[d] = _mergeQuizDay(x[d], y[d]); return o; };
  const lasts = [_lastISO(a), _lastISO(b)].filter(Boolean).sort();
  return {
    ...a, ...b,
    pastDone: days(a.pastDone, b.pastDone),
    pastQuizDone: quizDays(a.pastQuizDone, b.pastQuizDone),
    done: { ...(a.done || {}), ...(b.done || {}) },
    quizDone: _mergeQuizDay(a.quizDone, b.quizDone),
    lastDate: lasts.length ? lasts[lasts.length - 1] : null,
    milestones: [...new Set([...(a.milestones || []), ...(b.milestones || [])])],
  };
}
