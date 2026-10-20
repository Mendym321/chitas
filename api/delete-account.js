/**
 * POST /api/delete-account — delete the signed-in user's account and data.
 *
 * Header: Authorization: Bearer <Firebase ID token>
 * Deletes: their progress and settings (users/{uid}), their daily-limit
 * counters (quiz_usage, tanya_usage), and their sign-in itself. Shared,
 * anonymous things (saved quizzes, Tanya guides) aren't anyone's data, so stay.
 *
 * It runs on the server because the Firestore rules don't let the app delete
 * a user document (so a bug in the app can never wipe anyone).
 */
import { getDb, verifyUser, deleteAuthUser } from './_lib/firebase.js';

const COLLECTIONS = ['users', 'quiz_usage', 'tanya_usage'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Sign in first' });
  try {
    const db = getDb();
    await Promise.all(COLLECTIONS.map(c => db.collection(c).doc(uid).delete()));
    await deleteAuthUser(uid);
    return res.status(200).json({ deleted: true });
  } catch (e) {
    console.error('delete-account:', e);
    return res.status(500).json({ error: 'Could not delete the account. Please try again.' });
  }
}
