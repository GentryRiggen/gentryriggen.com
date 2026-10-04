/**
 * Manual check that the Ship Builder home-screen app works offline.
 *
 * 1. Runs `next build` (static export into out/). Pass --skip-build to reuse
 *    an existing out/ directory.
 * 2. Serves out/ on http://127.0.0.1:3199 with a tiny static server that
 *    mimics Firebase's cleanUrls (/ship-builder -> ship-builder.html).
 * 3. In headless Chromium (SwiftShader WebGL): loads /ship-builder, waits for
 *    the 3D canvas, for the service worker to control the page and for every
 *    loaded /_next/static/ resource plus the page itself to be cached.
 * 4. Goes offline, reloads, and asserts the heading and the canvas render.
 *
 * Exits non-zero on failure. Not part of CI; run it after changing the
 * service worker, the manifest or the build setup:
 *
 *   node scripts/check-ship-builder-offline.mjs [--skip-build] [--webpack]
 *
 * --webpack builds with webpack instead of Turbopack. Use it in git worktrees
 * whose node_modules is a symlink, which Turbopack refuses to follow.
 */
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "out");
const PORT = 3199;
// Loopback addresses are secure contexts, so service workers are allowed.
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGE_URL = `${ORIGIN}/ship-builder`;
const CACHE_NAME = "ship-builder-v1";
const TIMEOUT_MS = 60_000;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function build() {
  const nextBin = path.join(ROOT, "node_modules/next/dist/bin/next");
  const args = [nextBin, "build"];
  if (process.argv.includes("--webpack")) args.push("--webpack");
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("next build failed");
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

/** Maps a URL path to a file in out/, refusing anything outside it. */
async function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const base = path.join(OUT_DIR, path.normalize(decoded));
  if (base !== OUT_DIR && !base.startsWith(OUT_DIR + path.sep)) return null;

  const candidates = [base, `${base}.html`, path.join(base, "index.html")];
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

function startServer() {
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const { pathname } = new URL(request.url ?? "/", ORIGIN);
    const filePath = await resolveFile(pathname);
    const status = filePath ? 200 : 404;
    const servedPath = filePath ?? path.join(OUT_DIR, "404.html");
    try {
      const body = await readFile(servedPath);
      response.writeHead(status, {
        "Content-Type":
          CONTENT_TYPES[path.extname(servedPath)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

/** True once the page and every loaded /_next/static/ resource are cached. */
async function isEverythingCached(cacheName) {
  const cache = await caches.open(cacheName);
  const cached = new Set((await cache.keys()).map((request) => request.url));
  const loadedStatic = performance
    .getEntriesByType("resource")
    .map((entry) => new URL(entry.name))
    .filter(
      (url) =>
        url.origin === location.origin &&
        url.pathname.startsWith("/_next/static/")
    )
    .map((url) => url.href);
  return (
    cached.has(`${location.origin}/ship-builder`) &&
    loadedStatic.length > 0 &&
    loadedStatic.every((url) => cached.has(url))
  );
}

async function checkOffline() {
  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1194, height: 834 },
    });
    const page = await context.newPage();
    // Logged as they happen, to explain a failure.
    page.on("requestfailed", (request) => {
      const reason = request.failure()?.errorText ?? "unknown";
      console.log(`  request failed (${reason}): ${request.url()}`);
    });
    page.on("pageerror", (error) => {
      console.log(`  page error: ${error.message}`);
    });
    page.setDefaultTimeout(TIMEOUT_MS);
    const canvas = page.locator('[data-testid="ship-canvas"] canvas');
    const heading = page.getByRole("heading", { name: "Ship Builder" });

    console.log(`Loading ${PAGE_URL} online…`);
    await page.goto(PAGE_URL, { waitUntil: "load" });
    await canvas.waitFor();

    console.log("Waiting for the service worker to take control…");
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const scope = await page.evaluate(
      async () => (await navigator.serviceWorker.ready).scope
    );
    if (scope !== `${ORIGIN}/ship-builder`) {
      throw new Error(`Unexpected service worker scope: ${scope}`);
    }

    console.log("Waiting for the page and its assets to be cached…");
    // Let lazily loaded chunks finish so they are part of the check below.
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(isEverythingCached, CACHE_NAME, {
      polling: 250,
    });
    const cachedCount = await page.evaluate(
      async (name) => (await (await caches.open(name)).keys()).length,
      CACHE_NAME
    );
    console.log(`Cached ${cachedCount} responses.`);

    console.log("Going offline and reloading…");
    await context.setOffline(true);
    await page.reload({ waitUntil: "load" });
    await heading.waitFor();
    await canvas.waitFor();

    console.log("Checking the rest of the site is not served offline…");
    const homeLoaded = await page
      .goto(`${ORIGIN}/`, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (homeLoaded) {
      throw new Error("The home page loaded offline; the worker leaked scope");
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!process.argv.includes("--skip-build")) build();
  const server = await startServer();
  try {
    await checkOffline();
    console.log("PASS: Ship Builder renders offline.");
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
