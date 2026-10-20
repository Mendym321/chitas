// Shared Firebase Admin helpers for the API routes.
// Files in api/_lib are not routes (Vercel skips names starting with "_").
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// The private key as pasted into Vercel, repaired the ways pasting goes wrong:
// the whole Firebase JSON file pasted, quote marks or a trailing comma copied
// from it, "\n" written out, or line breaks turned into spaces. The key itself
// is rebuilt in the standard shape (64 characters a line between the
// BEGIN/END lines).
export function cleanPrivateKey(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('{')) { try { s = JSON.parse(s).private_key || s; } catch {} }
  s = s.replace(/,\s*$/, '').trim().replace(/^(["'])([\s\S]*)\1$/, '$2');
  s = s.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '');
  const m = s.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  if (!m) return s;
  const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
  return `-----BEGIN ${m[1]}-----\n${body.match(/.{1,64}/g)?.join('\n') || ''}\n-----END ${m[1]}-----\n`;
}

// What's wrong with a key that still can't be read, without showing any of it
export function describeKey(raw) {
  const s = String(raw || '').trim();
  return [
    s.startsWith('{') ? 'looks like the whole JSON file' : null,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s) ? null : 'no "-----BEGIN PRIVATE KEY-----" line',
    /-----END [A-Z ]*PRIVATE KEY-----/.test(s) ? null : 'no "-----END PRIVATE KEY-----" line',
    s.length < 1000 ? 'only ' + s.length + ' characters (a full key is about 1,700)' : null,
  ].filter(Boolean).join('; ') || 'the key itself seems damaged; copy it again from a new Firebase key file';
}

function app() {
  if (!getApps().length) {
    // Say exactly which setting is missing (names only, never values)
    const missing = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].filter(k => !String(process.env[k] || '').trim());
    if (missing.length) throw new Error('missing in Vercel for this environment: ' + missing.join(', '));
    let credential;
    try {
      credential = cert({
        projectId:   process.env.FIREBASE_PROJECT_ID.trim(),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
        privateKey:  cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      });
    } catch {
      throw new Error('FIREBASE_PRIVATE_KEY in Vercel can\'t be read: ' + describeKey(process.env.FIREBASE_PRIVATE_KEY));
    }
    initializeApp({ credential });
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

// Delete someone's sign-in (their Google/Apple link to this app)
export async function deleteAuthUser(uid) {
  app();
  try { await getAuth().deleteUser(uid); }
  catch (e) { if (e?.code !== 'auth/user-not-found') throw e; }   // already gone is fine
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
