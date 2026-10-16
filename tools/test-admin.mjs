/**
 * isAdmin() accepts uids or emails from ADMIN_UIDS (api/_lib/firebase.js).
 * Run:  cd tools && npm test
 */
import { isAdmin, cleanPrivateKey, getDb } from '../api/_lib/firebase.js';
let failed = 0;
const check = (name, actual, expected) => {
  if (actual === expected) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, 'expected', expected, 'got', actual); }
};
console.log('Admins (ADMIN_UIDS):');
process.env.ADMIN_UIDS = 'aB3xYz123, Mendy@Example.com';
check('listed uid → admin', isAdmin({ uid: 'aB3xYz123', email: 'x@y.com' }), true);
check('listed email (any capitals) → admin', isAdmin({ uid: 'other', email: 'mendy@example.com' }), true);
check('not listed → not admin', isAdmin({ uid: 'other', email: 'someone@else.com' }), false);
check('not signed in → not admin', isAdmin(null), false);
process.env.ADMIN_UIDS = '';
check('empty list → nobody is admin', isAdmin({ uid: '', email: '' }), false);
console.log('Firebase key as pasted into Vercel:');
const KEY = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----';
const written = KEY.replace(/\n/g, '\\n');
check('"\\n" written out → real line breaks', cleanPrivateKey(written), KEY);
check('with the quote marks from the JSON file', cleanPrivateKey('"' + written + '"'), KEY);
check('already real line breaks, extra spaces', cleanPrivateKey('  ' + KEY + '\n '), KEY);
const saved = { ...process.env };
delete process.env.FIREBASE_PRIVATE_KEY; process.env.FIREBASE_PROJECT_ID = 'p'; process.env.FIREBASE_CLIENT_EMAIL = '';
let msg = ''; try { getDb(); } catch (e) { msg = e.message; }
Object.assign(process.env, saved);
check('a missing setting is named (never its value)', msg, 'missing in Vercel for this environment: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');

console.log(failed ? `\n${failed} FAILED` : '\nAll admin tests passed');
process.exit(failed ? 1 : 0);
