// Combine progress made while signed out ("guest") with the account someone
// signs in to. Nothing is lost and no points are counted twice.
// Needs js/progress.js (pointsForDay, progressISO). Tested by tools/test-account-merge.mjs.

// Put a user's "today" list into history if their last active day isn't today
function _archiveOldToday(u, todayISO) {
  const pastDone = { ...(u.pastDone || {}) };
  let done = { ...(u.done || {}) };
  const last = u.lastDate ? String(u.lastDate).slice(0, 10) : null;
  if (last && last !== todayISO) {
    if (Object.values(done).some(Boolean)) pastDone[last] = { ...(pastDone[last] || {}), ...done };
    done = {};
  }
  return { pastDone, done };
}

// Sections both had marked on the same day (so their points were earned twice)
function _overlap(a, b) {
  const both = {};
  for (const id in a || {}) if (a[id] && b && b[id]) both[id] = true;
  return both;
}

function mergeGuestIntoAccount(guest, remote, today) {
  const todayISO = progressISO(today);
  if (!remote) return { ...guest }; // brand-new account: the guest's progress becomes it

  const g = _archiveOldToday(guest, todayISO);
  const r = _archiveOldToday(remote, todayISO);

  // Days: a section counts if it was marked on either
  const pastDone = { ...r.pastDone };
  let doublePoints = 0;
  for (const iso in g.pastDone) {
    doublePoints += pointsForDay(_overlap(g.pastDone[iso], r.pastDone[iso]));
    pastDone[iso] = { ...(r.pastDone[iso] || {}), ...g.pastDone[iso] };
  }
  doublePoints += pointsForDay(_overlap(g.done, r.done));
  const done = { ...r.done, ...g.done };

  // Personal Tehillim names: keep everyone (by name + birthday)
  const people = [...(remote.tehillimPeople || [])];
  const key = p => [p.label, p.heDay, p.heMonth, p.heYear].join('|');
  const have = new Set(people.map(key));
  for (const p of guest.tehillimPeople || []) if (!have.has(key(p))) people.push(p);

  return {
    ...guest,
    ...remote,                       // account settings win (track, city, name…)
    pastDone,
    done,
    lastDate: todayISO,
    xp: Math.max(0, (remote.xp || 0) + (guest.xp || 0) - doublePoints),
    longestStreak: Math.max(remote.longestStreak || 0, guest.longestStreak || 0),
    tehillimPeople: people,
    extraTracks: [...new Set([...(remote.extraTracks || []), ...(guest.extraTracks || [])])],
  };
}
