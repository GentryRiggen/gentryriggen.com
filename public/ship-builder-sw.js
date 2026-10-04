/* Ship Builder service worker: lets the home-screen app work offline.
 *
 * Registered by components/ship-builder/hooks/useServiceWorker.ts with scope
 * "/ship-builder", so it only controls the Ship Builder page. Rules:
 * - Only same-origin GET requests are ever handled; everything else goes
 *   straight to the network untouched.
 * - Navigations to the Ship Builder page: network-first, falling back to the
 *   cached page when offline.
 * - /_next/static/* (content-hashed, immutable): cache-first.
 * - Only `ok`, same-origin (`type === "basic"`), non-redirected responses are
 *   cached, so opaque or cross-origin responses never enter the cache.
 * - The page posts { type: "CACHE_URLS", urls } with the resources it has
 *   already loaded, so a single online visit is enough to play offline.
 */

const CACHE_PREFIX = "ship-builder-";
const CACHE = `${CACHE_PREFIX}v1`;
const PAGE_PATH = "/ship-builder";
const STATIC_PREFIX = "/_next/static/";
/** Upper bound on URLs accepted from one CACHE_URLS message. */
const MAX_PRECACHE_URLS = 300;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** True for the page itself ("/ship-builder", its .html file or sub-paths). */
function isPagePath(pathname) {
  return (
    pathname === PAGE_PATH ||
    pathname === `${PAGE_PATH}.html` ||
    pathname.startsWith(`${PAGE_PATH}/`)
  );
}

function isStaticAsset(pathname) {
  return pathname.startsWith(STATIC_PREFIX);
}

function isCacheable(response) {
  return (
    Boolean(response) &&
    response.ok &&
    response.type === "basic" &&
    !response.redirected
  );
}

/** Parses a same-origin URL, or returns null for anything else. */
function toSameOriginUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url : null;
  } catch {
    return null;
  }
}

/** Pages are stored without query/hash, plus under the canonical page path. */
async function cachePage(cache, url, response) {
  const key = `${url.origin}${url.pathname}`;
  await Promise.all([
    cache.put(key, response.clone()),
    cache.put(new URL(PAGE_PATH, url.origin).href, response.clone()),
  ]);
}

async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await cachePage(cache, url, response).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached =
      (await cache.match(`${url.origin}${url.pathname}`)) ??
      (await cache.match(new URL(PAGE_PATH, url.origin).href));
    if (cached) return cached;
    throw error;
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = toSameOriginUrl(request.url);
  if (!url) return;

  if (request.mode === "navigate") {
    if (isPagePath(url.pathname)) {
      event.respondWith(handleNavigation(request, url));
    }
    return;
  }

  // Range requests (media) need partial responses; leave them to the network.
  if (isStaticAsset(url.pathname) && !request.headers.has("range")) {
    event.respondWith(handleStaticAsset(request));
  }
  // Everything else passes through to the network.
});

async function precache(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url.href, { credentials: "same-origin" });
        if (!isCacheable(response)) return;
        if (isPagePath(url.pathname)) {
          await cachePage(cache, url, response);
        } else {
          await cache.put(url.href, response);
        }
      } catch {
        // Ignore individual failures; the page still works online.
      }
    })
  );
}

self.addEventListener("message", (event) => {
  const { data, source } = event;
  // Only accept messages from our own pages (window clients are same-origin).
  if (!source || source.type !== "window") return;
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;

  const seen = new Set();
  const urls = [];
  for (const value of data.urls.slice(0, MAX_PRECACHE_URLS)) {
    const url = toSameOriginUrl(value);
    if (!url) continue;
    if (!isPagePath(url.pathname) && !isStaticAsset(url.pathname)) continue;
    url.hash = "";
    if (isPagePath(url.pathname)) url.search = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    urls.push(url);
  }

  if (urls.length > 0) event.waitUntil(precache(urls));
});
