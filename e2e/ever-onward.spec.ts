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

/** Seeds a save (before the page loads) with a Light run patched as asked. */
async function seedLight(
  page: Page,
  run: Record<string, unknown>,
  universe: Record<string, unknown> = {}
) {
  await page.addInitScript(
    ({ runPatch, universePatch }) => {
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
                taps: 40,
                complete: false,
                resources: { coins: 0 },
                owned: {},
                mods: {},
                flags: {},
                revealed: ["lens"],
                story: ["coast-hello"],
                transitions: [],
                rng: 1,
                ...runPatch,
              },
              best: 1200,
              completions: 1,
              embers: 0,
              prestigeUpgrades: {},
              ...universePatch,
            },
          },
        })
      );
    },
    { runPatch: run, universePatch: universe }
  );
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
    "Make It Grow is locked until the Lighthouse is finished",
    { tag: "@smoke" },
    async ({ page }) => {
      await openHub(page);
      await expect(page.getByTestId("lm-locked-grow")).toContainText(
        "Opens when you finish Keep the Light On."
      );
      await expect(page.getByTestId("lm-play-grow")).toHaveCount(0);
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

  test("the lamp opens with the first keeper and sells oil", async ({
    page,
  }) => {
    await seedLight(page, {
      resources: { coins: 200, oil: 10, ships: 30 },
      owned: { keeper: 1 },
    });
    await openHub(page);
    await page.getByTestId("lm-play-light").click();
    const lamp = page.getByTestId("lm-lamp");
    await expect(lamp).toBeVisible();
    await expect(page.getByTestId("lm-buy-oil")).toContainText(/Buy oil/i);
    await expect(page.getByTestId("lm-lamp-best")).toBeVisible();
    await page.getByTestId("lm-lamp-0").click();
    await expect(lamp).toContainText("Dim");
    await expect(page.getByTestId("lm-hud-rate")).toContainText("/s");
  });

  test("browser Back from the game returns to the hub", async ({ page }) => {
    await startGame(page);
    await page.goBack();
    await expect(page.getByTestId("lm-play-light")).toBeVisible();
    await expect(page.getByTestId("lm-tap")).toHaveCount(0);
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

      // The tap button floats at the bottom centre and keeps earning.
      const tap = page.getByRole("button", { name: "Flash the light" });
      await expect(tap).toBeInViewport();
      await tap.click();
      await expect(page.getByTestId("lm-hud-next")).toBeVisible();

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(hud).toBeInViewport();
      await expect(tap).toBeInViewport();
    });

    test("the page cannot be zoomed and the tap button is zoom-proof", async ({
      page,
    }) => {
      await startGame(page);
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        "content",
        /maximum-scale=1/
      );
      const tap = page.getByTestId("lm-tap");
      await expect(tap).toHaveCSS("touch-action", "manipulation");
      await expect(tap).toHaveAccessibleName("Flash the light");
    });
  });

  test.describe("on an iPad in landscape", () => {
    test.use({ viewport: { width: 1180, height: 820 } });

    test(
      "tapping the next goal scrolls the column, never the page",
      { tag: "@smoke" },
      async ({ page }) => {
        await seedLight(page, { resources: { coins: 5, oil: 40 } });
        await openHub(page);
        await page.getByTestId("lm-play-light").click();
        await expect(page.getByTestId("lm-hud-next")).toBeVisible();
        const sizes = await page.evaluate(() => ({
          doc: document.documentElement.scrollHeight,
          inner: window.innerHeight,
        }));
        expect(sizes.doc).toBe(sizes.inner);
        await page.getByTestId("lm-hud-next").click();
        await page.waitForTimeout(800);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        const hud = await page.getByTestId("lm-hud").boundingBox();
        const card = await page
          .getByRole("region", { name: "Upgrades" })
          .getByRole("button")
          .first()
          .boundingBox();
        expect(card && hud && card.y >= hud.height - 1).toBe(true);
      }
    );
  });

  test.describe("on a small phone", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the header never scrolls the page sideways", async ({ page }) => {
      await seedLight(
        page,
        { owned: { lens: 1 }, revealed: ["lens"], resources: { coins: 0 } },
        { embers: 3 }
      );
      await openHub(page);
      await page.getByTestId("lm-play-light").click();
      await expect(page.getByTestId("lm-ember-button")).toBeVisible();
      await expect(page.getByTestId("lm-upgrades-button")).toBeVisible();
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(widths.scroll).toBe(widths.inner);
    });
  });

  test.describe("on a phone, opening a universe", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("starts at the top of the page", async ({ page }) => {
      await seedLight(page, {});
      await openHub(page);
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );
      await page.getByTestId("lm-play-light").click();
      await expect(page.getByTestId("lm-tap")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    });

    test("an out-of-oil warning sits near the top and the chip leads to oil", async ({
      page,
    }) => {
      await seedLight(page, {
        resources: { coins: 30, oil: 0, ships: 14 },
        owned: { keeper: 1 },
      });
      await openHub(page);
      await page.getByTestId("lm-play-light").click();
      const alert = page.getByTestId("lm-alert");
      await expect(alert).toBeVisible();
      const box = await alert.boundingBox();
      expect(box && box.y).toBeLessThanOrEqual(650);
      await page.getByTestId("lm-hud-alert").click();
      await page.waitForTimeout(800);
      await expect(page.getByTestId("lm-buy-oil")).toBeInViewport();
    });
  });

  test("the menu is a dialog that closes with Escape", async ({ page }) => {
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await expect(page.getByTestId("lm-tap-fab")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
  });

  test("the versions page lists the release", async ({ page }) => {
    await page.goto("/ever-onward/versions");
    await expect(page.getByRole("heading", { name: /v1\.1\.0/ })).toBeVisible();
  });
});
