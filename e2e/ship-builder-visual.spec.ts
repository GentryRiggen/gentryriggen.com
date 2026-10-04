import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression tests for the 3D scene: a horizon seam, missing lights or
 * a broken sky show up as a pixel diff against a committed screenshot.
 *
 * The scene is made deterministic by the frozen clock (`freezeTime`, see
 * components/ship-builder/scene/testClock.ts): every animation shows the same
 * instant and pop-ins and look changes finish at once.
 *
 * BASELINES ARE PLATFORM SPECIFIC. CI renders on Linux (software WebGL via
 * SwiftShader), so only the Linux baselines are committed
 * (`*-chromium-linux.png`) and this spec skips on other platforms. To
 * regenerate them after an intended visual change, run
 *
 *   npm run test:visual:update
 *
 * which renders inside the official Playwright Docker image (Docker must be
 * running), then review the changed PNGs in git before committing. To check
 * the baselines locally without waiting for CI, run `npm run test:visual`.
 */

const FROZEN_SECONDS = 3;
/** Sim seconds into a trial that catches a top-heavy ship rolling over. */
const CAPSIZE_SECONDS = 1.8;
/**
 * Fraction of canvas pixels allowed to differ. SwiftShader is stable from run
 * to run (measured 0 differing pixels), so this only absorbs rare edge
 * antialiasing; a horizon seam, a missing light or a changed fog colour moves
 * far more pixels than this.
 */
const MAX_DIFF_PIXEL_RATIO = Number(process.env.VISUAL_TOLERANCE || 0.001);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);
test.skip(
  process.platform !== "linux" && !process.env.VISUAL_ANY_PLATFORM,
  "Baselines are rendered on Linux; run `npm run test:visual` (Docker)"
);

// Software WebGL renders a big scene slowly, and the screenshot waits for two
// identical frames.
test.setTimeout(90_000);

test.use({
  viewport: { width: 1024, height: 768 },
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  },
});

type Time = "Day" | "Sunset" | "Night";
type Sea = "Calm" | "Choppy" | "Stormy";

interface Look {
  time: Time;
  sea: Sea;
  /** Template as [category, name]; omitted keeps the blank starter ship. */
  template?: [category: string, name: string];
  below?: boolean;
  /** Narrow the hull and stack decks, so the ship is top-heavy. */
  towerOfDecks?: boolean;
  /** Start a sea trial held at this many seconds (see testClock.ts). */
  trialSeconds?: number;
}

async function openFrozenScene(
  page: Page,
  { time, sea, template, below, towerOfDecks, trialSeconds }: Look
) {
  await page.addInitScript(
    ({ freezeTime, trialSeconds }) => {
      window.__SHIP_BUILDER_TEST__ = { freezeTime, trialSeconds };
      // Both side panels collapsed, so the canvas is the whole picture.
      window.localStorage.setItem(
        "ship-builder:ui:collapsed",
        JSON.stringify({ left: true, right: true })
      );
    },
    { freezeTime: FROZEN_SECONDS, trialSeconds }
  );
  await page.goto("/ship-builder");
  await expect(page.getByRole("heading", { name: "Ship Builder" })).toBeVisible(
    { timeout: 60_000 }
  );
  await expect(page.getByTestId("ship-canvas").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });

  if (template) {
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New ship" });
    await dialog.getByRole("button", { name: new RegExp(template[0]) }).click();
    await dialog.getByRole("button", { name: new RegExp(template[1]) }).click();
    await expect(dialog).toHaveCount(0);
  }
  if (towerOfDecks) {
    await page.evaluate(() => {
      const store = () => window.__shipBuilderStore!.getState();
      store().changeBeam(-10);
      store().selectTool("deck-1x1");
      for (let level = 0; level < 4; level++) {
        for (let x = 2; x < 20; x++) {
          for (let z = 0; z < 3; z++) {
            store().placeAt({ kind: "grid", level, x, z });
          }
        }
      }
      store().cancel();
    });
  }
  await page.getByRole("button", { name: time, exact: true }).click();
  await page.getByRole("button", { name: `${sea} sea` }).click();
  if (trialSeconds !== undefined) {
    await page.getByRole("button", { name: "Sea trial" }).click();
    await page.getByRole("menuitem", { name: "Waves" }).click();
  }
  if (below) await page.getByRole("button", { name: "Below view" }).click();
  // Click the empty sky to drop focus rings and hover states off the controls.
  await page.mouse.move(0, 0);
}

async function expectScene(page: Page, name: string) {
  await expect(page.getByTestId("ship-canvas")).toHaveScreenshot(name, {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    threshold: 0.1,
    timeout: 30_000,
    stylePath: path.join(__dirname, "ship-builder-visual.css"),
  });
}

test.describe("Ship Builder scene visuals", () => {
  test("blank liner, day, calm", async ({ page }) => {
    await openFrozenScene(page, { time: "Day", sea: "Calm" });
    await expectScene(page, "blank-day-calm.png");
  });

  const titanic: Look["template"] = ["Ocean liner", "RMS Titanic"];
  const titanicLooks: Look[] = [
    { time: "Day", sea: "Calm", template: titanic },
    { time: "Sunset", sea: "Calm", template: titanic },
    { time: "Night", sea: "Calm", template: titanic },
    { time: "Night", sea: "Stormy", template: titanic },
    { time: "Day", sea: "Choppy", template: titanic },
  ];
  for (const look of titanicLooks) {
    const name = `titanic-${look.time}-${look.sea}`.toLowerCase();
    test(`RMS Titanic, ${look.time.toLowerCase()}, ${look.sea.toLowerCase()}`, async ({
      page,
    }) => {
      await openFrozenScene(page, look);
      await expectScene(page, `${name}.png`);
    });
  }

  test("cruise ship at night", async ({ page }) => {
    await openFrozenScene(page, {
      time: "Night",
      sea: "Calm",
      template: ["Cruise ship", "Wonder of the Seas"],
    });
    await expectScene(page, "cruise-night-calm.png");
  });

  test("Titanic from below at night", async ({ page }) => {
    await openFrozenScene(page, {
      time: "Night",
      sea: "Calm",
      template: titanic,
      below: true,
    });
    await expectScene(page, "titanic-below-night-calm.png");
  });

  test("top-heavy ship capsizing in a stormy sea", async ({ page }) => {
    await openFrozenScene(page, {
      time: "Day",
      sea: "Stormy",
      towerOfDecks: true,
      trialSeconds: CAPSIZE_SECONDS,
    });
    await expectScene(page, "tower-capsizing-day-stormy.png");
  });
});
