import { test, expect } from "@playwright/test";

// The worker only runs in a secure context (localhost counts), and the e2e
// build keeps it off unless the page is opened with ?offline.
test.use({ serviceWorkers: "allow" });

test.describe("plane builder offline", () => {
  test("opens with no network after one visit", async ({ page, context }) => {
    await page.goto("/plane-builder?offline");
    await expect(
      page.getByRole("heading", { name: "Plane Builder" })
    ).toBeVisible({ timeout: 60_000 });

    // The worker takes control, then has the page and every model stored.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const names = await caches.keys();
            const cache = await caches.open(
              names.find((n) => n.startsWith("plane-builder-")) ?? ""
            );
            const keys = await cache.keys();
            const urls = keys.map((request) => request.url);
            return {
              page: urls.some((url) => url.endsWith("/plane-builder")),
              models: urls.filter((url) =>
                url.includes("/plane-builder/models/")
              ).length,
            };
          }),
        { timeout: 30_000 }
      )
      .toEqual({ page: true, models: 41 });

    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Plane Builder" })
    ).toBeVisible({ timeout: 60_000 });
    await context.setOffline(false);
  });
});
