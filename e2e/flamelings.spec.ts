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

async function hatch(page: Page, name: string, quiet = true) {
  await page.getByTestId("hatch-new").click();
  for (let i = 0; i < 5; i++) await page.getByTestId("egg").click();
  await page.getByRole("button", { name: "Hello, little flame!" }).click();
  await page.getByLabel("Name your flameling").fill(name);
  await page.getByRole("button", { name: "Welcome home!" }).click();
  // A happening may have been picked by chance; most tests are not about it.
  if (quiet) {
    await page.evaluate(() => window.__flamelings!.quietHappenings());
  }
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

  // Pets hatch full, so let this one get peckish first.
  await page.evaluate(() => window.__flamelings!.patchPet(0, { fuel: 30 }));
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

test("earn sparks, buy a hat and a decoration, and keep them after a reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await hatch(page, "Pip");

  // Feeding a hungry pet pays 3 sparks, which fly into the counter.
  await page.evaluate(() => window.__flamelings!.patchPet(0, { fuel: 30 }));
  await feedOnce(page, "Log");
  await expect(page.getByTestId("sparks")).toHaveAttribute("data-value", "3");
  await expect(page.getByTestId("sparks")).toHaveAccessibleName("3 sparks");

  await page.evaluate(() => window.__flamelings!.patchPet(0, { sparks: 160 }));
  await page.getByRole("button", { name: "Shop", exact: true }).click();
  await page.getByRole("button", { name: /Buy Chef hat/ }).click();
  await expect(page.getByRole("dialog", { name: "You got it!" })).toBeVisible();
  await page.getByRole("button", { name: "Yay!" }).click();
  await page.getByRole("tab", { name: "Glade" }).click();
  await page.getByRole("button", { name: /Buy Potted plant/ }).click();
  await page.getByRole("button", { name: "Yay!" }).click();

  // Too dear: no purchase, and it says how many more sparks it needs.
  await page.getByRole("button", { name: /Tent, 280 sparks/ }).click();
  await expect(page.getByTestId("shop-short")).toContainText("230");

  const bought = await page.evaluate(() => {
    const pet = window.__flamelings!.state().save.pets[0];
    return { sparks: pet.sparks, worn: pet.worn.hat, decor: pet.decor };
  });
  expect(bought).toEqual({ sparks: 50, worn: "chef", decor: ["plant"] });

  // Owned decor can be put away and back out.
  await page.getByRole("button", { name: "Potted plant, on" }).click();
  await page.getByRole("button", { name: "Potted plant, off" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("fl-decor-plant")).toBeAttached();

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await page.getByTestId("pet-card").click();
  await expect(page.getByTestId("sparks")).toHaveAttribute("data-value", "50");
  await expect(page.getByTestId("fl-decor-plant")).toBeAttached();
  const kept = await page.evaluate(() => {
    const pet = window.__flamelings!.state().save.pets[0];
    return { hat: pet.worn.hat, owned: pet.unlocked.includes("decor:plant") };
  });
  expect(kept).toEqual({ hat: "chef", owned: true });
  expect(errors).toEqual([]);
});

/** Opens the game on the real clock (a reload keeps the same window). */
async function openReal(page: Page) {
  await page.goto("/flamelings");
  await page.waitForFunction(() => Boolean(window.__flamelings));
}

type Happening = { kind: string; variant: string; done: boolean } | null;

const happeningOf = (page: Page): Promise<Happening> =>
  page.evaluate(() => {
    const h = window.__flamelings!.state().save.pets[0].happening;
    return h && { kind: h.kind, variant: h.variant, done: h.done };
  });

async function dismissCards(page: Page) {
  const card = page.getByRole("button", { name: "Yay!" });
  while (await card.isVisible()) await card.click();
}

test("a visitor brings a present and a reload does not reroll or repeat it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openReal(page);
  await hatch(page, "Pip");
  const owned = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].unlocked.length
  );

  await page.evaluate(() =>
    window.__flamelings!.forceHappening("visitor", 0, "owl")
  );
  await expect(page.getByTestId("happening-intro")).toBeVisible();
  await page.getByTestId("happening-go").click();
  const visitor = page.getByTestId("happening-visitor");
  await expect(visitor).toBeVisible();

  // The same visitor is still waiting after a reload.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await expect(page.getByTestId("happening-bubble")).toBeVisible();
  await page.getByTestId("pet-card").click();
  await expect(page.getByTestId("happening-intro")).toBeHidden();
  await expect(visitor).toBeVisible();
  expect(await happeningOf(page)).toEqual({
    kind: "visitor",
    variant: "owl",
    done: false,
  });

  await visitor.click();
  await dismissCards(page);
  expect((await happeningOf(page))?.done).toBe(true);
  const gifts = await page.evaluate(() => {
    const pet = window.__flamelings!.state().save.pets[0];
    return { sparks: pet.sparks, unlocked: pet.unlocked.length };
  });
  expect(gifts.sparks >= 10 || gifts.unlocked > owned).toBe(true);

  // Once it is done it stays done.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await page.getByTestId("pet-card").click();
  await expect(page.getByTestId("happening-visitor")).toBeHidden();
  await expect(page.getByTestId("happening-bubble")).toBeHidden();
  expect((await happeningOf(page))?.done).toBe(true);
  expect(errors).toEqual([]);
});

test("digging up treasure takes five taps and pays out", async ({ page }) => {
  await openReal(page);
  await hatch(page, "Pip");
  const owned = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].unlocked.length
  );
  await page.evaluate(() => window.__flamelings!.forceHappening("treasure", 0));
  await page.getByTestId("happening-go").click();
  const spot = page.getByTestId("happening-treasure");
  for (let i = 1; i <= 4; i++) {
    await spot.click();
    await expect(spot).toHaveAttribute("data-taps", String(i));
  }
  expect((await happeningOf(page))?.done).toBe(false);
  await spot.click();
  await dismissCards(page);
  expect((await happeningOf(page))?.done).toBe(true);
  const rewarded = await page.evaluate((had) => {
    const pet = window.__flamelings!.state().save.pets[0];
    return pet.sparks >= 15 || pet.unlocked.length > had;
  }, owned);
  expect(rewarded).toBe(true);
});

test("the happening picked for a window is saved and survives a reload", async ({
  page,
}) => {
  await openReal(page);
  await hatch(page, "Pip", false);
  const before = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].happening
  );
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  const after = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].happening
  );
  expect(after).toEqual(before);
});

test("a happening fits the screen without scrolling sideways @smoke", async ({
  page,
}) => {
  await openReal(page);
  await hatch(page, "Pip");
  await page.evaluate(() =>
    window.__flamelings!.forceHappening("mushrooms", 0, "5")
  );
  await page.getByTestId("happening-go").click();
  await expect(page.getByTestId("mushroom")).toHaveCount(5);
  const width = page.viewportSize()!.width;
  for (const box of await page.getByTestId("mushroom").all()) {
    const rect = (await box.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the care bar and the shop fit the screen @smoke", async ({ page }) => {
  await open(page);
  await hatch(page, "Pip");
  await page.evaluate(() => window.__flamelings!.patchPet(0, { sparks: 500 }));
  const width = page.viewportSize()!.width;
  for (const label of ["Feed", "Play", "Wardrobe", "Shop", "Emotes", "Shelf"]) {
    const box = await page
      .getByRole("button", { name: label, exact: true })
      .boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
  await page.getByRole("button", { name: "Shop", exact: true }).click();
  await page.getByRole("button", { name: /Buy Bunny ears/ }).click();
  await expect(page.getByRole("dialog", { name: "You got it!" })).toBeVisible();
  await page.getByRole("button", { name: "Yay!" }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a long gap makes an ember, and three feeds relight it", async ({
  page,
}) => {
  await open(page);
  await hatch(page, "Sparky");
  await page.getByRole("button", { name: "Back to the shelf" }).click();

  await page.evaluate((ms) => window.__flamelings!.skip(ms), 4 * DAY_MS);
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

test("a second tab does not save over the first, and can take over", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  await open(first);
  await hatch(first, "Solo");

  const second = await context.newPage();
  await second.goto("/flamelings");
  await expect(second.getByTestId("tab-locked")).toBeVisible();
  await expect(second.getByTestId("hatch-new")).toBeHidden();

  await second.getByRole("button", { name: "Play here" }).click();
  await expect(second.getByTestId("pet-card")).toContainText("Solo");
  // The first tab notices and steps aside instead of fighting for the save.
  await expect(first.getByTestId("tab-locked")).toBeVisible({
    timeout: 10_000,
  });
  await context.close();
});

test("the home-screen files are served", async ({ page, request }) => {
  await page.goto("/flamelings");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/flamelings.webmanifest"
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/flamelings-icons/apple-touch-icon-v1.png"
  );
  expect(
    (await request.get("/flamelings-icons/apple-touch-icon-v1.png")).ok()
  ).toBe(true);
  const version = await request.get("/flamelings/version.json");
  expect((await version.json()).version).toBe("1.2.0");
});
