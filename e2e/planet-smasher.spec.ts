import { test, expect, type Page } from "@playwright/test";

// Headless Chromium has no GPU and no longer falls back to software WebGL on
// its own, so ask for SwiftShader (Chromium only; WebKit refuses these flags).
test.use({
  launchOptions: [
    async ({ browserName }, use) =>
      use(
        browserName === "chromium"
          ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
          : {}
      ),
    { scope: "worker" },
  ],
});

// Software WebGL renders slowly.
test.setTimeout(120_000);
const START = 8_000_000_000;

async function open(page: Page) {
  await page.goto("/planet-smasher");
  await expect(page.getByTestId("planet-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForFunction(() => Boolean(window.__planetSmasher), null, {
    timeout: 60_000,
  });
}

/** The population shown on the odometer (its aria-label, as a number). */
async function population(page: Page): Promise<number> {
  const label = await page
    .getByRole("img", { name: /^[\d,]+$/ })
    .first()
    .getAttribute("aria-label");
  return Number((label ?? "").replace(/,/g, ""));
}

async function centre(page: Page) {
  const box = await page.getByTestId("planet-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("planet smasher", () => {
  test("loads the globe and arsenal @smoke", async ({ page }) => {
    await open(page);
    await expect(
      page.getByTestId("planet-canvas").locator("canvas")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Asteroid" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("img", { name: "8,000,000,000" }).first()
    ).toBeVisible();
  });

  test("tapping the planet fires and drops the population @smoke", async ({
    page,
  }) => {
    await open(page);
    // Let the scene draw a frame before the first tap.
    await page.waitForFunction(
      () => (window.__planetSmasherRenderInfo?.().calls ?? 0) > 0,
      null,
      { timeout: 60_000 }
    );
    const { x, y } = await centre(page);
    // A tap lands once the scene is ready; tap again until it counts.
    await expect
      .poll(
        async () => {
          await page.mouse.click(x, y);
          await page.waitForTimeout(1000);
          return population(page);
        },
        { timeout: 60_000 }
      )
      .toBeLessThan(START);
  });

  test("dragging rotates without firing @smoke", async ({ page }) => {
    await open(page);
    const { x, y } = await centre(page);
    await page.mouse.move(x - 60, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.move(x + 60, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(1500);
    expect(await population(page)).toBe(START);
  });

  test("reaching an ending shows New planet", async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.__planetSmasher!.forceEnding("shatter"));
    const button = page.getByRole("button", { name: /new planet/i });
    await expect(button).toBeVisible({ timeout: 90_000 });
    await button.click();
    await expect(
      page.getByRole("img", { name: "8,000,000,000" }).first()
    ).toBeVisible();
    await expect(button).toBeHidden();
  });

  test("progress survives a reload", async ({ page }) => {
    await open(page);
    // One asteroid can lose less than a whole point: keep firing until it counts.
    await expect
      .poll(
        async () => {
          // Spread the hits: a crater already hit pays less.
          await page.evaluate(() => {
            for (let i = 0; i < 6; i++) {
              window.__planetSmasher!.fire("asteroid", 0.1 + i * 0.15, 0.5);
            }
          });
          await page.waitForTimeout(500);
          return page.evaluate(
            () => window.__planetSmasher!.state().progress.points
          );
        },
        { timeout: 60_000 }
      )
      .toBeGreaterThan(0);
    const points = await page.evaluate(
      () => window.__planetSmasher!.state().progress.points
    );
    await page.reload();
    await page.waitForFunction(
      () => Boolean(window.__planetSmasher?.state().planet),
      null,
      {
        timeout: 60_000,
      }
    );
    expect(
      await page.evaluate(() => window.__planetSmasher!.state().progress.points)
    ).toBe(points);
  });
});
