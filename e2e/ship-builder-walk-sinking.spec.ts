import { test, expect, type Page } from "@playwright/test";

/**
 * Walking on the sinking ship: press Hit with an iceberg while walking and keep
 * walking as the trial plays, or press Walk while a trial is already running.
 * `trialSpeed` plays the trial faster so the whole sinking takes moments. The
 * walker stays aboard to the sea floor, in one piece or on one half, and the
 * result waits until they stop walking.
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(120_000);

async function openTitanic(page: Page, breakMode: "never" | "always") {
  await page.addInitScript(() => {
    window.__SHIP_BUILDER_TEST__ = { trialSpeed: 4 };
  });
  await page.goto("/ship-builder");
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
  await page.getByRole("button", { name: "New", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "New ship" });
  await picker.getByRole("button", { name: /Ocean liner/ }).click();
  await picker.getByRole("button", { name: /RMS Titanic/ }).click();
  await expect(picker).toHaveCount(0);
  await page.evaluate(
    (mode) => window.__shipBuilderStore!.getState().setBreakMode(mode),
    breakMode
  );
}

const status = (page: Page) =>
  page.evaluate(() => {
    const { walk, trial } = window.__shipBuilderStore!.getState();
    return {
      walk: walk.status,
      trial: trial.status,
      descending: "descending" in trial ? trial.descending : false,
    };
  });

/** Taps Walk and starts from the middle of the ship. */
async function startWalking(page: Page) {
  await page.getByRole("button", { name: "Walk", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Where do you want to start?" })
    .getByRole("button", { name: "Middle" })
    .click();
}

test.describe("Ship Builder walk while sinking", () => {
  /** Walks, hits, and rides her down until the trial is over. */
  async function rideToTheEnd(page: Page) {
    await startWalking(page);
    await page.getByRole("button", { name: "Hit with an iceberg" }).click();
    await expect
      .poll(() => status(page))
      .toEqual({ walk: "walking", trial: "running", descending: false });
    await expect(
      page.getByRole("button", { name: "Hit with an iceberg" })
    ).toHaveCount(0);

    // She sinks and goes on down to the sea floor on her own, walker aboard.
    await expect
      .poll(() => status(page), { timeout: 90_000 })
      .toEqual({ walk: "walking", trial: "result", descending: true });
    await expect(page.getByText(/^She sank\. Explore the wreck/)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Sea trial result" })
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => window.__shipBuilderWalk?.() ?? null)
    ).not.toBeNull();

    await page.getByRole("button", { name: "Stop walking" }).click();
    await expect(
      page.getByRole("region", { name: "Sea trial result" })
    ).toBeVisible();
    expect((await status(page)).walk).toBe("idle");
  }

  test("ride her down in one piece to the sea floor", async ({ page }) => {
    await openTitanic(page, "never");
    await rideToTheEnd(page);
  });

  test(
    "ride your half down when she breaks in two",
    { tag: "@smoke" },
    async ({ page }) => {
      await openTitanic(page, "always");
      await rideToTheEnd(page);
    }
  );

  test("walk while a trial is already running", async ({ page }) => {
    await openTitanic(page, "never");
    await page.evaluate(() =>
      window.__shipBuilderStore!.getState().startTrial("calm", 20)
    );
    await startWalking(page);
    await expect
      .poll(() => status(page))
      .toEqual({
        walk: "walking",
        trial: "running",
        descending: false,
      });
  });
});
