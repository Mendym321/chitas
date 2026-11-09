/**
 * Chitas — Service Worker
 *
 * Strategy:
 * - App shell (HTML, fonts, icons): Cache first, update in background
 * - Sefaria/Hebcal API calls: Network first, fall back to cache
 * - Everything else: Network only
 *
 * This gives:
 * - Instant app loads after first visit (shell served from cache)
 * - Fresh content every day (API calls always try network first)
 * - Offline resilience (cached API responses shown if network fails)
 */

const VERSION     = 'v74';
const SHELL_CACHE = `chitas-shell-${VERSION}`;
const DATA_CACHE  = `chitas-data-${VERSION}`;

// App shell — cache on install, serve forever
const SHELL_URLS = [
  '/',
  '/fonts/TaameyFrankCLM-Medium.ttf',
  '/fonts/TaameyFrankCLM-Bold.ttf',
  '/fonts/Shlomo.ttf',
  '/fonts/ShlomoBold.ttf',
  '/fonts/Heilig.otf',
  '/fonts/OT Vilna Basic-VF.ttf',
  '/fonts/OT Siddur - Classic.ttf',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-32.png',
  '/icons/favicon.svg',
  '/icons/icon-180.png',
  '/icons/icon-maskable-512.png',
  '/manifest.json',
  '/js/chumash-data.js',
  '/js/chumash.js',
  '/js/tehillim.js',
  '/js/omer-data.js',
  '/js/omer.js',
  '/js/sefer-hamitzvos-data.js',
  '/js/sefer-hamitzvos.js',
  '/js/holidays-data.js',
  '/js/progress.js',
  '/js/reminders.js',
  '/js/learning-data.js',
  '/js/learning-stats.js',
  '/js/day-note.js',
  '/js/more-learning.js',
  '/js/account-merge.js',
  '/data/hayom-yom.json',
  '/data/guides/chumash.json',
  '/data/guides/rambam.json',
  '/data/guides/rambam-heads.json',
  '/data/sefer-hamitzvos.json',
  '/data/cycles.json',
  '/data/likkutei-torah.json',
];

// ── Install: cache the app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      // Use individual adds so one failure doesn't break everything
      Promise.allSettled(SHELL_URLS.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing logic ───────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Firebase / Firestore — always network only (auth-sensitive).
  // (fonts.googleapis.com is Google Fonts, handled further down.)
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('firestore') ||
      (url.hostname.includes('googleapis.com') && url.hostname !== 'fonts.googleapis.com')) {
    return;
  }

  // App shell files — network first for HTML (get latest), cache first for static assets
  if (isShellRequest(url)) {
    // HTML + app scripts: network first so deployments propagate immediately
    if (url.pathname === '/' || url.pathname.startsWith('/js/')) {
      event.respondWith(networkFirstWithCache(request, SHELL_CACHE, 60 * 60 * 24));
    } else {
      // Fonts/icons: cache first (they never change)
      event.respondWith(cacheFirstWithRefresh(request));
    }
    return;
  }

  // Sefaria + Hebcal API — network first, fall back to cache
  // Cache for 24 hours so offline use works
  if (url.hostname.includes('sefaria.org') ||
      url.hostname.includes('hebcal.com')) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE, 60 * 60 * 24));
    return;
  }

  // Our own enhance API — network first (Firestore handles its own caching)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE, 60 * 60 * 24));
    return;
  }

  // Google Fonts — cache first
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirstWithRefresh(request));
    return;
  }

  // Default: network only
});

function isShellRequest(url) {
  return url.origin === self.location.origin && (
    url.pathname === '/' ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname === '/manifest.json'
  );
}

// Cache first, refresh in background (stale-while-revalidate)
async function cacheFirstWithRefresh(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();   // copy now, before the page reads the body
      caches.open(SHELL_CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

// The saved texts are only for reading offline, so keep the newest few hundred
// (a cache lists its entries oldest first) instead of growing for ever.
const DATA_MAX = 400;
let _trimming = false;
async function trimCache(cache, max) {
  if (_trimming) return;
  _trimming = true;
  try {
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
  } catch {} finally { _trimming = false; }
}

// Network first, fall back to cache, store successful responses
async function networkFirstWithCache(request, cacheName, maxAgeSeconds) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      if (cacheName === DATA_CACHE) trimCache(cache, DATA_MAX);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
