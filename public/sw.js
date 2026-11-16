// Offline support for the installed (Add to Dock / Home Screen) app.
// Page: network first, so updates arrive on the next launch; falls back to the cached copy offline.
// Hashed build assets: cache first (their names change whenever their content does).
// Google Fonts: served from cache, refreshed in the background.
const CACHE = 'rentry-builder-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) caches.open(CACHE).then((c) => c.put(req, res));
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => put('./', res.clone()) && res)
        .catch(() => caches.match('./')),
    );
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res.clone()) && res)));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then((hit) => {
        const fresh = fetch(req).then((res) => put(req, res.clone()) && res).catch(() => hit);
        return hit || fresh;
      }),
    );
  }
});
