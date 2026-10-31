import { test, expect, type Page } from "@playwright/test";

/**
 * Trial setup (v2.36): Sea trial -> Shipwreck storm opens a setup card with
 * Time and Lifeboats rows, Go starts the trial and the Speed group appears.
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(90_000);

async function openBuilder(page: Page) {
  await page.goto("/ship-builder");
  await expect(page.getByRole("heading", { name: "Ship Builder" })).toBeVisible(
    { timeout: 60_000 }
  );
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
  await expect(page.getByTestId("ship-canvas").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("trial setup", () => {
  test(
    "storm card shows Time and Lifeboats, Go shows Speed, 3x and 20x work",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      await page.getByRole("button", { name: "Sea trial" }).click();
      await page.getByRole("menuitem", { name: "Shipwreck storm" }).click();

      const card = page.getByRole("region", { name: "Shipwreck storm" });
      await expect(card).toBeVisible();
      await expect(card.getByRole("group", { name: "Time" })).toBeVisible();
      await expect(
        card.getByRole("group", { name: "Lifeboats" })
      ).toBeVisible();

      await card.getByRole("button", { name: "Go!" }).click();

      const speed = page.getByRole("group", { name: "Speed" });
      await expect(speed).toBeVisible();
      await speed.getByRole("button", { name: "3x" }).click();
      await expect(speed.getByRole("button", { name: "3x" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await speed.getByRole("button", { name: "20x" }).click();
      await expect(speed.getByRole("button", { name: "20x" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    }
  );
});
