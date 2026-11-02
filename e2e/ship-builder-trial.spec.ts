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

/** Opens the Sea trial menu, picks Waves and presses Go on its card. */
async function startWavesTrial(page: Page) {
  await page.getByRole("button", { name: "Sea trial" }).click();
  await page.getByRole("menuitem", { name: "Waves" }).click();
  await page.getByRole("button", { name: "Go!" }).click();
}

/** The slim result bar shown once a trial ends. */
const resultBar = (page: Page) =>
  page.getByRole("region", { name: "Sea trial result" });

/** Opens the Details sheet from the result bar and returns it. */
async function openDetails(page: Page) {
  await resultBar(page).getByRole("button", { name: "Details" }).click();
  const details = page.getByRole("dialog");
  await expect(details).toBeVisible();
  return details;
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
      await startWavesTrial(page);

      const bar = resultBar(page);
      await expect(bar).toBeVisible({ timeout: 30_000 });
      await expect(bar).toBeFocused();
      // The bar is slim: the summary and Try again wait behind Details.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const details = await openDetails(page);
      await expect(details.getByRole("heading", { level: 2 })).not.toHaveText(
        ""
      );
      await expect(details).toBeFocused();
      await expect(
        details.getByRole("button", { name: "Try again" })
      ).toBeVisible();
      await details.getByRole("button", { name: "Close" }).click();
      await expect(details).toHaveCount(0);

      await bar.getByRole("button", { name: "Back to building" }).click();
      await expect(bar).toHaveCount(0);
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

  test("an iceberg trial: aim, tap the hull, then try another spot", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL, { trialSpeed: 60 });
      await page.getByRole("button", { name: "Sea trial" }).click();
      await page.getByRole("menuitem", { name: "Iceberg" }).click();

      await expect(page.getByText("Tap where the iceberg hits")).toBeVisible();
      expect(await trialStatus(page)).toBe("aiming");

      // Esc backs out, and the menu button comes back with focus.
      await page.keyboard.press("Escape");
      await expect.poll(() => trialStatus(page)).toBe("idle");
      await expect(
        page.getByRole("button", { name: "Sea trial" })
      ).toBeFocused();

      await page.getByRole("button", { name: "Sea trial" }).click();
      await page.getByRole("menuitem", { name: "Iceberg" }).click();
      // In the side view the hull's side sits a little below the canvas middle.
      const canvas = page.getByTestId("ship-canvas");
      const box = await canvas.boundingBox();
      if (!box) throw new Error("no canvas box");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.58);

      await expect(resultBar(page)).toBeVisible({ timeout: 30_000 });
      const details = await openDetails(page);
      await expect(
        details.getByRole("button", { name: "Try another spot" })
      ).toBeVisible();
      await details.getByRole("button", { name: "Try another spot" }).click();
      await expect(details).toHaveCount(0);
      await expect(resultBar(page)).toHaveCount(0);
      expect(await trialStatus(page)).toBe("aiming");
    } finally {
      await browser.close();
    }
  });
});
