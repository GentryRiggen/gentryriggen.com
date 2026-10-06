import { test, expect, type Page } from "@playwright/test";

/**
 * Walking on the sinking ship: press Sink the ship while walking and keep
 * walking as the trial plays, or press Walk while a trial is already running.
 * `trialSpeed` plays the trial faster so the whole sinking takes moments; the
 * break mode is "never" so she goes down in one piece, the only case the walk
 * rides all the way.
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(120_000);

async function openTitanic(page: Page) {
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
  await page.evaluate(() =>
    window.__shipBuilderStore!.getState().setBreakMode("never")
  );
}

const status = (page: Page) =>
  page.evaluate(() => {
    const { walk, trial } = window.__shipBuilderStore!.getState();
    return { walk: walk.status, trial: trial.status };
  });

test.describe("Ship Builder walk while sinking", () => {
  test("sink the ship from walk mode and ride her down to the result", async ({
    page,
  }) => {
    await openTitanic(page);
    await page.getByRole("button", { name: "Walk", exact: true }).click();
    await page.getByRole("button", { name: "Sink the ship" }).click();

    await expect
      .poll(() => status(page))
      .toEqual({
        walk: "walking",
        trial: "running",
      });
    await expect(
      page.getByRole("button", { name: "Sink the ship" })
    ).toHaveCount(0);

    await expect(
      page.getByRole("region", { name: "Sea trial result" })
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("She sank")).toBeVisible();
    expect((await status(page)).walk).toBe("idle");
  });

  test("walk while a trial is already running", async ({ page }) => {
    await openTitanic(page);
    await page.evaluate(() =>
      window.__shipBuilderStore!.getState().startTrial("calm", 20)
    );
    await page.getByRole("button", { name: "Walk", exact: true }).click();
    await expect
      .poll(() => status(page))
      .toEqual({
        walk: "walking",
        trial: "running",
      });
  });
});
