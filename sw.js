// Wakhi Sholẽ Hisobet service worker: works offline after the first visit.
// Bump VERSION whenever the page changes so phones pick up the new copy.
const VERSION = "v4";
const CORE = `wakhi-core-${VERSION}`;
const RUNTIME = `wakhi-runtime-${VERSION}`;
const PRECACHE = ["/", "/manifest.webmanifest", "/krd-logo.png",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"];

const OFFLINE_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wakhi Calendar</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0f171c;color:#e4ebee;font:16px system-ui;text-align:center;padding:24px">
<div><p style="font-size:22px;margin:0 0 8px">Wakhi Sholẽ Hisobet</p><p style="margin:0 0 16px;color:#93a4ad">No internet connection. Connect once to load the calendar, then it also works offline.</p>
<button onclick="location.reload()" style="font:inherit;padding:8px 18px;border-radius:999px;border:1px solid #eb9a5c;background:none;color:#eb9a5c">Try again</button></div></body>`;

// Only cache plain successful same-site responses; a redirect or error page must never replace the calendar.
const cacheable = res => res && res.ok && !res.redirected && (res.type === "basic" || res.type === "cors");

self.addEventListener("install", e => {
  // a failed precache must not block the app from installing
  e.waitUntil(caches.open(CORE)
    .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
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
  const sameOrigin = url.origin === location.origin;

  // the calendar page: network first so updates show, saved copy when offline, a small notice if nothing is saved yet
  if (req.mode === "navigate") {
    if (!sameOrigin || !(url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/index")) return;
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (cacheable(res)) { const copy = res.clone(); caches.open(CORE).then(c => c.put("/", copy)).catch(() => {}); }
        return res;
      } catch (err) {
        return (await caches.match("/")) ||
          new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  // photos, PDFs, icons and Google Fonts: serve the saved copy, refresh it in the background
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return;
  e.respondWith((async () => {
    const hit = await caches.match(req);
    const net = fetch(req).then(res => {
      if (cacheable(res) || (fonts && res.type === "opaque")) {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => hit || Response.error());
    return hit || net;
  })());
});
