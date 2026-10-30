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
  baseURL: string | undefined,
  testConfig: NonNullable<Window["__SHIP_BUILDER_TEST__"]> = {}
): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.addInitScript(
    (config) => {
      window.__SHIP_BUILDER_TEST__ = config;
    },
    { trialSeconds: FAST_FORWARD_SECONDS, ...testConfig }
  );
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

  test("Smooth sailing ends on a hit with a card and stars for the distance", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      // An iceberg dead ahead, 200 cells out; the sail runs 10x faster so the
      // software renderer reaches it in a few dozen frames.
      const page = await openBuilder(browser, baseURL, {
        driveSpeed: 10,
        driveObstacles: [{ kind: "iceberg", x: 200, z: 0, radius: 5 }],
      });
      await page.evaluate(() =>
        window.__shipBuilderStore!.getState().newShipFromTemplate("titanic")
      );

      await page.getByRole("button", { name: "Challenges" }).click();
      const panel = page.getByRole("dialog", { name: "Challenges" });
      await panel.getByRole("button", { name: /Start Smooth sailing/ }).click();
      await expect(panel).toHaveCount(0);

      await expect(
        page.getByRole("button", { name: "Stop sailing" })
      ).toBeVisible();
      await expect(page.getByLabel(/Sailed \d+ of 350 cells/)).toBeVisible();
      // Full ahead; the planted iceberg ends the sail.
      for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");

      const card = page.getByRole("region", {
        name: "Challenge: Smooth sailing",
      });
      await expect(card).toBeVisible({ timeout: 90_000 });
      await expect(card).toContainText("She ran into");
      // Which thing ends the sail (the planted iceberg or a rock from the
      // fixed field) decides the stars, so check the card's shape instead.
      await expect(card).toContainText(/Got \d+ cells from the start/);
      await expect(card.getByRole("img", { name: /of 3 stars/ })).toBeVisible();
      await expect(card).toContainText("Try the challenge again");

      await page.getByRole("button", { name: "Back to building" }).click();
      await expect(card).toHaveCount(0);
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
        /Start Smooth sailing/,
      ]) {
        await panel.getByRole("button", { name }).scrollIntoViewIfNeeded();
        await expect(panel.getByRole("button", { name })).toBeVisible();
      }
    } finally {
      await browser.close();
    }
  });
});
