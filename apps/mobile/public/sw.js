const CACHE_VERSION = 'v1';
const SHELL_CACHE = `ner-shell-${CACHE_VERSION}`;

/**
 * App shell precache list. Paths are resolved relative to THIS worker's
 * location (public/sw.js → served at the app base), so the same list works
 * in `vite dev` and in the built `dist/` at any hosting path. Vite hashes
 * built assets, so we runtime-cache first-party responses below instead of
 * guessing hashed names here.
 */
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)),
  );
  self.skipWaiting(); // don't wait for old tabs to close before activating
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER intercept Firebase/Firestore traffic — its SDK owns retries,
  // streaming, and auth headers. Intercepting this breaks real-time
  // listeners in ways that are hard to debug (guide Phase 3).
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  // same-origin, first-party assets: cache-first, then network (which also
  // refreshes the cache), then the shell page as an offline fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => cached || caches.match('./index.html'));
        return cached || network;
      }),
    );
  }
  // cross-origin non-Firebase requests pass through untouched
});

// Android only — iOS Safari ignores this event entirely (guide §A.5). The
// page's foreground-flush path is the real workhorse; this is a bonus that
// just nudges any open client to flush early.
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-outbox') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'FLUSH_OUTBOX' }));
      }),
    );
  }
});
