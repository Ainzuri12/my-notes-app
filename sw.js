// Service worker for the ForgeNotes app.
//
// The app shell (this page) is served network-first: whenever there's a
// connection, the latest deployed version is fetched and used immediately
// (and cached for later), so pushing a change to GitHub takes effect the
// very next time the app is opened — no manual versioning step needed.
// The cache is only used as a fallback when there's genuinely no
// connection at all. Everything else (web fonts) uses stale-while-
// revalidate instead, since those essentially never change and don't need
// to be fetched fresh on every load. Since the app's actual data lives in
// IndexedDB (not here), this cache only ever needs to hold the shell.
const CACHE_NAME = 'forgenotes-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle simple GETs — never intercept anything else (form posts,
  // etc. — this app doesn't have any, but better safe than sorry).
  if (event.request.method !== 'GET') return;

  const isAppShell = event.request.mode === 'navigate' ||
    event.request.url.endsWith('/index.html') ||
    event.request.url.endsWith('/manifest.webmanifest');

  if (isAppShell) {
    // Network-first for the app itself: always try to fetch the current
    // deploy when there's a connection, so a fresh push to GitHub shows up
    // the very next time the app is opened — no manual cache-version bump
    // needed. Only falls back to the cached copy if there's genuinely no
    // connection at all.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (web fonts, etc.) rarely changes, so stale-while-
  // revalidate is fine here: serve the cached copy instantly, and quietly
  // refresh it in the background for next time.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline — fall back to whatever's cached
      return cached || network;
    })
  );
});
