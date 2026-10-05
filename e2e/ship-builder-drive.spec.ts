import { test, expect, type Page } from "@playwright/test";

/**
 * Drive mode: pick what is out there, set sail, use the controls and the three
 * views, then sail into an iceberg and reach the sinking result.
 *
 * The picker is set to open water so nothing random is in the way, and the
 * test hook plants one iceberg dead ahead (the ship starts at the origin
 * heading along +x), so the hit never depends on the random seed.
 * `trialSeconds` far past the longest trial jumps the sinking straight to its
 * result.
 */

test.setTimeout(120_000);

/** Past any iceberg trial, so the result shows at once. */
const FAST_FORWARD_SECONDS = 1000;

async function openBuilder(page: Page) {
  await page.addInitScript((trialSeconds) => {
    window.__SHIP_BUILDER_TEST__ = {
      trialSeconds,
      driveObstacles: [{ kind: "iceberg", x: 60, z: 0, radius: 5 }],
    };
  }, FAST_FORWARD_SECONDS);
  await page.goto("/ship-builder");
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
}

async function loadTitanic(page: Page) {
  await page.getByRole("button", { name: "New", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "New ship" });
  await picker.getByRole("button", { name: /Ocean liner/ }).click();
  await picker.getByRole("button", { name: /RMS Titanic/ }).click();
  await expect(picker).toHaveCount(0);
}

const driveState = (page: Page) =>
  page.evaluate(() => window.__shipBuilderStore!.getState().drive.status);

const throttle = (page: Page) => page.getByRole("slider", { name: /throttle/ });

test.describe("Ship Builder drive", () => {
  test(
    "a ship with no engine cannot drive",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      await expect(page.getByRole("button", { name: "Drive" })).toBeDisabled();
      await expect(page.getByText("Add an engine to drive")).toBeVisible();
    }
  );

  test(
    "sails, switches views and sinks on an iceberg",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      await loadTitanic(page);

      await page.getByRole("button", { name: "Drive" }).click();
      const picker = page.getByRole("dialog", { name: "Set sail" });
      await expect(picker).toBeVisible();

      // Open water, so only the planted iceberg is out there.
      const kinds = picker.getByRole("group", { name: "Obstacles" });
      for (const name of ["Icebergs", "Rocks", "Buoys", "Other ships"]) {
        const toggle = kinds.getByRole("button", { name });
        if ((await toggle.getAttribute("aria-pressed")) === "true") {
          await toggle.click();
        }
      }
      await picker
        .getByRole("group", { name: "How many" })
        .getByRole("button", { name: "Many" })
        .click();
      await picker.getByRole("button", { name: "Set sail" }).click();

      await expect(picker).toHaveCount(0);
      expect(await driveState(page)).toBe("sailing");
      await expect(
        page.getByRole("button", { name: "End drive" })
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: /steering wheel/ })
      ).toBeVisible();
      await expect(throttle(page)).toHaveAttribute("aria-valuenow", "0");

      // The three views.
      const views = page.getByRole("group", { name: "Camera view" });
      for (const name of ["Top", "Bridge", "Chase"]) {
        await views.getByRole("button", { name }).click();
        await expect(views.getByRole("button", { name })).toHaveAttribute(
          "aria-pressed",
          "true"
        );
      }

      // Steer while she is still (no way on, so she holds her course), then
      // push the throttle up with the keyboard.
      await page.keyboard.down("ArrowLeft");
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.press("ArrowUp");
      await expect(throttle(page)).toHaveAttribute("aria-valuenow", "25");
      await page.keyboard.press("w");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      await expect(throttle(page)).toHaveAttribute("aria-valuenow", "100");

      // Dead ahead, the iceberg ends the drive and the sinking plays.
      const result = page.getByRole("region", { name: "Sea trial result" });
      await expect(result).toBeVisible({ timeout: 90_000 });
      await expect(result).toContainText("She sank");
      expect(await driveState(page)).toBe("idle");
    }
  );
});
