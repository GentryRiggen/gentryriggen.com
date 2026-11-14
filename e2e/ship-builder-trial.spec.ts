import {
  test,
  expect,
  type Browser,
  type BrowserType,
  type Page,
} from "@playwright/test";

/**
 * Boom! and sea trial flows. The trial plays in the WebGL scene, so (like the other
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

/**
 * Taps the canvas across its middle at `height` (a share of its height). The
 * default lands on the hull's side in the side view.
 */
async function tapShip(page: Page, height = 0.58) {
  // In the side view the hull's side sits a little below the canvas middle.
  const canvas = page.getByTestId("ship-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * height);
}

/**
 * Taps down the middle of the canvas until the Boom! trial holds `count`
 * bombs: the camera glides (to the side view, or to frame the wreck), so
 * where she sits on screen moves.
 */
async function dropBombUntil(page: Page, count: number) {
  await expect(async () => {
    for (const height of [0.58, 0.5, 0.42, 0.34, 0.66]) {
      if ((await bombCount(page)) >= count) break;
      await tapShip(page, height);
    }
    expect(await bombCount(page)).toBe(count);
  }).toPass({ timeout: 30_000 });
}

const bombCount = (page: Page) =>
  page.evaluate(() => {
    const { trial } = window.__shipBuilderStore!.getState();
    return trial.status === "running" || trial.status === "result"
      ? (trial.input.boom?.bombs.length ?? 0)
      : 0;
  });

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
  test("Boom!: tap the ship, she sinks to a result, and building works again", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL, { trialSpeed: 60 });
      const start = page.getByRole("button", { name: "Boom!" });
      await start.click();
      await page.getByRole("menuitem", { name: "Bombs" }).click();
      await expect(page.getByText("Tap the ship to drop a bomb")).toBeVisible();
      expect(await trialStatus(page)).toBe("aiming");
      await dropBombUntil(page, 1);

      const bar = resultBar(page);
      await expect(bar).toBeVisible({ timeout: 30_000 });
      await expect(bar.getByText(/after the first bomb/)).toBeVisible();
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

  test("Boom!: another bomb joins the run and it plays on from there", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      // Held a few seconds in, so she stays afloat where the taps land.
      const page = await openBuilder(browser, baseURL, { trialSeconds: 3 });
      await page.getByRole("button", { name: "Boom!" }).click();
      await page.getByRole("menuitem", { name: "Bombs" }).click();
      await dropBombUntil(page, 1);
      const runId = () =>
        page.evaluate(() => {
          const { trial } = window.__shipBuilderStore!.getState();
          return trial.status === "running" ? trial.runId : null;
        });
      const first = await runId();
      expect(first).not.toBeNull();
      await dropBombUntil(page, 2);
      expect(await trialStatus(page)).toBe("running");
      expect(await runId()).toBe(first);
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
      await page.getByRole("button", { name: "Boom!" }).click();
      await page.getByRole("menuitem", { name: "Iceberg" }).click();

      await expect(page.getByText("Tap where the iceberg hits")).toBeVisible();
      expect(await trialStatus(page)).toBe("aiming");

      // Esc backs out, and the menu button comes back with focus.
      await page.keyboard.press("Escape");
      await expect.poll(() => trialStatus(page)).toBe("idle");
      await expect(page.getByRole("button", { name: "Boom!" })).toBeFocused();

      await page.getByRole("button", { name: "Boom!" }).click();
      await page.getByRole("menuitem", { name: "Iceberg" }).click();
      await tapShip(page);

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
