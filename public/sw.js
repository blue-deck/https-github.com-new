const CACHE_NAME = "bluedeck-yachtos-v1";

const urlsToCache = [
  "/",
  "/login",
  "/offline",
  "/manifest.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request).then(function (response) {
        return response || caches.match("/offline");
      });
    })
  );
});