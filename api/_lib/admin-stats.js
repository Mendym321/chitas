// What the admin page shows: how the app is used, as counts only.
// Nothing here returns a name, email, city, Tehillim names, user id or any
// one person's history; each number is a count of people or of things.
// Pure (no database), so tools/test-admin-stats.mjs can check it.

export const SECTIONS = ['chumash', 'tehillim', 'tanya', 'rambam'];

const iso = d => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => { const d = new Date(isoDate + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const isChitas = day => SECTIONS.every(id => day && day[id]);

// The days someone marked anything, as { iso: { chumash: true, … } }
function daysOf(u) {
  const days = { ...(u.pastDone || {}) };
  const last = u.lastDate ? String(u.lastDate).slice(0, 10) : null;
  if (last && u.done && Object.values(u.done).some(Boolean)) days[last] = { ...(days[last] || {}), ...u.done };
  return days;
}

// Reviews taken: { iso: { section: { quick: {r, n} | number, deep: … } } }
function reviewsOf(u) {
  const out = { ...(u.pastQuizDone || {}) };
  const last = u.lastDate ? String(u.lastDate).slice(0, 10) : null;
  if (last && u.quizDone && Object.keys(u.quizDone).length) out[last] = { ...(out[last] || {}), ...u.quizDone };
  return out;
}

// users: the user documents; ai: counts from the server's own collections;
// signups: when each sign-in was created (ISO strings), no one's name with it
export function summarize(users, { today, signups = [], ai = {} }) {
  const from30 = addDays(today, -29), from7 = addDays(today, -6);
  const daily = Array.from({ length: 30 }, (_, i) => ({ date: addDays(from30, i), learned: 0, chitas: 0 }));
  const dayIndex = Object.fromEntries(daily.map((d, i) => [d.date, i]));
  const sections30 = Object.fromEntries(SECTIONS.map(id => [id, 0]));
  const active = { today: 0, last7: 0, last30: 0 };
  const streaks = { 'None now': 0, '1–6 days': 0, '7–29 days': 0, '30+ days': 0 };
  const reviews = { last30: 0, quick: 0, deep: 0, right: 0, asked: 0 };
  const rambamTracks = { '3 chapters': 0, '1 chapter': 0, 'Sefer HaMitzvos': 0 };
  const moreLearning = {};

  for (const u of users) {
    const days = daysOf(u);
    const learnedOn = Object.keys(days).filter(d => Object.values(days[d] || {}).some(Boolean));
    if (learnedOn.includes(today)) active.today++;
    if (learnedOn.some(d => d >= from7 && d <= today)) active.last7++;
    if (learnedOn.some(d => d >= from30 && d <= today)) active.last30++;
    for (const d of learnedOn) {
      if (!(d in dayIndex)) continue;
      daily[dayIndex[d]].learned++;
      if (isChitas(days[d])) daily[dayIndex[d]].chitas++;
      for (const id of SECTIONS) if (days[d][id]) sections30[id]++;
    }
    // A streak only counts while it's alive (learned today or yesterday)
    const recent = learnedOn.includes(today) || learnedOn.includes(addDays(today, -1));
    const s = recent ? (u.streak || 0) : 0;
    streaks[s >= 30 ? '30+ days' : s >= 7 ? '7–29 days' : s >= 1 ? '1–6 days' : 'None now']++;

    const rv = reviewsOf(u);
    for (const d in rv) {
      if (d < from30 || d > today) continue;
      for (const sec in rv[d] || {}) for (const level of ['quick', 'deep']) {
        const r = rv[d][sec]?.[level];
        if (r == null || r === false) continue;
        reviews.last30++; reviews[level]++;
        if (typeof r === 'object' && r.n) { reviews.right += r.r || 0; reviews.asked += r.n; }
      }
    }
    const t = { '3': '3 chapters', '1': '1 chapter', m: 'Sefer HaMitzvos' }[u.rambamTrack];
    if (t) rambamTracks[t]++;
    for (const id of u.extraTracks || []) if (id !== 'hayomYom') moreLearning[id] = (moreLearning[id] || 0) + 1;
  }

  // Sign-ups per week (weeks start on Sunday), the last 12 weeks
  const weekOf = d => { const x = new Date(d.slice(0, 10) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return iso(x); };
  const thisWeek = weekOf(today);
  const weeks = Array.from({ length: 12 }, (_, i) => ({ week: addDays(thisWeek, -7 * (11 - i)), n: 0 }));
  const wIndex = Object.fromEntries(weeks.map((w, i) => [w.week, i]));
  for (const s of signups) { const w = weekOf(s); if (w in wIndex) weeks[wIndex[w]].n++; }

  return {
    today,
    accounts: { total: users.length, signIns: signups.length, signedUpByWeek: weeks },
    active, daily, sections30, streaks,
    reviews: { last30: reviews.last30, quick: reviews.quick, deep: reviews.deep,
               rightPct: reviews.asked ? Math.round(reviews.right / reviews.asked * 100) : null },
    rambamTracks, moreLearning,
    ai: {
      quizzesSaved: ai.quizzesSaved || 0,
      quizzesByDay: daily.map(d => ({ date: d.date, n: (ai.quizDates || []).filter(x => x === d.date).length })),
      quizRequestsToday: ai.quizRequestsToday || 0, quizPeopleToday: ai.quizPeopleToday || 0,
      tanyaGuides: ai.tanyaGuides || 0, tanyaFailed: ai.tanyaFailed || 0,
      tanyaRequestsToday: ai.tanyaRequestsToday || 0,
    },
  };
}
