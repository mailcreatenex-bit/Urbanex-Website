/* Urbanex service worker: small on purpose.
   - installable app shell + offline page
   - static files cached (stale-while-revalidate); pages network-first; the API and big media are never cached
   - Web Push: shows notifications and opens the link when tapped */
const VERSION = "urbanex-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(["/offline.html", "/icons/icon-192.png", "/brand/urbanex-logo.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                         // third-party (YouTube, Meta, maps): leave alone
  if (url.pathname.startsWith("/api/")) return;                           // live data always comes from the network
  if (req.headers.has("range") || /\.(mp4|webm|mov)$/i.test(url.pathname)) return;   // never cache video

  // Pages: network first so visitors always get the latest site; fall back to the last copy, then the offline page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(PAGES).then((c) => c.put("/", copy)); return res; })
        .catch(async () => (await caches.match("/")) || (await caches.match("/offline.html")))
    );
    return;
  }

  // Static files (hashed bundles, images, icons): serve from cache instantly, refresh in the background
  if (/^\/(static|brand|icons)\//.test(url.pathname) || /\.(png|jpg|jpeg|webp|svg|woff2?|css|js)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || refresh;
      })
    );
  }
});

// ---- Web Push ----
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Urbanex Realty", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Urbanex Realty";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      image: data.image || undefined,
      tag: data.tag || undefined,          // same tag replaces an older notification instead of stacking
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // only ever open pages of this site, whatever the payload says
  let target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  if (target.origin !== self.location.origin) target = new URL("/", self.location.origin);
  target = target.href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) { open.navigate(target); return open.focus(); }
      return self.clients.openWindow(target);
    })
  );
});
