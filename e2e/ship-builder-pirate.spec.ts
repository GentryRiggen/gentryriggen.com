import { test, expect, type Page } from "@playwright/test";

/**
 * Pirate ships: the five-card picker, a ready-made galleon with its sails and
 * cannons, and a short sail that moves the ship.
 */

test.setTimeout(120_000);

async function openBuilder(page: Page) {
  await page.addInitScript(() => {
    window.__SHIP_BUILDER_TEST__ = { driveObstacles: [] };
  });
  await page.goto("/ship-builder");
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
}

async function openNewShip(page: Page) {
  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New ship" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Ship Builder pirate ships", () => {
  test(
    "the picker offers five kinds and builds the Whydah Gally",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      const dialog = await openNewShip(page);
      await expect(dialog.locator("[data-card][data-kind]")).toHaveCount(5);

      await dialog.getByRole("button", { name: /Pirate ship/ }).click();
      await expect(dialog.locator("[data-card]")).toHaveCount(5);
      await dialog.getByRole("button", { name: /Whydah Gally/ }).click();
      await expect(dialog).toHaveCount(0);

      const kind = await page.evaluate(
        () => window.__shipBuilderStore!.getState().ship.kind
      );
      expect(kind).toBe("pirate");
      await expect(page.getByTestId("stat-sail-area")).toBeVisible();
      await expect(page.getByTestId("stat-cannons")).toBeVisible();
      const speed = await page.getByTestId("stat-speed").innerText();
      expect(parseFloat(speed)).toBeGreaterThan(0);
    }
  );

  test("a short sail moves a pirate ship", async ({ page }) => {
    await openBuilder(page);
    const dialog = await openNewShip(page);
    await dialog.getByRole("button", { name: /Pirate ship/ }).click();
    await dialog.getByRole("button", { name: /Small sloop/ }).click();

    await page.getByRole("button", { name: "Drive" }).click();
    const picker = page.getByRole("dialog", { name: "Set sail" });
    await picker.getByRole("button", { name: "Set sail" }).click();
    await expect(picker).toHaveCount(0);

    const sails = page.getByRole("slider", { name: /sails/i });
    await expect(sails).toBeVisible();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
    await expect(sails).toHaveAttribute("aria-valuenow", "100");

    const knots = page.getByLabel(/^Speed \d+(\.\d+)? knots$/);
    await expect
      .poll(
        async () => {
          const label = (await knots.first().getAttribute("aria-label")) ?? "";
          return parseFloat(label.replace("Speed ", ""));
        },
        { timeout: 30_000 }
      )
      .toBeGreaterThan(0);
  });
});
