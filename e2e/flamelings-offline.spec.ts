import { test, expect, type Page } from "@playwright/test";
import { mockFriends } from "./support/friendsMock";

// The worker only runs in a secure context (localhost counts), and the e2e
// build keeps it off unless the page is opened with ?offline.
test.use({ serviceWorkers: "allow" });
test.setTimeout(120_000);

async function hatch(page: Page, name: string) {
  await page.getByTestId("hatch-new").click();
  for (let i = 0; i < 5; i++) await page.getByTestId("egg").click();
  await page.getByRole("button", { name: "Hello, little flame!" }).click();
  await page.getByLabel("Name your flameling").fill(name);
  await page.getByRole("button", { name: "Welcome home!" }).click();
  await page.evaluate(() => window.__flamelings!.quietHappenings());
  await expect(
    page.getByRole("button", { name: `${name}, tap to say hi` })
  ).toBeVisible();
}

async function feed(page: Page) {
  await page.getByRole("button", { name: "Feed", exact: true }).click();
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(page.getByRole("group", { name: "Food" })).toBeHidden();
  await page.waitForTimeout(900);
}

/** A reload lands on the shelf; open the one pet. */
async function openPip(page: Page) {
  await page.evaluate(() => window.__flamelings!.quietHappenings());
  await expect(page.getByTestId("pet-card")).toContainText("Pip");
  await page.getByTestId("pet-card").click();
  await expect(
    page.getByRole("button", { name: "Pip, tap to say hi" })
  ).toBeVisible();
}

const fuelOfFirstPet = (page: Page) =>
  page.evaluate(() => window.__flamelings!.state().save.pets[0].fuel);

test("plays with no network after one visit, and friends come back online", async ({
  page,
  context,
}) => {
  let isOffline = false;
  await mockFriends(page, { isOffline: () => isOffline });

  await page.goto("/flamelings?offline");
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await page.evaluate(() =>
    window.__flamelings!.setNow(new Date(2026, 10, 17, 12).getTime())
  );
  await hatch(page, "Pip");

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
            names.find((n) => n.startsWith("flamelings-")) ?? ""
          );
          const urls = (await cache.keys()).map((request) => request.url);
          return {
            page: urls.some((url) => url.endsWith("/flamelings")),
            chunks: urls.filter((url) => url.includes("/_next/static/")).length,
            manifest: urls.some((url) =>
              url.endsWith("/flamelings.webmanifest")
            ),
            icons: urls.filter((url) => url.includes("/flamelings-icons/"))
              .length,
            version: urls.some((url) => url.includes("version.json")),
          };
        }),
      { timeout: 30_000 }
    )
    .toMatchObject({
      page: true,
      manifest: true,
      icons: 4,
      version: false,
    });
  expect(
    await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(
        names.find((n) => n.startsWith("flamelings-")) ?? ""
      );
      return (await cache.keys()).filter((r) =>
        r.url.includes("/_next/static/")
      ).length;
    })
  ).toBeGreaterThan(3);

  // A reload resets the game's test clock, and the save catches up to the
  // real date before a test could set it again: once the real date was days
  // past the fixed one, Pip faded to an ember and a Log only went towards
  // relighting. So from here the browser's own clock carries on from the
  // game's. (Installed only now: installed before the first visit, too few
  // chunks reached the worker's cache.)
  const gameNow = await page.evaluate(() => window.__flamelings!.now());
  await page.clock.install({ time: gameNow });

  // Offline: the game loads from the worker and still plays.
  isOffline = true;
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await openPip(page);

  await page.evaluate(() => window.__flamelings!.patchPet(0, { fuel: 30 }));
  const before = await fuelOfFirstPet(page);
  await feed(page);
  const after = await fuelOfFirstPet(page);
  expect(after).toBeGreaterThan(before);

  // The save persists across an offline reload.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await openPip(page);
  expect(await fuelOfFirstPet(page)).toBeGreaterThanOrEqual(after - 1);

  // A pet with no friend code yet cannot reach the server: a calm cloud.
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByTestId("friends-offline")).toBeVisible();

  // Back online, Try again reaches friends.
  isOffline = false;
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("my-code")).toBeVisible({ timeout: 15_000 });
});
