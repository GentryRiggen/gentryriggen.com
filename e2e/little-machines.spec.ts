import { test, expect, type Page } from "@playwright/test";

/** Starts a fresh game and gets past the opening moment. */
async function startGame(page: Page) {
  await page.goto("/little-machines");
  await page.getByRole("button", { name: /Play/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("Little Machines", () => {
  test(
    "hub loads and tapping the light earns coins",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/little-machines");
      await expect(
        page.getByRole("heading", { name: "Little Machines" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Make It Grow" })
      ).toBeVisible();

      await page.getByRole("button", { name: /Play/ }).click();
      await expect(page.getByTestId("lm-phase-overlay")).toContainText(
        "The Coast"
      );
      await page.getByRole("button", { name: "Continue" }).click();

      const coins = page.getByTestId("lm-res-coins");
      await expect(coins).toHaveText("0");
      await page.getByTestId("lm-tap").click();
      await expect(coins).not.toHaveText("0");
      await expect(page.getByTestId("lm-scene")).toBeVisible();
    }
  );

  test("buying the first upgrade survives a reload", async ({ page }) => {
    await startGame(page);
    const lens = page.getByRole("button", { name: /Better lens/ });
    for (let i = 0; i < 60 && (await lens.isDisabled()); i += 1) {
      await page.getByTestId("lm-tap").click();
    }
    await expect(lens).toBeEnabled();
    await lens.click();
    await expect(lens).toContainText("Level 1");

    await page.reload();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByTestId("lm-phase-overlay")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Better lens/ })
    ).toContainText("Level 1");
  });

  test("the versions page lists the release", async ({ page }) => {
    await page.goto("/little-machines/versions");
    await expect(page.getByRole("heading", { name: /v1\.0\.0/ })).toBeVisible();
  });
});
