const cacheName = "shinplay-v2-shell-5";
const shellAssets = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./assets/logo.png",
  "./assets/hero-background.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-512-maskable.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(shellAssets)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
