/* Ship Builder service worker: lets the home-screen app work offline.
 *
 * Registered by components/ship-builder/hooks/useServiceWorker.ts with scope
 * "/ship-builder", so it only controls the Ship Builder page. Rules:
 * - Only same-origin GET requests are ever handled; everything else goes
 *   straight to the network untouched.
 * - Navigations to the Ship Builder page: network-first, falling back to the
 *   cached page when offline.
 * - /_next/static/* (content-hashed, immutable): cache-first.
 * - /ship-builder/models/* (part models, not content-hashed): network-first,
 *   falling back to the cached copy when offline or slow (3s); stored without
 *   the query.
 * - /ship-builder/voice/* (spoken lines): handled exactly like the models, so
 *   a line heard once online still plays offline.
 * - Only `ok`, same-origin (`type === "basic"`), non-redirected responses are
 *   cached, so opaque or cross-origin responses never enter the cache.
 * - /ship-builder/version.json is never handled, cached or precached.
 * - The page posts { type: "SKIP_WAITING" } to make a waiting worker take over.
 * - The page posts { type: "CACHE_URLS", urls } with the resources it has
 *   already loaded, so a single online visit is enough to play offline.
 */

const CACHE_PREFIX = "ship-builder-";
const CACHE = `${CACHE_PREFIX}v1`;
const PAGE_PATH = "/ship-builder";
const STATIC_PREFIX = "/_next/static/";
const MODEL_PREFIX = `${PAGE_PATH}/models/`;
/** Upper bound on URLs accepted from one CACHE_URLS message. */
const MAX_PRECACHE_URLS = 300;

/** Spoken lines (public/ship-builder/voice/), handled like the models. */
const VOICE_PREFIX = `${PAGE_PATH}/voice/`;

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

/** True for the game page itself ("/ship-builder", "/ship-builder.html"). */
function isGamePath(pathname) {
  return (
    pathname === PAGE_PATH ||
    pathname === `${PAGE_PATH}.html` ||
    pathname === `${PAGE_PATH}/`
  );
}

/**
 * True for a part model or a spoken line the game loads
 * (public/ship-builder/models/, public/ship-builder/voice/).
 */
function isModelAsset(pathname) {
  return pathname.startsWith(MODEL_PREFIX) || pathname.startsWith(VOICE_PREFIX);
}

/** True for the game page or one of its sub-pages (e.g. /ship-builder/versions). */
function isPagePath(pathname) {
  if (isModelAsset(pathname) || isVersionFile(pathname)) return false;
  return (
    pathname === PAGE_PATH ||
    pathname === `${PAGE_PATH}.html` ||
    pathname.startsWith(`${PAGE_PATH}/`)
  );
}

/**
 * The deployed-version file the page polls for updates. It must always come
 * from the network, so the worker never stores or serves it.
 */
function isVersionFile(pathname) {
  return pathname === `${PAGE_PATH}/version.json`;
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
  const puts = [cache.put(key, response.clone())];
  // Only the game itself doubles as the offline fallback; a sub-page such as
  // the version history must never stand in for it.
  if (isGamePath(url.pathname)) {
    puts.push(cache.put(new URL(PAGE_PATH, url.origin).href, response.clone()));
  }
  await Promise.all(puts);
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

/** How long a model waits on the network before the cached copy is used. */
const MODEL_NETWORK_TIMEOUT_MS = 3000;

/**
 * Models can change between releases: fresh when the network answers in time,
 * the cached copy when it is offline or slow. A slow response still updates
 * the cache when it arrives.
 */
async function handleModel(event, request, url) {
  const cache = await caches.open(CACHE);
  const key = `${url.origin}${url.pathname}`;
  let stored = Promise.resolve();
  const network = fetch(request).then((response) => {
    if (isCacheable(response)) {
      // The caller gets the response now; the cache write finishes under
      // waitUntil below.
      stored = cache.put(key, response.clone()).catch(() => {});
    }
    return response;
  });
  // Keep the worker alive until the network answers and the cache is updated,
  // even after a slow one has been answered from the cache.
  event.waitUntil(network.then(() => stored).catch(() => {}));
  const cached = await cache.match(key);
  if (!cached) return network;
  const slow = new Promise((resolve) =>
    setTimeout(() => resolve(cached), MODEL_NETWORK_TIMEOUT_MS)
  );
  return Promise.race([network.catch(() => cached), slow]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = toSameOriginUrl(request.url);
  if (!url) return;
  if (isVersionFile(url.pathname)) return;

  if (request.mode === "navigate") {
    if (isPagePath(url.pathname)) {
      event.respondWith(handleNavigation(request, url));
    }
    return;
  }

  // Range requests (media) need partial responses; leave them to the network.
  if (request.headers.has("range")) return;
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isModelAsset(url.pathname)) {
    event.respondWith(handleModel(event, request, url));
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
  // The page asks a waiting worker to take over when the player taps Update.
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;

  const seen = new Set();
  const urls = [];
  for (const value of data.urls.slice(0, MAX_PRECACHE_URLS)) {
    const url = toSameOriginUrl(value);
    if (!url) continue;
    const isModel = isModelAsset(url.pathname);
    if (!isPagePath(url.pathname) && !isStaticAsset(url.pathname) && !isModel) {
      continue;
    }
    url.hash = "";
    if (isPagePath(url.pathname) || isModel) url.search = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    urls.push(url);
  }

  if (urls.length > 0) event.waitUntil(precache(urls));
});
