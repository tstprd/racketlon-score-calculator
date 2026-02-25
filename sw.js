/**
 * Service Worker for Racketlon Calc PWA
 * Enables offline functionality
 */

const CACHE_NAME = "racketlon-calc-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/scoring.js",
  "/ocr.js",
  "/manifest.json",
];

// Install - cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

// Fetch - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached version or fetch from network
      const fetchPromise = fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, return cached if available
          return cached;
        });

      return cached || fetchPromise;
    }),
  );
});
