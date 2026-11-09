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

// ── Marks by date: one record, on every device ───────────────────────────────
// Every mark lives under its date: days = { "2026-11-08": { chumash: true, … } },
// and Review results the same way in reviews. "Today" is just today's date in
// it, so nothing moves at 4 am. The account keeps exactly this, one field per
// mark (index.html: _fb.setMark), so two devices never overwrite each other's
// marks, and every open device watches it and redraws when it changes.
// The app reads it through the usual lists (dayView): today's in done and
// quizDone, the others in pastDone and pastQuizDone.
//
// Older copies kept "today" separately (done + lastDate) next to the history
// (pastDone); daysFrom reads those too. Dates are the phone's own calendar
// dates ("2026-10-26"), never through UTC.

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

// Older copies: a save could leave the loose "today" list stale under a newer
// lastDate (the account merged saves); where the last day is also filed in the
// history, that is the day's list
function datedToday(u) {
  const last = _lastISO(u);
  const pd = (u && u.pastDone) || {}, pq = (u && u.pastQuizDone) || {};
  if (!last || (!(last in pd) && !(last in pq))) return u;
  const out = { ...u, pastDone: { ...pd }, pastQuizDone: { ...pq } };
  if (last in pd) { out.done = { ...(pd[last] || {}) }; delete out.pastDone[last]; }
  if (last in pq) { out.quizDone = { ...(pq[last] || {}) }; delete out.pastQuizDone[last]; }
  return out;
}

// The record of marks, from a copy in any format (the new days win)
function daysFrom(u) {
  const out = {};
  if (!u) return out;
  const add = (iso, day) => { if (iso && day && typeof day === 'object') out[iso] = { ...(out[iso] || {}), ...day }; };
  const v = datedToday(u);
  for (const iso in (v.pastDone || {})) add(iso, v.pastDone[iso]);
  const last = _lastISO(v);
  if (last && v.done && Object.keys(v.done).length) add(last, v.done);
  for (const iso in (u.days || {})) add(iso, u.days[iso]);
  return out;
}
// The record of Review results, the same way
function reviewsFrom(u) {
  const out = {};
  if (!u) return out;
  const add = (iso, day) => { if (iso && day && typeof day === 'object') out[iso] = _mergeQuizDay(out[iso], day); };
  const v = datedToday(u);
  for (const iso in (v.pastQuizDone || {})) add(iso, v.pastQuizDone[iso]);
  const last = _lastISO(v);
  if (last && v.quizDone && Object.keys(v.quizDone).length) add(last, v.quizDone);
  for (const iso in (u.reviews || {})) add(iso, u.reviews[iso]);
  return out;
}

// The usual lists for one day, from the records
function dayView(days, reviews, todayISO) {
  const pastDone = { ...(days || {}) }, pastQuizDone = { ...(reviews || {}) };
  const done = { ...(pastDone[todayISO] || {}) }, quizDone = { ...(pastQuizDone[todayISO] || {}) };
  delete pastDone[todayISO]; delete pastQuizDone[todayISO];
  return { done, pastDone, quizDone, pastQuizDone, lastDate: todayISO };
}

// What this device has that the account doesn't yet (marked signed out, or
// before this version): each as [date, section, value], to send up once. A
// mark the account already has, either way, is left as the account says.
function marksToSend(cloudDays, localDays) {
  const out = [];
  for (const iso in (localDays || {})) for (const id in localDays[iso]) {
    if (!(cloudDays[iso] && id in cloudDays[iso]) && localDays[iso][id] === true) out.push([iso, id, true]);
  }
  return out;
}
function reviewsToSend(cloudReviews, localReviews) {
  const out = [];
  for (const iso in (localReviews || {})) for (const id in localReviews[iso]) {
    const l = localReviews[iso][id], c = (cloudReviews[iso] || {})[id];
    if (!l || typeof l !== 'object') continue;
    for (const level in l) if (!(c && typeof c === 'object' && level in c)) out.push([iso, id, level, l[level]]);
  }
  return out;
}
