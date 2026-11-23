import { test, expect } from "@playwright/test";

// The worker only runs in a secure context (localhost counts), and the e2e
// build keeps it off unless the page is opened with ?offline.
test.use({ serviceWorkers: "allow" });
test.setTimeout(120_000);

test("shows the title screen with no network after one visit", async ({
  page,
  context,
}) => {
  await page.goto("/shipwreck?offline");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();

  // The worker takes control, then has the page, its chunks, the manifest
  // and the icons stored.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const cache = await caches.open(
            names.find((n) => n.startsWith("shipwreck-")) ?? ""
          );
          const urls = (await cache.keys()).map((request) => request.url);
          return {
            page: urls.some((url) => url.endsWith("/shipwreck")),
            chunks: urls.filter((url) => url.includes("/_next/static/")).length,
            manifest: urls.some((url) =>
              url.endsWith("/shipwreck.webmanifest")
            ),
            icons: urls.filter((url) => url.includes("/shipwreck-icons/"))
              .length,
            version: urls.some((url) => url.includes("version.json")),
          };
        }),
      { timeout: 30_000 }
    )
    .toMatchObject({ page: true, manifest: true, icons: 4, version: false });

  // Offline: the game loads from the worker.
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await expect(page.getByText(/More than 1,500 people died/)).toBeVisible();

  // Her afternoon too: the Lusitania is in the same stored files.
  await page.getByTestId("shipwreck-ship-lusitania").click();
  await expect(page.getByTestId("shipwreck-parent-line")).toContainText(
    "Lusitania"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "lusitania"
  );
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("coast")), {
      timeout: 30_000,
    })
    .toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.getState!().computedT),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0);
});

test("starts the Edmund Fitzgerald's storm with no network after one visit", async ({
  page,
  context,
}) => {
  await page.goto("/shipwreck?offline");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
  // The page's loaded files are stored (the page posts them to the worker).
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const cache = await caches.open(
            names.find((n) => n.startsWith("shipwreck-")) ?? ""
          );
          const urls = (await cache.keys()).map((request) => request.url);
          return urls.some((url) => url.endsWith("/shipwreck"));
        }),
      { timeout: 30_000 }
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await page.getByTestId("shipwreck-ship-fitzgerald").click();
  await expect(page.getByTestId("shipwreck-parent-line")).toContainText(
    "Edmund Fitzgerald"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "fitzgerald"
  );
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.isShown!("storm-sky")),
      { timeout: 30_000 }
    )
    .toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.getState!().computedT),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0);
});

test("starts the HMHS Britannic's morning with no network after one visit", async ({
  page,
  context,
}) => {
  await page.goto("/shipwreck?offline");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
  // The page's loaded files are stored (the page posts them to the worker).
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const cache = await caches.open(
            names.find((n) => n.startsWith("shipwreck-")) ?? ""
          );
          const urls = (await cache.keys()).map((request) => request.url);
          return urls.some((url) => url.endsWith("/shipwreck"));
        }),
      { timeout: 30_000 }
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await page.getByTestId("shipwreck-ship-britannic").click();
  await expect(page.getByTestId("shipwreck-parent-line")).toContainText(
    "Britannic"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "britannic"
  );
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("coast")), {
      timeout: 30_000,
    })
    .toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.getState!().computedT),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0);
});

test("starts the Carpathia's morning with no network after one visit", async ({
  page,
  context,
}) => {
  await page.goto("/shipwreck?offline");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const cache = await caches.open(
            names.find((n) => n.startsWith("shipwreck-")) ?? ""
          );
          const urls = (await cache.keys()).map((request) => request.url);
          return urls.some((url) => url.endsWith("/shipwreck"));
        }),
      { timeout: 30_000 }
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await page.getByTestId("shipwreck-ship-carpathia").click();
  await expect(page.getByTestId("shipwreck-parent-line")).toContainText(
    "Carpathia"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "carpathia"
  );
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("day-sky")), {
      timeout: 30_000,
    })
    .toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.getState!().computedT),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0);
});

test("starts the Costa Concordia's night with no network after one visit", async ({
  page,
  context,
}) => {
  await page.goto("/shipwreck?offline");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const cache = await caches.open(
            names.find((n) => n.startsWith("shipwreck-")) ?? ""
          );
          const urls = (await cache.keys()).map((request) => request.url);
          return urls.some((url) => url.endsWith("/shipwreck"));
        }),
      { timeout: 30_000 }
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await page.getByTestId("shipwreck-ship-concordia").click();
  await expect(page.getByTestId("shipwreck-parent-line")).toContainText(
    "Costa Concordia"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "concordia"
  );
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.isShown!("giglio-lights")),
      {
        // Built a little each frame (few frames a second in software GL).
        timeout: 120_000,
      }
    )
    .toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.getState!().computedT),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0);
});
