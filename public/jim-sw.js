/* Jim service worker: /jim opens without signal, and the morning briefing
 * arrives as a notification.
 *
 * Registered by lib/jim/serviceWorker.ts with scope "/jim", so it only
 * controls the /jim page. Rules:
 * - Only same-origin GET requests are ever handled; everything else (the
 *   Jim server, Firebase, any POST) goes straight to the network untouched.
 *   Nothing under /api/ is ever cached.
 * - Navigations to /jim and every app address under it (/jim/notes/people/x;
 *   Hosting serves the one page there): network-first, falling back to the
 *   cached page when offline or slow (4s). Every one is stored as /jim. When
 *   a deploy changes the files the page references, cached /_next/static/
 *   files it no longer uses are pruned. A file under /jim/ (version.json) is
 *   never an app address.
 * - /_next/static/* (content-hashed, immutable): cache-first.
 * - Install precaches /jim and the /_next/static/ files its HTML names; the
 *   page also posts { type: "CACHE_URLS", urls } with what it has loaded
 *   (chunks loaded before the worker took control).
 * - Only `ok`, same-origin (`type === "basic"`), non-redirected responses are
 *   cached, so opaque or cross-origin responses never enter the cache.
 * - A new worker waits (no automatic skipWaiting) until a page posts
 *   { type: "SKIP_WAITING" }; the page then reloads on controllerchange.
 * - push: { title, body, url } becomes a notification (a generic one when
 *   the payload can't be read: iOS wants one for every push). A tap focuses
 *   an open /jim or opens it; a URL with a query (/jim?say=quiz%20me) is kept,
 *   and an open page is sent a JIM_SAY message instead.
 */

const CACHE_PREFIX = "jim-shell-";
const CACHE = `${CACHE_PREFIX}v1`;
const PAGE_PATH = "/jim";
const STATIC_PREFIX = "/_next/static/";
const ICON = "/jim-icons/glow-pal-192.png";
const NOTIFICATION_TAG = "jim-morning";
/** Upper bound on URLs accepted from one CACHE_URLS message. */
const MAX_PRECACHE_URLS = 300;
/** How long a page waits on the network before the cached page is used. */
const NAVIGATION_NETWORK_TIMEOUT_MS = 4000;
/** Matches every /_next/static/ path in a page's HTML. */
const STATIC_REF_PATTERN = /\/_next\/static\/[^"'\s\\)<>?]+/g;

/** True for the page itself ("/jim", "/jim/", "/jim.html"); nothing else. */
function isPagePath(pathname) {
  return (
    pathname === PAGE_PATH ||
    pathname === `${PAGE_PATH}/` ||
    pathname === `${PAGE_PATH}.html`
  );
}

/**
 * True for an address the Jim page answers: the page, or any path under
 * /jim/ whose last part has no dot (/jim/notes/people/x, not
 * /jim/version.json).
 */
function isAppPath(pathname) {
  if (isPagePath(pathname)) return true;
  if (!pathname.startsWith(`${PAGE_PATH}/`)) return false;
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return !last.includes(".");
}

function isStaticAsset(pathname) {
  return pathname.startsWith(STATIC_PREFIX);
}

function isApi(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
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

function pageKey() {
  return new URL(PAGE_PATH, self.location.origin).href;
}

function staticRefs(html) {
  return new Set(html.match(STATIC_REF_PATTERN) ?? []);
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/** Caches the page and every /_next/static/ file its HTML names. */
async function precachePage() {
  const cache = await caches.open(CACHE);
  const response = await fetch(pageKey(), { credentials: "same-origin" });
  if (!isCacheable(response)) return;
  const html = await response.clone().text();
  await cache.put(pageKey(), response);
  await Promise.all(
    [...staticRefs(html)].map(async (path) => {
      try {
        const href = new URL(path, self.location.origin).href;
        if (await cache.match(href)) return;
        const asset = await fetch(href, { credentials: "same-origin" });
        if (isCacheable(asset)) await cache.put(href, asset);
      } catch {
        // One missing file must not fail the install.
      }
    })
  );
}

self.addEventListener("install", (event) => {
  // No skipWaiting here: a new worker waits until the page asks (SKIP_WAITING,
  // from the "Update ready" pill) so the page and its worker change together.
  // Best effort: an install while offline still installs.
  event.waitUntil(precachePage().catch(() => {}));
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

/**
 * A new deploy changes the hashed files the page references, which would
 * otherwise stay in the cache forever. When the page's references change,
 * drop every cached /_next/static/ file the new page does not reference.
 * Lazily loaded chunks are cache-first on demand, so any still needed are
 * stored again when the page loads them.
 */
async function pruneStaleStatic(cache, previous, response) {
  let before;
  let after;
  try {
    before = staticRefs(await previous.clone().text());
    after = staticRefs(await response.clone().text());
  } catch {
    return;
  }
  if (after.size === 0 || sameSet(before, after)) return;
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    if (isStaticAsset(pathname) && !after.has(pathname)) {
      await cache.delete(request);
    }
  }
}

/** Keeps a fresh page as /jim, pruning what the last deploy left. */
async function storePage(response) {
  if (!isCacheable(response)) return;
  try {
    const cache = await caches.open(CACHE);
    const previous = await cache.match(pageKey());
    await cache.put(pageKey(), response.clone());
    if (previous) await pruneStaleStatic(cache, previous, response);
  } catch {
    // Caching is best effort.
  }
}

/**
 * Network-first, but a slow network (lie-fi) falls back to the cached page
 * after a few seconds. A late answer still updates the cache. Every form of
 * the page is stored as /jim, without its query. `network` is started (and
 * handed to waitUntil) by the fetch listener before anything is awaited.
 */
async function handleNavigation(network) {
  let cached;
  try {
    const cache = await caches.open(CACHE);
    cached = await cache.match(pageKey());
  } catch {
    // No cache to fall back on: the network alone.
    return network;
  }
  if (!cached) return network;
  const slow = new Promise((resolve) =>
    setTimeout(() => resolve(cached), NAVIGATION_NETWORK_TIMEOUT_MS)
  );
  return Promise.race([network.catch(() => cached), slow]);
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
  if (!url || isApi(url.pathname)) return;

  if (request.mode === "navigate") {
    if (isAppPath(url.pathname)) {
      // Started here, and waitUntil called before any await (WebKit
      // rejects a late one), so a slow answer can still update the cache.
      const network = fetch(request).then(async (response) => {
        await storePage(response);
        return response;
      });
      try {
        event.waitUntil(network.catch(() => {}));
      } catch {
        // The page still gets its answer.
      }
      event.respondWith(handleNavigation(network));
    }
    return;
  }

  // Range requests (media) need partial responses; leave them to the network.
  if (request.headers.has("range")) return;
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
  }
  // Everything else passes through to the network.
});

async function precache(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (!isPagePath(url.pathname) && (await cache.match(url.href))) {
          return;
        }
        const response = await fetch(url.href, { credentials: "same-origin" });
        if (!isCacheable(response)) return;
        await cache.put(
          isPagePath(url.pathname) ? pageKey() : url.href,
          response
        );
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
    if (!isAppPath(url.pathname) && !isStaticAsset(url.pathname)) continue;
    url.hash = "";
    // The page at any app address is the one page: kept as /jim.
    if (isAppPath(url.pathname)) {
      url.pathname = PAGE_PATH;
      url.search = "";
    }
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    urls.push(url);
  }

  if (urls.length > 0) event.waitUntil(precache(urls));
});

/** Where a tap goes: the payload's /jim URL, or /jim. */
function targetUrl(value) {
  const url = toSameOriginUrl(value);
  return url && isAppPath(url.pathname) ? url.href : pageKey();
}

/** The notification a push shows. Never throws. */
function notificationFor(data) {
  let payload = null;
  try {
    payload = data ? data.json() : null;
  } catch {
    payload = null;
  }
  const ok =
    payload !== null &&
    typeof payload === "object" &&
    typeof payload.title === "string" &&
    payload.title !== "";
  return {
    title: ok ? payload.title : "Jim",
    options: {
      body: ok && typeof payload.body === "string" ? payload.body : "",
      icon: ICON,
      badge: ICON,
      tag:
        ok &&
        typeof payload.tag === "string" &&
        /^jim-[a-z]{1,20}(-[a-z0-9]{1,16})?$/.test(payload.tag)
          ? payload.tag
          : NOTIFICATION_TAG,
      data: { url: targetUrl(ok ? payload.url : null) },
    },
  };
}

self.addEventListener("push", (event) => {
  const { title, options } = notificationFor(event.data);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = targetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        const at = toSameOriginUrl(client.url);
        if (at && isAppPath(at.pathname) && "focus" in client) {
          await client.focus();
          // An open page: no reload (it would drop a draft and abort a turn).
          // It is told where the tap goes (JIM_OPEN) and routes itself; JIM_SAY
          // stays for pages opened before JIM_OPEN existed.
          if (typeof client.postMessage === "function") {
            client.postMessage({ type: "JIM_OPEN", url });
            const say = new URL(url).searchParams.get("say");
            if (say !== null) client.postMessage({ type: "JIM_SAY", say });
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
