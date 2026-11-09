// Combine progress made while signed out ("guest") with the account someone
// signs in to. Nothing is lost.
// Needs js/progress.js (progressISO, daysFrom, dayView). Tested by tools/test-account-merge.mjs.

function mergeGuestIntoAccount(guest, remote, today) {
  const todayISO = progressISO(today);
  // Marks by date (js/progress.js: daysFrom): the account's, and every mark
  // made on this phone added to it
  const days = daysFrom(remote || {}), reviews = reviewsFrom(remote || {});
  const gDays = daysFrom(guest || {}), gReviews = reviewsFrom(guest || {});
  for (const iso in gDays) for (const id in gDays[iso]) if (gDays[iso][id]) (days[iso] = days[iso] || {})[id] = true;
  for (const iso in gReviews) reviews[iso] = _mergeQuizDay(reviews[iso], gReviews[iso]);
  const view = dayView(days, reviews, todayISO);
  if (!remote) return { ...guest, days, reviews, ...view }; // brand-new account: the guest's progress becomes it

  // Personal Tehillim names: keep everyone (by name + birthday)
  const people = [...(remote.tehillimPeople || [])];
  const key = p => [p.label, p.heDay, p.heMonth, p.heYear].join('|');
  const have = new Set(people.map(key));
  for (const p of guest.tehillimPeople || []) if (!have.has(key(p))) people.push(p);

  return {
    ...guest,
    ...remote,                       // account settings win (track, city, name…)
    days, reviews, ...view,
    longestStreak: Math.max(remote.longestStreak || 0, guest.longestStreak || 0),
    tehillimPeople: people,
    extraTracks: [...new Set([...(remote.extraTracks || []), ...(guest.extraTracks || [])])],
    tanyaLog: { ...(remote.tanyaLog || {}), ...(guest.tanyaLog || {}) },
    milestones: [...new Set([...(remote.milestones || []), ...(guest.milestones || [])])],
    tanyaParts: { ...(remote.tanyaParts || {}), ...(guest.tanyaParts || {}) },
  };
}
