import { test, expect, type Page } from "@playwright/test";
import type { Progress } from "@/lib/plane-builder/economy/progress";

// Headless Chromium has no GPU and no longer falls back to software WebGL on
// its own, so ask for SwiftShader (the same flags the Ship Builder specs use).
// WebKit ignores these.
// Software WebGL for Chromium on CI. The flags are Chromium-only, and WebKit
// refuses to launch with them.
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

// Software WebGL renders slowly, and the sim runs no faster than the frames.
test.setTimeout(120_000);
const RESULTS_TIMEOUT = 90_000;

/** Stops the after-flight coin gauge, then closes the reward card. */
async function claimReward(page: Page) {
  await page.getByRole("button", { name: "Stop!" }).click({
    timeout: RESULTS_TIMEOUT,
  });
  await page.getByRole("button", { name: "Continue" }).click();
}

async function open(page: Page) {
  await page.goto("/plane-builder");
  await expect(
    page.getByRole("heading", { name: "Plane Builder" })
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__planeBuilderStore));
}

interface MeadowSeed {
  coins?: number;
  finished?: boolean;
  unlockCanyon?: boolean;
}

/** Overwrites the meadow's progress; the game saves it like any other change. */
async function seedMeadow(page: Page, seed: MeadowSeed) {
  await page.evaluate((s) => {
    const store = window.__planeBuilderStore!.getState();
    const progress = store.progress;
    const next: Progress = {
      ...progress,
      levels: {
        ...progress.levels,
        meadow: {
          ...progress.levels.meadow,
          coins: s.coins ?? 0,
          best: s.finished ? 2000 : 0,
          finished: s.finished ?? false,
        },
      },
      unlocked: s.unlockCanyon ? ["meadow", "canyon"] : progress.unlocked,
    };
    store.hydrate(next);
  }, seed);
}

function meadow(page: Page) {
  return page.evaluate(() => {
    const { progress } = window.__planeBuilderStore!.getState();
    return progress.levels.meadow;
  });
}

async function dragLaunch(page: Page) {
  const overlay = page.getByTestId("launch-overlay");
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  if (!box) throw new Error("launch overlay has no box");
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x - 100, centre.y + 100, { steps: 5 });
  await page.mouse.move(centre.x - 200, centre.y + 200, { steps: 5 });
  await page.mouse.up();
}

test.describe("Plane Builder", () => {
  test(
    "play, upgrade, fly, and the save survives a reload",
    { tag: "@smoke" },
    async ({ page }) => {
      await open(page);
      await seedMeadow(page, { coins: 1000 });

      await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
      await page
        .getByRole("button", { name: /^Buy Wings for \d+ coins$/ })
        .click();
      await expect(
        page.getByText("Folded wings", { exact: true })
      ).toBeVisible();
      await page.getByRole("button", { name: "Launch!" }).click();

      await dragLaunch(page);

      await claimReward(page);
      await expect(page.getByText(/Total: \+/)).toBeVisible();
      const afterFlight = await meadow(page);
      expect(afterFlight.tiers.wings).toBe(1);
      expect(afterFlight.best).toBeGreaterThan(0);

      await expect(page.getByRole("region", { name: "Hangar" })).toBeVisible();

      await page.reload();
      await page.waitForFunction(() => Boolean(window.__planeBuilderStore));
      const saved = await meadow(page);
      expect(saved.coins).toBe(afterFlight.coins);
      expect(saved.tiers.wings).toBe(1);

      await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
      await expect(
        page.getByText("Folded wings", { exact: true })
      ).toBeVisible();
    }
  );

  test(
    "buttons work by touch",
    { tag: "@smoke" },
    async ({ page, hasTouch }) => {
      test.skip(!hasTouch, "Touch only");
      await open(page);
      await seedMeadow(page, { coins: 1000 });

      await page.getByRole("button", { name: "Play Backyard Meadow" }).tap();
      await page.getByRole("button", { name: /^Buy Engine for/ }).tap();
      expect((await meadow(page)).tiers.engine).toBe(1);
      await page.getByRole("button", { name: "Launch!" }).tap();
      await expect(page.getByTestId("launch-overlay")).toBeVisible();
      await page.getByRole("button", { name: "← Hangar" }).tap();
      await expect(page.getByRole("region", { name: "Hangar" })).toBeVisible();
    }
  );

  test("launches from the keyboard", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await page.getByRole("button", { name: "Launch!" }).click();
    await expect(page.getByTestId("launch-overlay")).toBeVisible();

    await page.keyboard.down("Space");
    await page.waitForTimeout(1000);
    await page.keyboard.up("Space");

    await claimReward(page);
    await expect(page.getByText(/Total: \+/)).toBeVisible();
  });

  test("finishing the meadow unlocks the canyon", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await expect(
      page.getByText("Reach the finish in Backyard Meadow to unlock")
    ).toHaveCount(0);

    await page.evaluate(() => {
      const store = window.__planeBuilderStore!;
      store.setState({ screen: "flight" });
      store.getState().completeFlight(
        {
          distance: 2000,
          coins: 0,
          rings: 0,
          finished: true,
          finishTime: 20,
          endReason: "runout",
        },
        store.getState().flightId
      );
    });
    await expect(page.getByText("Desert Canyon unlocked!")).toBeVisible();
    await claimReward(page);

    const canyon = page.getByRole("article", { name: "Desert Canyon" });
    await expect(canyon.getByText("Next up!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play Desert Canyon" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Replay Backyard Meadow" })
    ).toBeVisible();
  });

  test("Restart asks first, and Replay replaces Play once finished", async ({
    page,
  }) => {
    await open(page);
    await seedMeadow(page, { coins: 500, finished: true, unlockCanyon: true });
    await expect(
      page.getByRole("button", { name: "Replay Backyard Meadow" })
    ).toBeVisible();

    const dialog = page.getByRole("dialog", {
      name: "Restart Backyard Meadow?",
    });
    await page.getByRole("button", { name: "Restart Backyard Meadow" }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect((await meadow(page)).coins).toBe(500);

    await page.getByRole("button", { name: "Restart Backyard Meadow" }).click();
    await dialog.getByRole("button", { name: "Restart", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await meadow(page)).toMatchObject({
      coins: 0,
      best: 0,
      finished: false,
    });
    await expect(
      page.getByRole("button", { name: "Play Backyard Meadow" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Restart Backyard Meadow" })
    ).toHaveCount(0);
    // The canyon stays unlocked.
    await expect(
      page.getByRole("button", { name: "Play Desert Canyon" })
    ).toBeVisible();
  });

  test(
    "shows a friendly message when WebGL is missing",
    { tag: "@smoke" },
    async ({ page, browserName }) => {
      test.skip(
        browserName !== "chromium",
        "Only Chromium can switch WebGL off"
      );
      // The default launch flags give the page software WebGL, so switch it
      // off for this page by hiding the context constructors.
      await page.addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = () => null;
      });
      await page.goto("/plane-builder");
      await expect(page.getByText("3D isn't available here")).toBeVisible();
    }
  );
});
