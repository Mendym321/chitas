/**
 * isAdmin() accepts uids or emails from ADMIN_UIDS (api/_lib/firebase.js).
 * Run:  cd tools && npm test
 */
import { isAdmin, cleanPrivateKey, describeKey, getDb } from '../api/_lib/firebase.js';
let failed = 0;
const check = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
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
// A real key (made fresh for the test), damaged the ways pasting damages it;
// each must come out as a key Firebase itself accepts
const { generateKeyPairSync } = await import('node:crypto');
const { cert } = await import('firebase-admin/app');
const KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const written = KEY.replace(/\n/g, '\\n');
const accepted = raw => { try { cert({ projectId: 'p', clientEmail: 'a@b.iam.gserviceaccount.com', privateKey: cleanPrivateKey(raw) }); return true; } catch (e) { return e.message; } };
check('"\\n" written out', accepted(written), true);
check('with the quote marks from the JSON file', accepted('"' + written + '"'), true);
check('with quote marks and a trailing comma', accepted('"' + written + '",'), true);
check('line breaks turned into spaces', accepted(KEY.replace(/\n/g, ' ')), true);
check('the whole JSON file pasted', accepted(JSON.stringify({ type: 'service_account', private_key: KEY, client_email: 'x' })), true);
check('"\\\\n" written out twice', accepted(KEY.replace(/\n/g, '\\\\n')), true);
check('real line breaks, extra spaces', accepted('  ' + KEY + ' \n'), true);
check('a cut-off key is described without showing it', [describeKey(KEY.slice(0, 600)), describeKey(KEY.slice(0, 600)).includes(KEY.slice(40, 80))],
  ['no "-----END PRIVATE KEY-----" line; only 600 characters (a full key is about 1,700)', false]);
const saved = { ...process.env };
delete process.env.FIREBASE_PRIVATE_KEY; process.env.FIREBASE_PROJECT_ID = 'p'; process.env.FIREBASE_CLIENT_EMAIL = '';
let msg = ''; try { getDb(); } catch (e) { msg = e.message; }
Object.assign(process.env, saved);
check('a missing setting is named (never its value)', msg, 'missing in Vercel for this environment: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');

console.log(failed ? `\n${failed} FAILED` : '\nAll admin tests passed');
process.exit(failed ? 1 : 0);
