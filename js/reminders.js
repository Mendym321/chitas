// When reminders go off (the app version only). Pure: it only works out
// dates, so tools/test-reminders.mjs can check it; index.html hands the result
// to the phone. Design: see DESIGN.md, "Reminders and touch".
// Needs js/progress.js (isRestDay, progressISO) loaded first, and for the Omer
// reminder js/tehillim.js and js/omer.js.
//
// - Each section has its own time, or none: "Tanya in the morning, Rambam in
//   the afternoon". Sections at the same time come as one reminder.
// - Never on Shabbos or Yom Tov. The day before, only reminders up to 12:00
//   go; a later one would ring on Shabbos, so it doesn't go at all.
// - Not for a section already learned today, nor once its time has passed.
// - The Omer (off unless chosen): tonight's count at your time, during
//   Sefirah, but not on a night that is Shabbos or Yom Tov.
// The phone holds the next two weeks; the app refreshes them each time it
// opens and whenever you mark something.

const REMINDER_DAYS = 14;
const REMINDER_EREV_LATEST = 12 * 60;   // on an erev, no later than 12:00
const REMINDER_SECTIONS = ['chumash', 'tehillim', 'tanya', 'rambam', 'hayomYom'];

// 'HH:MM' → minutes after midnight, or null
function _reminderMinutes(t) {
  const [h, m] = String(t || '').split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
}

// times: { chumash: '08:30', tanya: '07:00', omer: '20:30', … } (missing = off)
// now: Date; done: what's learned today ({ tanya: true, … })
// → [{ id, at, sections: ['chumash', 'tehillim'] }] or [{ id, at, omer: 9 }], by time
function reminderPlans(times, now, done = {}) {
  const plan = [];
  for (let k = 0; k < REMINDER_DAYS; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    if (isRestDay(d)) continue;
    const erev = isRestDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    const slots = new Map();
    for (const sec of REMINDER_SECTIONS) {
      const t = _reminderMinutes(times?.[sec]);
      if (t === null || (k === 0 && done[sec]) || (erev && t > REMINDER_EREV_LATEST)) continue;
      slots.set(t, [...(slots.get(t) || []), sec]);
    }
    const ymd = Number(progressISO(d).replace(/-/g, ''));
    const at = t => new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(t / 60), t % 60);
    [...slots.keys()].sort((x, y) => x - y).forEach((t, i) => {
      if (at(t) > now) plan.push({ id: ymd * 100 + i, at: at(t), sections: slots.get(t) });
    });
    // Tonight's count of the Omer (the count of the coming day)
    const ot = _reminderMinutes(times?.omer);
    if (ot !== null && !erev && typeof omerDay === 'function') {
      const night = omerDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12));
      if (night && at(ot) > now) plan.push({ id: ymd * 100 + 99, at: at(ot), omer: night });
    }
  }
  return plan.sort((x, y) => x.at - y.at);
}

// A reminder that hasn't matched your days: its section wasn't learned on any
// of the last 7 learning days (Shabbos and Yom Tov don't count). → the
// section, or null. pastDone: { '2026-10-27': { tanya: true }, … }
function reminderNudge(times, pastDone, now) {
  for (const sec of REMINDER_SECTIONS) {
    if (_reminderMinutes(times?.[sec]) === null) continue;
    let days = 0, learned = false;
    for (let k = 1; days < 7 && k < 30; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k);
      if (isRestDay(d)) continue;
      days++;
      if ((pastDone || {})[progressISO(d)]?.[sec]) { learned = true; break; }
    }
    if (days === 7 && !learned) return sec;
  }
  return null;
}
