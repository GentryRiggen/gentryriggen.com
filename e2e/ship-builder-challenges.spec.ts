import {
  test,
  expect,
  type Browser,
  type BrowserType,
  type Page,
} from "@playwright/test";

/**
 * Challenges: run a challenge from the panel, see its stars on the result
 * card, and find them again in the panel and after a reload. The trial plays
 * in the WebGL scene, so (like the other trial specs) this runs in headless
 * Chromium with software WebGL, and `trialSeconds` jumps the sim to its end.
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(90_000);

const FAST_FORWARD_SECONDS = 1000;

async function openBuilder(
  browser: Browser,
  baseURL: string | undefined
): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.addInitScript((trialSeconds) => {
    window.__SHIP_BUILDER_TEST__ = { trialSeconds };
  }, FAST_FORWARD_SECONDS);
  await page.goto("/ship-builder");
  await expect(page.getByRole("heading", { name: "Ship Builder" })).toBeVisible(
    { timeout: 60_000 }
  );
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
  await expect(page.getByTestId("ship-canvas").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });
  return page;
}

function launch(playwright: { chromium: BrowserType }) {
  return playwright.chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
}

test.describe("Ship Builder challenges", () => {
  test("a challenge earns stars that show on the card, the panel and after a reload", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      await page.evaluate(() =>
        window.__shipBuilderStore!.getState().newShipFromTemplate("titanic")
      );

      await page.getByRole("button", { name: "Challenges" }).click();
      const panel = page.getByRole("dialog", { name: "Challenges" });
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId("total-stars")).toHaveText("0");
      await panel
        .getByRole("button", { name: /Start Outlast the Titanic/ })
        .click();

      const card = page.getByRole("region", {
        name: "Challenge: Outlast the Titanic",
      });
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(
        card.getByRole("img", { name: "1 of 3 stars" })
      ).toBeVisible();
      await expect(card).toContainText("For the next star");

      await page.getByRole("button", { name: "Back to building" }).click();
      await expect(page.getByTestId("header-stars")).toHaveText(/1/);
      await page.getByRole("button", { name: /Challenges/ }).click();
      const again = page.getByRole("dialog", { name: "Challenges" });
      await expect(again.getByTestId("total-stars")).toHaveText("1");
      await again.getByRole("tab", { name: "Leaderboard" }).click();
      await expect(again.getByText(/switched off/)).toBeVisible();
      await page.keyboard.press("Escape");

      // The stars outlive a reload (the ship is still unsaved, so they sit
      // in the unsaved bucket).
      await page.reload();
      await expect(page.getByTestId("header-stars")).toHaveText(/1/, {
        timeout: 30_000,
      });
    } finally {
      await browser.close();
    }
  });

  test("the panel fits a phone and keeps its buttons reachable", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      await page.setViewportSize({ width: 390, height: 700 });
      await page.getByRole("button", { name: "Challenges" }).click();
      const panel = page.getByRole("dialog", { name: "Challenges" });
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      for (const name of [
        /Start Outlast/,
        /Start Everyone/,
        /Start Shipshape/,
      ]) {
        await panel.getByRole("button", { name }).scrollIntoViewIfNeeded();
        await expect(panel.getByRole("button", { name })).toBeVisible();
      }
    } finally {
      await browser.close();
    }
  });
});
