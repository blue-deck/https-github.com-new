const CACHE_PREFIX = "bluedeck-yachtos";
const CACHE_NAME = `${CACHE_PREFIX}-shell-v7`;
const PWA_ASSET_REVISION = "2026-08-01-1";
const OFFLINE_ICON_URL = `/app-icon-192.png?v=${PWA_ASSET_REVISION}`;

const urlsToCache = [
  OFFLINE_ICON_URL
];
const shellAssetUrls = new Set(urlsToCache);

const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <meta name="theme-color" content="#071631" />
    <title>BlueDeck Offline</title>
    <style>
      *{box-sizing:border-box}html,body{min-height:100%;margin:0}body{display:grid;min-height:100dvh;place-items:center;background:linear-gradient(145deg,#eef9fd,#fff);padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));color:#071631;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(100%,520px);border:1px solid rgba(7,22,49,.12);border-radius:32px;background:rgba(255,255,255,.94);padding:36px;text-align:center;box-shadow:0 28px 80px rgba(7,22,49,.14)}img{width:96px;height:96px;border-radius:22px}h1{margin:24px 0 0;font-family:Georgia,serif;font-size:clamp(38px,10vw,56px);font-weight:400}p{margin:16px auto 0;max-width:390px;color:#5b7088;font-size:17px;line-height:1.6}button{min-width:44px;min-height:48px;margin-top:24px;border:0;border-radius:16px;background:#071631;padding:12px 24px;color:#fff;font:800 16px/1.2 inherit}
    </style>
  </head>
  <body>
    <main class="card">
      <img src="${OFFLINE_ICON_URL}" alt="BlueDeck" />
      <h1>BlueDeck Offline</h1>
      <p>Connection is unavailable. Reconnect to continue with live yacht data.</p>
      <button type="button" onclick="location.reload()">Try again</button>
    </main>
  </body>
</html>`;

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    Promise.all([
      caches.keys().then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (cacheName) {
              return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME;
            })
            .map(function (cacheName) {
              return caches.delete(cacheName);
            })
        );
      }),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable().catch(function () {})
        : Promise.resolve(),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API responses can contain account data or short-lived signed media.
  // Never let any current or future API route enter CacheStorage.
  if (url.pathname.startsWith("/api/")) return;

  // Next.js owns the caching and invalidation of its generated assets.
  // Intercepting these paths can mix modules from different deployments.
  if (url.pathname.startsWith("/_next/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async function () {
        try {
          const preloadedResponse = await event.preloadResponse;
          return preloadedResponse || (await fetch(request));
        } catch {
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store"
            }
          });
        }
      })()
    );
    return;
  }

  const requestCacheKey = `${url.pathname}${url.search}`;
  if (shellAssetUrls.has(requestCacheKey)) {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then(function (networkResponse) {
          if (!isSafeShellResponse(networkResponse)) return networkResponse;

          const responseToCache = networkResponse.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(request, responseToCache);
            })
          );
          return networkResponse;
        })
        .catch(function () {
          return caches.match(request).then(function (cachedResponse) {
            return cachedResponse || Response.error();
          });
        })
    );
  }
});

function isSafeShellResponse(response) {
  if (!response || !response.ok) return false;

  const cacheControl = response.headers.get("Cache-Control") || "";
  return !/\b(?:no-store|private)\b/i.test(cacheControl);
}
