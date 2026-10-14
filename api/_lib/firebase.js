// Shared Firebase Admin helpers for the API routes.
// Files in api/_lib are not routes (Vercel skips names starting with "_").
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function app() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    })});
  }
  return getApps()[0];
}

export function getDb() { app(); return getFirestore(); }

// The signed-in user making the request, from "Authorization: Bearer <Firebase ID token>".
// Returns the uid, or null when the token is missing or invalid.
export async function verifyUser(req) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  try { app(); return (await getAuth().verifyIdToken(m[1])).uid; }
  catch { return null; }
}

// Admins (can force-regenerate cached AI output). Set ADMIN_UIDS on Vercel to a
// comma-separated list of Firebase uids — kept on the server so it can't be faked.
export function isAdmin(uid) {
  return !!uid && (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).includes(uid);
}
