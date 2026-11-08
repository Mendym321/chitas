/**
 * Browser test: signing in inside the phone app (iPhone / Android). There,
 * the phone's own plugin (@capacitor-firebase/authentication) signs in with
 * Apple or Google and hands back a token; the real Firebase web code here
 * then signs in with that token. We run the real Firebase code (from
 * tools/node_modules) with a stand-in plugin, and read what Firebase sends to
 * Google's sign-in server (stopped there: no real account is touched).
 *
 * Run:  cd tools && npm run test:signin
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const FB = new URL('./node_modules/firebase/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(await readFile(join(ROOT, path === '/' ? 'index.html' : path))); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });

let failed = 0;
const ok = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', JSON.stringify(expected), '\n      got:     ', JSON.stringify(actual)); }
};

// A page with (platform) or without (null) the phone app around it
async function open(platform) {
  const page = await browser.newPage();
  const sent = [];   // what Firebase sends to Google's sign-in server
  await page.route(u => !u.href.startsWith(url), async r => {
    const u = r.request().url();
    const m = u.match(/^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z]+\.js)$/);
    if (m) {   // the real Firebase web code, from tools/node_modules
      const body = (await readFile(FB + m[1], 'utf8')).replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\//g, 'https://www.gstatic.com/firebasejs/10.12.0/');
      return r.fulfill({ status: 200, contentType: 'text/javascript', body });
    }
    if (u.includes('identitytoolkit.googleapis.com')) {
      sent.push({ path: new URL(u).pathname, body: r.request().postData() || '' });
      return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'INVALID_IDP_RESPONSE' } }) });
    }
    return r.abort();
  });
  if (platform) await page.addInitScript(platform => {
    const calls = window.__pluginCalls = [];
    window.__pluginMode = 'ok';
    const answer = (name, r) => o => { calls.push([name, o || null]);
      return window.__pluginMode === 'cancel' ? Promise.reject(new Error('The user canceled the sign-in flow.')) : Promise.resolve(r); };
    window.Capacitor = {
      isNativePlatform: () => true, getPlatform: () => platform,
      isPluginAvailable: n => n === 'FirebaseAuthentication',
      Plugins: { FirebaseAuthentication: {
        signInWithApple: answer('apple', { user: { displayName: 'Levi Cohen' }, credential: { providerId: 'apple.com', idToken: 'apple-id-token', nonce: 'raw-nonce-1', authorizationCode: 'apple-code-1' } }),
        signInWithGoogle: answer('google', { user: null, credential: { providerId: 'google.com', idToken: 'google-id-token' } }),
        signOut: () => { calls.push(['signOut', null]); return Promise.resolve(); },
      } },
    };
  }, platform);
  await page.goto(url);
  await page.waitForFunction(() => window._fb && typeof window._fb.signInApple === 'function', null, { timeout: 15000 });
  return { page, sent };
}

console.log('In a browser');
{
  const { page } = await open(null);
  ok('no Apple button (it needs Apple\'s web set-up first)', await page.evaluate(() => { openSignIn('save'); return getComputedStyle(document.getElementById('signin-apple-btn')).display; }), 'none');
  ok('Google is there', await page.evaluate(() => getComputedStyle(document.getElementById('ob-google-btn')).display !== 'none'), true);
  await page.close();
}

console.log('In the iPhone app');
{
  const { page, sent } = await open('ios');
  ok('the Apple button shows, above Google', await page.evaluate(() => { openSignIn('save'); const a = document.getElementById('signin-apple-btn'); return [getComputedStyle(a).display !== 'none', !!(a.compareDocumentPosition(document.getElementById('ob-google-btn')) & Node.DOCUMENT_POSITION_FOLLOWING)]; }), [true, true]);

  await page.evaluate(() => window._fb.signInApple().catch(() => {}));
  const apple = sent.find(s => s.path.includes('signInWithIdp'));
  const appleBody = apple ? JSON.parse(apple.body) : {};
  const post = new URLSearchParams(appleBody.postBody || '');
  ok('Apple: the phone is asked, without signing in natively', await page.evaluate(() => window.__pluginCalls[0]), ['apple', { skipNativeAuth: true }]);
  ok('Apple: Firebase signs in with the phone\'s token and nonce', [post.get('providerId'), post.get('id_token'), post.get('nonce')], ['apple.com', 'apple-id-token', 'raw-nonce-1']);
  ok('Apple: the name from the first sign-in is kept for the account', await page.evaluate(() => window._fb.pendingName), 'Levi Cohen');

  await page.evaluate(() => window._fb.signInGoogle().catch(() => {}));
  const google = sent.filter(s => s.path.includes('signInWithIdp'))[1];
  const gpost = new URLSearchParams(google ? JSON.parse(google.body).postBody : '');
  ok('Google: the phone is asked, without signing in natively', await page.evaluate(() => window.__pluginCalls[1]), ['google', { skipNativeAuth: true }]);
  ok('Google: Firebase signs in with the phone\'s token', [gpost.get('providerId'), gpost.get('id_token')], ['google.com', 'google-id-token']);

  // Closing Apple's sheet isn't an error
  const shown = await page.evaluate(async () => {
    window.__pluginMode = 'cancel';
    openSignIn('save');
    await signInWith('apple');
    return getComputedStyle(document.getElementById('ob-signin-error')).display;
  });
  ok('closing the phone\'s sign-in says nothing', shown, 'none');
  ok('and the buttons work again', await page.evaluate(() => [...document.querySelectorAll('#signin-sheet button')].every(b => !b.disabled)), true);

  await page.evaluate(() => window._fb.signOut());
  ok('signing out also signs out on the phone (it asks which account next time)', await page.evaluate(() => window.__pluginCalls.some(c => c[0] === 'signOut')), true);
  await page.close();
}

console.log('In the Android app');
{
  const { page } = await open('android');
  ok('no Apple button (Google only, as stores expect)', await page.evaluate(() => { openSignIn('save'); return getComputedStyle(document.getElementById('signin-apple-btn')).display; }), 'none');
  await page.close();
}

await browser.close();
server.close();
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nAll sign-in tests passed');
