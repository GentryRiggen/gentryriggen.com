import { test, expect } from "@playwright/test";

// Software WebGL for Chromium (the flags are Chromium-only), as the other
// Plane Builder specs do, so the real game UI renders and not the fallback.
test.use({
  serviceWorkers: "allow",
  launchOptions: [
    async ({ browserName }, use) =>
      use(
        browserName === "chromium"
          ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
          : {}
      ),
    { scope: "worker" },
  ],
});

test.setTimeout(120_000);

// The worker only runs in a secure context (localhost counts), and the e2e
// build keeps it off unless the page is opened with ?offline.
test.describe("plane builder offline", () => {
  test("plays with no network after one visit", async ({ page, context }) => {
    await page.goto("/plane-builder?offline");
    await expect(
      page.getByRole("button", { name: "Play Backyard Meadow" })
    ).toBeVisible({ timeout: 60_000 });

    // The worker takes control, then has the page and every model stored.
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
              names.find((n) => n.startsWith("plane-builder-")) ?? ""
            );
            const urls = (await cache.keys()).map((request) => request.url);
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
    const modelFromWorker = page.waitForResponse(
      (response) =>
        response.url().includes("/plane-builder/models/") &&
        response.fromServiceWorker(),
      { timeout: 60_000 }
    );
    await page.reload();

    // Hydrated and interactive: a world card opens the hangar.
    const play = page.getByRole("button", { name: "Play Backyard Meadow" });
    await expect(play).toBeVisible({ timeout: 60_000 });
    await play.click();
    await expect(page.getByRole("button", { name: "Launch!" })).toBeVisible();

    const model = await modelFromWorker;
    expect(model.ok()).toBe(true);
    await context.setOffline(false);
  });
});
