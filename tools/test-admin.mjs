/**
 * isAdmin() accepts uids or emails from ADMIN_UIDS (api/_lib/firebase.js).
 * Run:  cd tools && npm test
 */
import { isAdmin } from '../api/_lib/firebase.js';
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
console.log(failed ? `\n${failed} FAILED` : '\nAll admin tests passed');
process.exit(failed ? 1 : 0);
