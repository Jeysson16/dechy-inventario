/* ================================================================
   Dechy PWA — Service Worker v3
   Strategy:
     • App shell + static assets  → Cache-First (offline-ready)
     • Firebase / Firestore API    → Network-First  (fresh data)
     • Google Fonts                → Stale-While-Revalidate
     • Everything else             → Network-First with cache fallback
   ================================================================ */

const CACHE_VERSION = "v3";
const STATIC_CACHE = `dechy-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dechy-dynamic-${CACHE_VERSION}`;
const FONTS_CACHE = `dechy-fonts-${CACHE_VERSION}`;

/* Resources to pre-cache on install */
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/img/logodechy.png",
];

/* ── Install ── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

/* ── Activate: purge old caches ── */
self.addEventListener("activate", (event) => {
  const KEEP = [STATIC_CACHE, DYNAMIC_CACHE, FONTS_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

/* ── Helpers ── */
function isFirebase(url) {
  return (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase.googleapis.com") ||
    url.includes("identitytoolkit.googleapis.com") ||
    url.includes("securetoken.googleapis.com")
  );
}

function isFont(url) {
  return (
    url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")
  );
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf)(\?.*)?$/.test(url);
}

/* Network-first: try network, fall back to cache */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

/* Cache-first: serve from cache, update in background */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

/* Stale-While-Revalidate: serve cache immediately, update in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || fetchPromise;
}

/* ── Fetch ── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  /* Skip non-GET and chrome-extension */
  if (request.method !== "GET") return;
  if (url.startsWith("chrome-extension://")) return;

  /* Firebase — let the browser handle it naturally without SW interception */
  if (isFirebase(url)) {
    return;
  }

  /* Fonts — stale-while-revalidate */
  if (isFont(url)) {
    event.respondWith(staleWhileRevalidate(request, FONTS_CACHE));
    return;
  }

  /* Static assets (JS/CSS/images) — cache-first */
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* Navigation (HTML pages) — network-first, fallback to index.html */
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  /* Everything else — network-first */
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

/* ── Push Notifications ── */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Dechy", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Dechy", {
      body: data.body || "",
      icon: "/img/logodechy.png",
      badge: "/img/logodechy.png",
      vibrate: [100, 50, 100],
      data: { url: data.url || "/tienda" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/tienda";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const existing = list.find(
          (c) => c.url.includes(target) && "focus" in c,
        );
        return existing ? existing.focus() : clients.openWindow(target);
      }),
  );
});

/* ── Background Sync (for deferred cart/order submissions) ── */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-cart") {
    event.waitUntil(syncCart());
  }
});

async function syncCart() {
  /* Placeholder — cart sync logic can be implemented here
     when IndexedDB offline queue is wired up */
  console.log("[SW] Background sync: sync-cart");
}
