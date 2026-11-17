import { test, expect, type Page } from "@playwright/test";

const DAY_MS = 24 * 3_600_000;

/** Opens the game with its clock set to local noon on a fixed day. */
async function open(page: Page, hour = 12) {
  await page.goto("/flamelings");
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await page.evaluate(
    (h) => window.__flamelings!.setNow(new Date(2026, 10, 17, h).getTime()),
    hour
  );
}

async function hatch(page: Page, name: string) {
  await page.getByTestId("hatch-new").click();
  for (let i = 0; i < 5; i++) await page.getByTestId("egg").click();
  await page.getByRole("button", { name: "Hello, little flame!" }).click();
  await page.getByLabel("Name your flameling").fill(name);
  await page.getByRole("button", { name: "Welcome home!" }).click();
  await expect(
    page.getByRole("button", { name: `${name}, tap to say hi` })
  ).toBeVisible();
}

async function feedOnce(page: Page, food: string) {
  await page.getByRole("button", { name: "Feed", exact: true }).click();
  await page.getByRole("button", { name: food, exact: true }).click();
  // The food flies in, then the tray is gone and the pet chomps.
  await expect(page.getByRole("group", { name: "Food" })).toBeHidden();
  await page.waitForTimeout(900);
}

test("the shelf fits the screen without scrolling sideways @smoke", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByTestId("hatch-new")).toBeVisible();
  await expect(page.getByRole("link", { name: /What's new/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("hatch, name, feed and dress a pet, and it survives a reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await hatch(page, "Pip");

  const fuelBefore = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].fuel
  );
  await feedOnce(page, "Log");
  const fuelAfter = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].fuel
  );
  expect(fuelAfter).toBeGreaterThan(fuelBefore);

  await page.getByRole("button", { name: "Wardrobe" }).click();
  await page.getByRole("button", { name: "Sky", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sky", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /Rose, locked/ })
  ).toBeDisabled();
  await page.getByRole("button", { name: "Done" }).click();

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  const card = page.getByTestId("pet-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Pip");
  const look = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].look.colour
  );
  expect(look).toBe("sky");
  expect(errors).toEqual([]);
});

test("a long gap makes an ember, and three feeds relight it", async ({
  page,
}) => {
  await open(page);
  await hatch(page, "Sparky");
  await page.getByRole("button", { name: "Back to the shelf" }).click();

  await page.evaluate((ms) => window.__flamelings!.skip(ms), 3 * DAY_MS);
  await expect(page.getByTestId("pet-card")).toHaveAccessibleName(/Ember/);
  await page.getByTestId("pet-card").click();
  await expect(page.getByTestId("ember-hint")).toBeVisible();

  for (let i = 0; i < 2; i++) {
    await feedOnce(page, "Twig");
    await expect(page.getByTestId("ember-hint")).toBeVisible();
  }
  await page.getByRole("button", { name: "Feed", exact: true }).click();
  await page.getByRole("button", { name: "Twig", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: /glowing again/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Yay!" }).click();
  await expect(page.getByTestId("ember-hint")).toBeHidden();
  await expect(page.getByTestId("pet")).toHaveAttribute("data-mood", /./);
});

test("a pet forgotten for a week goes to the Memory Grove", async ({
  page,
}) => {
  await open(page);
  await hatch(page, "Wisp");
  await page.getByRole("button", { name: "Back to the shelf" }).click();
  await page.evaluate((ms) => window.__flamelings!.skip(ms), 9 * DAY_MS);
  await expect(page.getByTestId("pet-card")).toHaveCount(0);
  await page.getByRole("button", { name: /Memory Grove/ }).click();
  await expect(page.getByText("Wisp")).toBeVisible();
});

test("the pet sleeps at night", async ({ page }) => {
  await open(page, 22);
  await hatch(page, "Moth");
  await expect(page.getByTestId("asleep-hint")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Feed", exact: true })
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Wardrobe" })).toBeEnabled();
});
