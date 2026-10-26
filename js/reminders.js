// When the daily reminder goes off (the app version only). Pure: it only
// works out dates, so tools/test-reminders.mjs can check it; index.html hands
// the result to the phone. Design: see DESIGN.md, "Reminders and touch".
// Needs js/progress.js (isRestDay, progressISO) loaded first.
//
// - At most one a day, at the time you chose.
// - Never on Shabbos or Yom Tov.
// - The day before Shabbos or Yom Tov, an evening time comes at midday
//   instead, so it never lands after candle lighting.
// - Not today once today's Chitas is done, or once the time has passed.
// The phone holds the next two weeks; the app refreshes them each time it
// opens and whenever you mark something.

const REMINDER_DAYS = 14;
const REMINDER_EREV_LATEST = 12;   // on an erev, no later than 12:00

// time: 'HH:MM'; now: Date; todayDone: today's Chitas is finished
function reminderPlan(time, now, todayDone) {
  const [h, m] = String(time || '').split(':').map(Number);
  if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return [];
  const plan = [];
  for (let k = 0; k < REMINDER_DAYS; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    if (isRestDay(d)) continue;
    if (k === 0 && todayDone) continue;
    const erev = isRestDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    const late = erev && (h > REMINDER_EREV_LATEST || (h === REMINDER_EREV_LATEST && m > 0));
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), late ? REMINDER_EREV_LATEST : h, late ? 0 : m);
    if (at <= now) continue;
    plan.push({ id: Number(progressISO(d).replace(/-/g, '')), at });
  }
  return plan;
}
