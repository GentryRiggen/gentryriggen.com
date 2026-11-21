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
});
