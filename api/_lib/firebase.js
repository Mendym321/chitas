// Shared Firebase Admin helpers for the API routes.
// Files in api/_lib are not routes (Vercel skips names starting with "_").
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// The private key as pasted into Vercel: with "\n" written out or real line
// breaks, and with or without the quote marks it has in the Firebase JSON file
export function cleanPrivateKey(raw) {
  return String(raw || '').trim().replace(/^"(.*)"$/s, '$1').replace(/\\n/g, '\n');
}

function app() {
  if (!getApps().length) {
    // Say exactly which setting is missing (names only, never values)
    const missing = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].filter(k => !String(process.env[k] || '').trim());
    if (missing.length) throw new Error('missing in Vercel for this environment: ' + missing.join(', '));
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID.trim(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
      privateKey:  cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    })});
  }
  return getApps()[0];
}

export function getDb() { app(); return getFirestore(); }

// The signed-in user making the request, from "Authorization: Bearer <Firebase ID token>".
// Returns { uid, email }, or null when the token is missing or invalid.
export async function verifyUserToken(req) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  try { app(); const t = await getAuth().verifyIdToken(m[1]); return { uid: t.uid, email: t.email || '' }; }
  catch { return null; }
}

// Just the uid (or null)
export async function verifyUser(req) {
  return (await verifyUserToken(req))?.uid || null;
}

// Admins (can force-regenerate cached AI output). Set ADMIN_UIDS on Vercel to a
// comma-separated list of Firebase uids and/or sign-in emails — kept on the
// server so it can't be faked. `who` is what verifyUserToken returned.
export function isAdmin(who) {
  if (!who?.uid) return false;
  const list = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(who.uid.toLowerCase()) || (!!who.email && list.includes(who.email.toLowerCase()));
}
