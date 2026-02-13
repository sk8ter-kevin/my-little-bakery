// My Little Bakery – Service Worker
// Provides offline support and durable caching so the app works without network.

const CACHE = "bakery-v1";

// ─── Install: pre-cache the app shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", "/index.html"]))
  );
  self.skipWaiting();
});

// ─── Activate: clean up old caches ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ─── Fetch: network-first for pages, cache-first for assets ───
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests from our own origin
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // HTML / navigation — try network first so updates arrive quickly
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache-first for speed
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return response;
      });
    })
  );
});
