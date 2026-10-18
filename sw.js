// Wakhi Sholẽ Hisobet service worker: works offline after the first visit.
// Bump VERSION whenever the page changes so phones pick up the new copy.
const VERSION = "v1";
const CORE = `wakhi-core-${VERSION}`;
const RUNTIME = `wakhi-runtime-${VERSION}`;
const PRECACHE = ["/", "/manifest.webmanifest", "/krd-logo.png",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CORE && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // the page itself: try the network first so updates show, fall back to the saved copy offline
  if (req.mode === "navigate") {
    e.respondWith(fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CORE).then(c => c.put("/", copy)); return res; })
      .catch(() => caches.match("/")));
    return;
  }

  // photos, PDFs, icons and Google Fonts: serve the saved copy, refresh it in the background
  const sameOrigin = url.origin === location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return;
  e.respondWith(caches.open(RUNTIME).then(async cache => {
    const hit = await caches.match(req);
    const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
