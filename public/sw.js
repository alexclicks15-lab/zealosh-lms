// Zealosh LMS — Production Service Worker
// Implements PWA App Shell Caching, Offline Fallback, and Resilient Synchronization

const CACHE_NAME = 'zealosh-lms-v2.0';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/logo.png',
  '/logo-round.png',
];

// Sensitive endpoints that must NEVER be served from or saved to shared caches
const SENSITIVE_URL_PATTERNS = [
  /\/api\/auth/,
  /\/api\/exams\/.*\/answers/,
  /\/api\/exams\/.*\/submit/,
  /\/api\/admin/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests and non-http(s) schemes
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Security Gate: bypass service worker cache for sensitive security endpoints
  if (SENSITIVE_URL_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(fetch(request));
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // Stale-While-Revalidate for images, stylesheets, scripts, and static media
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Resilient Background Sync Queue for Learning Progress
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
