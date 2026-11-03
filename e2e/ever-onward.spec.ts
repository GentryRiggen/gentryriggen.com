import { test, expect, type Page } from "@playwright/test";

/** Opens the page and taps through the start screen to the hub. */
async function openHub(page: Page) {
  await page.goto("/ever-onward");
  await page.getByTestId("eo-start-button").click();
}

/** Gets past a phase cutscene: skip to the goal, then start. */
async function passCutscene(page: Page) {
  const overlay = page.getByTestId("lm-phase-overlay");
  await overlay.getByRole("button", { name: "Skip" }).click();
  await overlay.getByRole("button", { name: "Start" }).click();
}

/** Starts a fresh game and gets past the opening moment. */
async function startGame(page: Page) {
  await openHub(page);
  await page.getByTestId("lm-play-light").click();
  await passCutscene(page);
}

test.describe("Ever Onward", () => {
  test(
    "the start screen shows first and Enter opens the hub",
    {
      tag: "@smoke",
    },
    async ({ page }) => {
      await page.goto("/ever-onward");
      await expect(page.getByTestId("eo-start")).toBeVisible();
      await expect(page.getByTestId("eo-robot")).toBeVisible();
      await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
      await expect(page.getByTestId("lm-play-light")).toHaveCount(0);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("lm-play-light")).toBeVisible();
    }
  );

  test(
    "hub loads and tapping the light earns coins",
    { tag: "@smoke" },
    async ({ page }) => {
      await openHub(page);
      await expect(
        page.getByRole("heading", { name: "Ever Onward" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Make It Grow" })
      ).toBeVisible();

      await page.getByTestId("lm-play-light").click();
      await expect(page.getByTestId("lm-phase-overlay")).toContainText(
        "The Coast"
      );
      await passCutscene(page);

      await expect(page.getByTestId("lm-hud-value")).toHaveText("0");
      await page.getByTestId("lm-tap").click();
      // The lamp's oil bill can eat a lone coin; the floating gain stays.
      await expect(page.getByText(/^\+\d+$/).first()).toBeVisible();
      await expect(page.getByTestId("lm-scene")).toBeVisible();
    }
  );

  test(
    "a finished Lighthouse unlocks Make It Grow",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "ever-onward:save",
          JSON.stringify({
            version: 1,
            seenIntro: true,
            universes: {
              light: {
                run: {
                  phase: 0,
                  time: 5,
                  taps: 1,
                  complete: false,
                  resources: { coins: 0 },
                  owned: {},
                  mods: {},
                  flags: {},
                  revealed: ["lens"],
                  story: ["coast-hello"],
                  transitions: [],
                  rng: 1,
                },
                best: 1200,
                completions: 1,
                embers: 3,
                prestigeUpgrades: {},
              },
            },
          })
        );
      });
      await openHub(page);
      await expect(page.getByTestId("lm-locked-grow")).toHaveCount(0);
      await expect(page.getByTestId("lm-play-grow")).toBeVisible();
      await page.getByTestId("lm-play-grow").click();
      await expect(page.getByTestId("lm-phase-overlay")).toContainText(
        "The Backyard"
      );
      await passCutscene(page);
      await page.getByTestId("lm-tap").click();
      await expect(page.getByText(/^\+\d+(\.\d+)?$/).first()).toBeVisible();
      await expect(page.getByTestId("lm-scene")).toBeVisible();
    }
  );

  test("buying the first upgrade survives a reload", async ({ page }) => {
    await startGame(page);
    const lens = page
      .getByRole("region", { name: "Upgrades" })
      .getByRole("button", { name: /Better lens/ });
    await expect
      .poll(
        async () => {
          // A burst per attempt: the lamp's oil bill eats slow tapping.
          for (let i = 0; i < 30; i += 1)
            await page.getByTestId("lm-tap").click();
          return lens.getAttribute("aria-disabled");
        },
        { timeout: 60_000 }
      )
      .toBe("false");
    await lens.click();
    await expect(lens).toContainText("Level 1");

    await page.reload();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.getByTestId("eo-start-button").click();
    await page.getByTestId("lm-play-light").click();
    await expect(page.getByTestId("lm-phase-overlay")).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "Upgrades" })
        .getByRole("button", { name: /Better lens/ })
    ).toContainText("Level 1");
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the coin counter bar and a tap button stay in view at the top and scrolled down", async ({
      page,
    }) => {
      await startGame(page);
      const hud = page.getByTestId("lm-hud");
      await expect(hud).toBeInViewport();

      for (let i = 0; i < 15; i += 1) await page.getByTestId("lm-tap").click();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );

      await expect(hud).toBeInViewport();
      const value = page.getByTestId("lm-hud-value");
      await expect(value).toBeVisible();
      await expect(page.getByTestId("lm-hud-rate")).toContainText("/s");

      // Scrolled down, the bar folds to one slim row; a tap peeks at it.
      await expect(hud).toHaveAttribute("data-compact", "true");
      await expect(page.getByTestId("lm-hud-next")).toBeHidden();
      await page.getByTestId("lm-hud-toggle").click();
      await expect(page.getByTestId("lm-hud-next")).toBeVisible();

      // The tap button floats at the bottom centre and keeps earning.
      const tap = page.getByRole("button", { name: "Flash the light" });
      await expect(tap).toBeInViewport();
      await tap.click();

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(hud).toHaveAttribute("data-compact", "false");
      await expect(page.getByTestId("lm-hud-next")).toBeVisible();
      await expect(hud).toBeInViewport();
      await expect(tap).toBeInViewport();
    });

    test("the Coast never scrolls sideways, and folding the bar moves nothing", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "ever-onward:save",
          JSON.stringify({
            version: 1,
            seenIntro: true,
            universes: {
              light: {
                run: {
                  phase: 0,
                  time: 600,
                  taps: 400,
                  complete: false,
                  resources: {
                    coins: 700000,
                    oil: 22700,
                    oilPrice: 0.4,
                  },
                  owned: { lens: 5, keeper: 3, lighthouse: 4 },
                  mods: {},
                  flags: {},
                  revealed: ["lens", "keeper", "lighthouse"],
                  story: ["coast-hello"],
                  transitions: [],
                  rng: 1,
                },
                best: null,
                completions: 0,
                embers: 0,
                prestigeUpgrades: {},
              },
            },
          })
        );
      });
      await openHub(page);
      await page.getByTestId("lm-play-light").click();
      const overlay = page.getByTestId("lm-phase-overlay");
      if (await overlay.isVisible().catch(() => false))
        await passCutscene(page);
      const buy = page.getByTestId("lm-buy-oil");
      await expect(buy).toBeVisible();

      const sideways = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
      expect(await sideways()).toBeLessThanOrEqual(0);

      // Just above and just past the fold: the button keeps its place in the
      // page (only the bar and the scene above it shrink).
      const pageTop = () =>
        buy.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      await page.evaluate(() => window.scrollTo(0, 10));
      await expect(page.getByTestId("lm-hud")).toHaveAttribute(
        "data-compact",
        "false"
      );
      const before = await pageTop();
      await page.evaluate(() => window.scrollTo(0, 200));
      await expect(page.getByTestId("lm-hud")).toHaveAttribute(
        "data-compact",
        "true"
      );
      expect(await pageTop()).toBeCloseTo(before, 0);
      await expect(buy).toBeInViewport();
      expect(await sideways()).toBeLessThanOrEqual(0);
    });
  });
});
