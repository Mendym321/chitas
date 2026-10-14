// A simple per-user daily limit stored in Firestore: quota_<bucket>/{uid} = { date, count }.
// Returns true and counts one use, or false when the limit for today is reached.
export async function takeDailyQuota(db, uid, bucket, limit) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.collection(bucket + '_usage').doc(uid);
  return db.runTransaction(async tx => {
    const d = (await tx.get(ref)).data() || {};
    const count = d.date === today ? d.count || 0 : 0;
    if (count >= limit) return false;
    tx.set(ref, { date: today, count: count + 1 });
    return true;
  });
}
