import {
  test,
  expect,
  type Browser,
  type BrowserType,
  type Page,
} from "@playwright/test";

/**
 * Sea trial flows. The trial plays in the WebGL scene, so (like the other
 * scene tests) these run in headless Chromium with software WebGL only.
 * `trialSpeed` makes a whole trial take moments; `trialSeconds` holds the
 * sim part-way so the "running" state can be inspected (see testClock.ts).
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(90_000);

interface TrialTestConfig {
  trialSeconds?: number;
  trialSpeed?: number;
}

async function openBuilder(
  browser: Browser,
  baseURL: string | undefined,
  config: TrialTestConfig
): Promise<Page> {
  const page = await browser.newPage({
    baseURL,
    viewport: { width: 1280, height: 800 },
  });
  await page.addInitScript((testConfig) => {
    window.__SHIP_BUILDER_TEST__ = testConfig;
  }, config);
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

const partCount = (page: Page) =>
  page.evaluate(() => window.__shipBuilderStore!.getState().ship.parts.length);

const trialStatus = (page: Page) =>
  page.evaluate(() => window.__shipBuilderStore!.getState().trial.status);

test.describe("Ship Builder sea trial", () => {
  test("a calm trial ends in a result card and building works again", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL, { trialSpeed: 60 });
      const start = page.getByRole("button", { name: "Sea trial" });
      await start.click();

      const card = page.getByRole("dialog");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card.getByRole("heading", { level: 2 })).not.toHaveText("");
      await expect(card).toBeFocused();
      await expect(
        card.getByRole("button", { name: "Try again" })
      ).toBeVisible();

      await card.getByRole("button", { name: "Back to building" }).click();
      await expect(card).toHaveCount(0);
      await expect(start).toBeVisible();
      await expect(start).toBeFocused();

      await page.getByRole("button", { name: /Deck block 1×1/ }).click();
      const result = await page.evaluate(() =>
        window.__shipBuilderStore!.getState().placeAt({
          kind: "grid",
          level: 0,
          x: 0,
          z: 0,
        })
      );
      expect(result).toEqual({ ok: true });
      expect(await partCount(page)).toBe(1);
    } finally {
      await browser.close();
    }
  });

  test("Try again runs the trial once more", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL, { trialSpeed: 60 });
      await page.getByRole("button", { name: "Sea trial" }).click();
      const card = page.getByRole("dialog");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await card.getByRole("button", { name: "Try again" }).click();
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toBeFocused();
    } finally {
      await browser.close();
    }
  });

  test("editing is blocked while a trial runs, and Stop ends it", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      // Held at 2 s, so the trial stays "running" for the whole test.
      const page = await openBuilder(browser, baseURL, { trialSeconds: 2 });
      await page.getByRole("button", { name: /Deck block 1×1/ }).click();
      await page.evaluate(() => {
        const store = window.__shipBuilderStore!.getState();
        store.placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
        store.select(window.__shipBuilderStore!.getState().ship.parts[0].id);
      });
      expect(await partCount(page)).toBe(1);

      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Sea trial" }).click();
      const pill = page.getByRole("status").filter({ hasText: "Sea trial" });
      await expect(pill).toContainText("Calm sea");
      await expect(page.getByRole("button", { name: "Sea trial" })).toHaveCount(
        0
      );

      // Shortcuts and store actions that would edit do nothing.
      await page.keyboard.press("Delete");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("r");
      await page.keyboard.press("Control+z");
      await page.evaluate(() => {
        const store = window.__shipBuilderStore!.getState();
        store.selectTool("deck-1x1");
        store.placeAt({ kind: "grid", level: 0, x: 1, z: 0 });
        store.changeHullLength(1);
        store.undo();
      });
      expect(await partCount(page)).toBe(1);
      expect(
        await page.evaluate(() => window.__shipBuilderStore!.getState().tool)
      ).toEqual({ kind: "none" });

      // The parts panel is paused, and New / My Ships are off.
      await expect(
        page.getByRole("complementary", { name: "Parts" })
      ).toContainText("Building is paused during the sea trial");
      await expect(
        page.getByRole("button", { name: "New", exact: true })
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "My Ships" })
      ).toBeDisabled();

      await pill.getByRole("button", { name: "Stop" }).click();
      await expect(pill).toHaveCount(0);
      expect(await trialStatus(page)).toBe("idle");
      await page.keyboard.press("Control+z");
      await expect.poll(() => partCount(page)).toBe(0);
    } finally {
      await browser.close();
    }
  });

  test("Escape stops a running trial", async ({ playwright, baseURL }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL, { trialSeconds: 2 });
      await page.getByRole("button", { name: "Sea trial" }).click();
      await expect.poll(() => trialStatus(page)).toBe("running");
      await page.keyboard.press("Escape");
      await expect.poll(() => trialStatus(page)).toBe("idle");
    } finally {
      await browser.close();
    }
  });

  test("the Sea trial button is keyboard reachable", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL, { trialSpeed: 60 });
      await page.getByRole("button", { name: "Sea trial" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
    } finally {
      await browser.close();
    }
  });
});
