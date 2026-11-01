import { test, expect, type Page } from "@playwright/test";

/** Opens the page and taps through the start screen to the hub. */
async function openHub(page: Page) {
  await page.goto("/ever-onward");
  await page.getByTestId("eo-start-button").click();
}

/** Starts a fresh game and gets past the opening moment. */
async function startGame(page: Page) {
  await openHub(page);
  await page.getByTestId("lm-play-light").click();
  await page
    .getByTestId("lm-phase-overlay")
    .getByRole("button", { name: "Continue" })
    .click();
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
      await page
        .getByTestId("lm-phase-overlay")
        .getByRole("button", { name: "Continue" })
        .click();

      await expect(page.getByTestId("lm-hud-value")).toHaveText("0");
      await page.getByTestId("lm-tap").click();
      // The lamp's oil bill can eat a lone coin; the floating gain stays.
      await expect(page.getByText(/^\+\d+$/).first()).toBeVisible();
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

  test("oil is bought by hand once a few ships have been guided", async ({
    page,
  }) => {
    await startGame(page);
    await expect(page.getByRole("region", { name: "Actions" })).toHaveCount(0);
    for (let i = 0; i < 14; i += 1) await page.getByTestId("lm-tap").click();
    const actions = page.getByRole("region", { name: "Actions" });
    await expect(actions).toContainText("Buy oil");
    await expect(actions).toContainText("a barrel");
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

  test("the versions page lists the release", async ({ page }) => {
    await page.goto("/ever-onward/versions");
    await expect(page.getByRole("heading", { name: /v1\.1\.0/ })).toBeVisible();
  });
});
