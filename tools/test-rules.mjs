/**
 * Tests for ../firestore.rules against the real Firestore emulator.
 * Run:  cd tools && npm run test:rules   (needs Java)
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-chitas',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 },
});

// Starting data, written with rules switched off (like the Firebase console)
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users/alice'), { name: 'Alice', streak: 3 });
  await setDoc(doc(db, 'users/admin1'), { name: 'Admin', isAdmin: true });
  await setDoc(doc(db, 'lsDict/גוט'), { translation: 'good' });
  await setDoc(doc(db, 'hayomYom/1-1'), { text: '...' });
  await setDoc(doc(db, 'quiz_cache/abc'), { questions: [] });
});

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const admin = env.authenticatedContext('admin1').firestore();
const guest = env.unauthenticatedContext().firestore();

let failed = 0;
async function check(name, promise) {
  try { await promise; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message.split('\n')[0]); }
}

console.log('Your own progress:');
await check('you can read your own progress', assertSucceeds(getDoc(doc(alice, 'users/alice'))));
await check('you can save your progress', assertSucceeds(setDoc(doc(alice, 'users/alice'), { streak: 4 }, { merge: true })));
await check('a new account can create its document', assertSucceeds(setDoc(doc(bob, 'users/bob'), { name: 'Bob', streak: 0 })));
await check('Reset progress (replace the whole document) works', assertSucceeds(setDoc(doc(alice, 'users/alice'), { name: 'Alice', streak: 0 })));
await check('an admin can reset and keep isAdmin', assertSucceeds(setDoc(doc(admin, 'users/admin1'), { name: 'Admin', streak: 0, isAdmin: true })));

console.log('Other people\'s data:');
await check('someone else can\'t read your progress', assertFails(getDoc(doc(bob, 'users/alice'))));
await check('someone else can\'t change your progress', assertFails(setDoc(doc(bob, 'users/alice'), { streak: 999 }, { merge: true })));
await check('signed out: can\'t read anyone\'s progress', assertFails(getDoc(doc(guest, 'users/alice'))));
await check('nobody can list all users', assertFails(getDocs(collection(alice, 'users'))));
await check('you can\'t delete your document from the app', assertFails(deleteDoc(doc(alice, 'users/alice'))));

console.log('Making yourself an admin:');
await check('can\'t add isAdmin to your own document', assertFails(setDoc(doc(alice, 'users/alice'), { isAdmin: true }, { merge: true })));
await check('can\'t create a new account that is already admin', assertFails(setDoc(doc(env.authenticatedContext('eve').firestore(), 'users/eve'), { isAdmin: true })));
await check('can\'t give yourself a role', assertFails(setDoc(doc(alice, 'users/alice'), { role: 'admin' }, { merge: true })));

console.log('Shared learning content:');
await check('anyone (even signed out) can read the dictionary', assertSucceeds(getDocs(collection(guest, 'lsDict'))));
await check('anyone can read Hayom Yom', assertSucceeds(getDoc(doc(guest, 'hayomYom/1-1'))));
await check('a normal user can\'t edit the dictionary', assertFails(setDoc(doc(alice, 'lsDict/גוט'), { translation: 'bad' })));
await check('an admin can edit the dictionary', assertSucceeds(setDoc(doc(admin, 'lsDict/גוט'), { translation: 'good', notes: '' })));
await check('nobody can change Hayom Yom from the app', assertFails(setDoc(doc(admin, 'hayomYom/1-1'), { text: 'x' })));

console.log('Server-only data:');
await check('the app can\'t read saved quizzes directly', assertFails(getDoc(doc(alice, 'quiz_cache/abc'))));
await check('the app can\'t write the quiz limits', assertFails(setDoc(doc(alice, 'quiz_usage/alice'), { count: 0 })));

await env.cleanup();
console.log(failed ? `\n${failed} FAILED` : '\nAll security-rules tests passed');
process.exit(failed ? 1 : 0);
