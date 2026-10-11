import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import type { Progress } from "@/lib/plane-builder/economy/progress";
import { MAX_TIER } from "@/lib/plane-builder/plane/catalog";

/**
 * Visual regression tests for the 3D scene and HUD: a missing part, a broken
 * sky or a moved HUD shows up as a pixel diff against a committed screenshot.
 *
 * Motion is made deterministic two ways: the hangar turntable stops under
 * `prefers-reduced-motion`, and the flight is held at a fixed sim time by the
 * `holdFlightSeconds` test hook (see lib/plane-builder/testHooks.ts), which
 * also stops the coins spinning.
 *
 * BASELINES ARE PLATFORM SPECIFIC. CI renders on Linux (software WebGL via
 * SwiftShader), so only the Linux baselines are committed
 * (`*-chromium-linux.png`) and this spec skips on other platforms. To
 * regenerate them after an intended visual change, run
 *
 *   VISUAL_SPEC=plane-builder npm run test:visual:update
 *
 * which renders inside the official Playwright Docker image (Docker must be
 * running), then review the changed PNGs in git before committing.
 */

/** Sim seconds into the flight that the HUD shot is held at. */
const HOLD_FLIGHT_SECONDS = 1.5;
/** Fraction of pixels allowed to differ (software WebGL is stable). */
const MAX_DIFF_PIXEL_RATIO = Number(process.env.VISUAL_TOLERANCE || 0.001);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);
test.skip(
  process.platform !== "linux" && !process.env.VISUAL_ANY_PLATFORM,
  "Baselines are rendered on Linux; run `VISUAL_SPEC=plane-builder npm run test:visual` (Docker)"
);

test.setTimeout(90_000);

test.use({
  viewport: { width: 1024, height: 768 },
  reducedMotion: "reduce",
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  },
});

async function open(page: Page, holdFlightSeconds?: number) {
  if (holdFlightSeconds !== undefined) {
    await page.addInitScript((seconds) => {
      window.__PLANE_BUILDER_TEST__ = { holdFlightSeconds: seconds };
    }, holdFlightSeconds);
  }
  await page.goto("/plane-builder");
  await expect(
    page.getByRole("heading", { name: "Plane Builder" })
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__planeBuilderStore));
}

async function seedMeadow(
  page: Page,
  patch: { coins: number; tier: number; best: number }
) {
  await page.evaluate(({ coins, tier, best }) => {
    const store = window.__planeBuilderStore!.getState();
    const progress: Progress = store.progress;
    const meadow = progress.levels.meadow;
    store.hydrate({
      ...progress,
      levels: {
        ...progress.levels,
        meadow: {
          ...meadow,
          coins,
          best,
          tiers: Object.fromEntries(
            Object.keys(meadow.tiers).map((track) => [track, tier])
          ) as typeof meadow.tiers,
        },
      },
    });
  }, patch);
}

async function expectPage(page: Page, name: string) {
  // Move the pointer off the controls so no hover state is photographed.
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    threshold: 0.1,
    timeout: 30_000,
    stylePath: path.join(__dirname, "plane-builder-visual.css"),
  });
}

test.describe("Plane Builder visuals", () => {
  test("hangar with the starter plane", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await expect(page.getByRole("region", { name: "Hangar" })).toBeVisible();
    await expectPage(page, "hangar-starter.png");
  });

  test("hangar with a maxed plane", async ({ page }) => {
    await open(page);
    await seedMeadow(page, { coins: 12345, tier: MAX_TIER, best: 800 });
    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await expect(page.getByRole("region", { name: "Hangar" })).toBeVisible();
    await expectPage(page, "hangar-maxed.png");
  });

  test("flight HUD held mid-flight", async ({ page }) => {
    await open(page, HOLD_FLIGHT_SECONDS);
    await seedMeadow(page, { coins: 0, tier: 2, best: 400 });
    await page.evaluate(() => {
      const store = window.__planeBuilderStore!.getState();
      store.openLevel("meadow");
      store.beginFlight({ pitch: 0.35, yaw: 0, power: 0.9 });
    });
    await expect(page.getByRole("progressbar", { name: "Fuel" })).toBeVisible();
    // The chase camera eases toward the held plane; give it time to settle.
    await page.waitForTimeout(4000);
    await expectPage(page, "flight-hud.png");
  });
});
