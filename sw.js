// sw.js — Service Worker pour cache offline
const CACHE = "budget-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app.js",
  "./db.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(
      (r) =>
        r ||
        fetch(event.request)
          .then((resp) => {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
            return resp;
          })
          .catch(() => caches.match("./"))
    )
  );
});
