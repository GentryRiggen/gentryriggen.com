/**
 * Kill switch for Jim's old service worker. Jim moved to its own address;
 * on the old one this file is served as /jim-sw.js (scripts/jim-site.mjs
 * copies it there), so a Home Screen app still running the old worker
 * picks it up on its next update check.
 *
 * It takes over at once, deletes Jim's cached shell, unregisters itself and
 * reloads every open Jim window from the network, where the old address now
 * serves the page that wipes Jim's data and sends the visitor on. It has no
 * fetch handler: nothing it controls is ever served from a cache.
 */
"use strict";

const SHELL_PREFIX = "jim-shell-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith(SHELL_PREFIX))
            .map((name) => caches.delete(name))
        );
      } catch {
        // The caches go with the registration anyway.
      }
      try {
        await self.clients.claim();
      } catch {
        // Unclaimed windows still reload below if they can.
      }
      try {
        await self.registration.unregister();
      } catch {
        // Nothing more this worker can do about it.
      }
      let windows = [];
      try {
        windows = await self.clients.matchAll({ type: "window" });
      } catch {
        // No windows to reload.
      }
      await Promise.all(
        windows.map((client) =>
          Promise.resolve()
            .then(() => client.navigate(client.url))
            .catch(() => {})
        )
      );
    })()
  );
});
