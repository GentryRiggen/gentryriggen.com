import { test, expect, type Page } from "@playwright/test";
import { FRIEND_CODE, mockFriends } from "./support/friendsMock";
import { FLAMELINGS_VERSION } from "../lib/flamelings/version";

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

test("the dock is a thumb-sized grid on a phone @smoke", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await hatch(page, "Pip");
  for (const label of [
    "Feed",
    "Play",
    "Wardrobe",
    "Shop",
    "Emotes",
    "Friends",
  ]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(64);
    expect(box!.height).toBeGreaterThanOrEqual(64);
  }
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth
  );
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("the care bar and the shop fit the screen @smoke", async ({ page }) => {
  await open(page);
  await hatch(page, "Pip");
  await page.evaluate(() => window.__flamelings!.patchPet(0, { sparks: 500 }));
  const width = page.viewportSize()!.width;
  for (const label of [
    "Feed",
    "Play",
    "Wardrobe",
    "Shop",
    "Emotes",
    "Friends",
  ]) {
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
  expect((await version.json()).version).toBe(FLAMELINGS_VERSION);
});

test("a level 9 pet grows up into the form its care earned", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await hatch(page, "Pip");
  // One tap short of level 10, with plenty of playing behind it.
  await page.evaluate(() => {
    const need = Math.round(40 * Math.pow(9, 1.4));
    window.__flamelings!.patchPet(0, {
      level: 9,
      xp: need - 1,
      care: { feeds: 4, cleans: 2, plays: 30, pets: 3, styles: 1 },
    });
  });
  await page.getByTestId("pet").click();
  await expect(page.getByRole("dialog", { name: "Level 10!" })).toBeVisible();
  await page.getByRole("button", { name: "Yay!" }).click();

  const moment = page.getByTestId("evolution");
  await expect(moment).toBeVisible();
  await expect(moment).toHaveAttribute("data-phase", "glow");
  await expect(moment).toHaveAttribute("data-phase", "reveal", {
    timeout: 6000,
  });
  await expect(page.getByTestId("evolution-name")).toContainText("Wild Blaze");
  await page.getByRole("button", { name: "Yay!" }).click();
  await expect(moment).toBeHidden();

  const pet = await page.evaluate(() => {
    const p = window.__flamelings!.state().save.pets[0];
    return { form: p.form, level: p.level };
  });
  expect(pet).toEqual({ form: "wild", level: 10 });
  await expect(page.getByTestId("pet").locator(".fl-pet")).toHaveAttribute(
    "data-form",
    "wild"
  );

  // The form is permanent and shows on the shelf after a reload.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  await expect(page.getByTestId("pet-card")).toContainText(
    "Lv 10 · Wild Blaze"
  );
  expect(errors).toEqual([]);
});

test("a pet already at Blaze gets its form when the game opens", async ({
  page,
}) => {
  await open(page);
  await hatch(page, "Pip");
  await page.evaluate(() => {
    window.__flamelings!.patchPet(0, { level: 12 });
    window.__flamelings!.skip(1000);
  });
  await expect(page.getByTestId("evolution")).toBeVisible();
  await expect(page.getByTestId("evolution-name")).toBeVisible({
    timeout: 6000,
  });
  await page.getByRole("button", { name: "Yay!" }).click();
  const form = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].form
  );
  expect(["cozy", "wild", "sparkly"]).toContain(form);
});

async function openPlayPicker(page: Page) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByTestId("play-picker")).toBeVisible();
}

const careOf = (page: Page) =>
  page.evaluate(() => {
    const p = window.__flamelings!.state().save.pets[0];
    return {
      plays: p.care.plays,
      rounds: p.sparkRounds.count,
      sparks: p.sparks,
    };
  });

test("Marshmallow Toast: five marshmallows, then joy, XP and sparks", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await hatch(page, "Pip");
  await page.evaluate(() => window.__flamelings!.tunePlay({ toast: 8 }));
  await openPlayPicker(page);
  await page.getByTestId("play-marshmallow").click();
  const hold = page.getByTestId("toast-hold");
  await expect(hold).toBeVisible();
  const box = (await hold.boundingBox())!;
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect(page.getByTestId("toast-result")).toBeVisible();
    if (i < 4) await expect(page.getByTestId("toast-result")).toBeHidden();
  }
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("toast-hold")).toBeHidden();
  const after = await careOf(page);
  expect(after.plays).toBe(1);
  expect(after.rounds).toBe(1);
  expect(after.sparks).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Log Stack: tap to stack a full tower, and it shares the spark cap", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await hatch(page, "Pip");
  // All three paying rounds of the other games are already used.
  await page.evaluate(() => {
    const window_ = "2026-11-17:am";
    window.__flamelings!.patchPet(0, {
      sparkRounds: { window: window_, count: 3 },
    });
  });
  await page.evaluate(() => window.__flamelings!.tunePlay({ logs: 0.001 }));
  await openPlayPicker(page);
  await expect(page.getByTestId("play-rounds-left")).toHaveAccessibleName(
    /No sparkly rounds left/
  );
  await page.getByTestId("play-logs").click();
  for (let i = 0; i < 11; i++) {
    await page.getByTestId("logs-drop").dispatchEvent("pointerdown");
    await expect(page.getByTestId("logs-score")).toHaveText(String(i + 2));
    await page.waitForTimeout(280);
  }
  await expect(page.getByText("Wow! A full tower!")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  const after = await careOf(page);
  // Joy and XP still count, sparks do not once the cap is used up.
  expect(after.plays).toBe(1);
  expect(after.rounds).toBe(3);
  expect(after.sparks).toBe(0);
  expect(errors).toEqual([]);
});

test("the play picker and each game fit the screen @smoke", async ({
  page,
}) => {
  await open(page);
  await hatch(page, "Pip");
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
  await openPlayPicker(page);
  for (const id of ["fireflies", "marshmallow", "logs"]) {
    const box = (await page.getByTestId(`play-${id}`).boundingBox())!;
    const { width, height } = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.height).toBeGreaterThanOrEqual(64);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 400);
  }
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByTestId("play-marshmallow").click();
  await expect(page.getByTestId("toast-hold")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("Log Stack fits the screen @smoke", async ({ page }) => {
  await open(page);
  await hatch(page, "Pip");
  await openPlayPicker(page);
  await page.getByTestId("play-logs").click();
  await expect(page.getByTestId("logs-drop")).toBeVisible();
  await expect(page.getByTestId("log-moving")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// ---- Friends (1.4): the network is mocked, rules are tested separately ----

async function typeCode(page: Page, code: string) {
  for (const ch of code) await page.getByTestId(`key-${ch}`).click();
}

test("add a friend by code, have a playdate, and get paid once", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const backend = await mockFriends(page);
  await open(page);
  await hatch(page, "Pip");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByTestId("my-code")).toBeVisible();
  const myCode = (await page.getByTestId("my-code").textContent()) ?? "";
  expect(myCode).toMatch(/^[A-Z0-9]{6}$/);
  expect(backend.myCode()).toBe(myCode);

  await page.getByTestId("add-friend-button").click();
  await typeCode(page, FRIEND_CODE);
  await expect(page.getByTestId("friend-preview")).toBeVisible();
  await page.getByTestId("confirm-friend").click();
  await expect(page.getByTestId("friend-card")).toHaveCount(1);

  const before = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].sparks
  );
  await page.getByTestId("playdate-button").click();
  await expect(page.getByTestId("playdate")).toHaveAttribute(
    "data-step",
    "highfive",
    { timeout: 6000 }
  );
  await page.getByTestId("highfive-mine").click();
  await page.getByTestId("highfive-friend").click();
  await page.getByTestId("share-marshmallow").click();
  await expect(page.getByTestId("playdate-done")).toBeVisible({
    timeout: 6000,
  });
  await page.getByRole("button", { name: "Yay!" }).click();

  const after = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].sparks
  );
  expect(after).toBe(before + 10);
  await expect(page.getByTestId("playdate-button")).toBeDisabled();
  expect(
    [...backend.docs.keys()].some((k) =>
      k.startsWith(`flPets/${FRIEND_CODE}/visits/${myCode}_`)
    )
  ).toBe(true);
  expect(errors).toEqual([]);

  // The friend list and code survive a reload.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__flamelings));
  const saved = await page.evaluate(
    () => window.__flamelings!.state().save.pets[0].online
  );
  expect(saved.code).toBe(myCode);
  expect(saved.friends.map((f: { code: string }) => f.code)).toEqual([
    FRIEND_CODE,
  ]);
});

test("a friend's visit shows a card when the game opens, then is gone", async ({
  page,
}) => {
  const backend = await mockFriends(page);
  await open(page);
  await hatch(page, "Pip");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByTestId("my-code")).toBeVisible();
  const myCode = (await page.getByTestId("my-code").textContent()) ?? "";
  await page.getByTestId("add-friend-button").click();
  await typeCode(page, FRIEND_CODE);
  await page.getByTestId("confirm-friend").click();
  await expect(page.getByTestId("friend-card")).toHaveCount(1);

  backend.putVisit(myCode, FRIEND_CODE);
  backend.putVisit(myCode, "PQRSTU");
  await page.reload();
  await expect(page.getByTestId("visited")).toBeVisible();
  await expect(page.getByTestId("visited")).toContainText("visited!");
  await page.getByRole("button", { name: "Yay!" }).click();
  await expect(page.getByTestId("visited")).toHaveCount(0);
  expect(
    [...backend.docs.keys()].filter((k) => k.includes("/visits/"))
  ).toEqual([]);
});

test("offline shows a calm cloud, and the rest of the game works", async ({
  page,
}) => {
  await mockFriends(page, { offline: true });
  await open(page);
  await hatch(page, "Pip");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByTestId("friends-offline")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.evaluate(() => window.__flamelings!.patchPet(0, { fuel: 30 }));
  await feedOnce(page, "Log");
});

test("the Friends screen and keypad fit the screen @smoke", async ({
  page,
}) => {
  await mockFriends(page);
  await open(page);
  await hatch(page, "Pip");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByTestId("my-code")).toBeVisible();
  await page.getByTestId("add-friend-button").click();
  await expect(page.getByTestId("key-A")).toBeVisible();
  if (process.env.HELP_SHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `${process.env.HELP_SHOTS}/keypad-${page.viewportSize()!.width}.png`,
    });
  }
  // QWERTY: Q sits left of W on the same row, and A is under Q.
  const q = (await page.getByTestId("key-Q").boundingBox())!;
  const w = (await page.getByTestId("key-W").boundingBox())!;
  const a = (await page.getByTestId("key-A").boundingBox())!;
  expect(w.x).toBeGreaterThan(q.x);
  expect(Math.abs(w.y - q.y)).toBeLessThan(2);
  expect(a.y).toBeGreaterThan(q.y);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const { width } = page.viewportSize()!;
  for (const key of ["key-A", "key-9", "key-delete"]) {
    await page.getByTestId(key).scrollIntoViewIfNeeded();
    const box = (await page.getByTestId(key).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.height).toBeGreaterThanOrEqual(48);
  }
});

test("the picture button makes a 1080 x 1350 PNG and saves it when there is no share sheet", async ({
  page,
}) => {
  // Desktop browsers may have a share sheet; the download path is under test.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  await open(page);
  await hatch(page, "Pip");
  await page.evaluate(() =>
    window.__flamelings!.patchPet(0, {
      level: 12,
      form: "cozy",
      worn: { hat: "wizard", face: "sunglasses", neck: "scarf" },
      look: { colour: "violet", shape: "puff", eyes: "sharp" },
    })
  );
  await page.getByRole("button", { name: "Wardrobe" }).click();
  await page.getByTestId("share-open").click();
  await expect(page.getByTestId("share-image")).toBeVisible();
  await expect(page.getByTestId("share-picture")).toContainText("For parents");

  const downloading = page.waitForEvent("download");
  await page.getByTestId("share-button").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("my-flameling.png");
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path);
  expect([...bytes.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1350);
  await expect(page.getByTestId("share-hold-hint")).toBeVisible();
});

test("tapping a gauge, the level or sparks explains it @smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await hatch(page, "Pip");
  await page.evaluate(() =>
    window.__flamelings!.patchPet(0, { ash: 2, fuel: 20, sparks: 57 })
  );

  await page.getByRole("button", { name: "What is tidy?" }).click();
  const card = page.getByRole("dialog", { name: "Tidy" });
  await expect(card).toBeVisible();
  await expect(card.getByTestId("help-now")).toContainText("2 ash puffs");
  if (process.env.HELP_SHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.HELP_SHOTS}/tidy.png` });
  }
  await card.getByRole("button", { name: "Got it" }).click();
  await expect(card).toBeHidden();

  await page.getByRole("button", { name: "What is fuel?" }).click();
  await expect(page.getByTestId("help-now")).toContainText("hungry");
  await page.getByTestId("help-action").click();
  await expect(page.getByRole("group", { name: "Food" })).toBeVisible();

  await page.getByRole("button", { name: /how levels work/ }).click();
  await expect(page.getByRole("dialog", { name: "Level 1" })).toBeVisible();
  if (process.env.HELP_SHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.HELP_SHOTS}/level.png` });
  }
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /open the Shop/ }).click();
  await expect(page.getByRole("dialog", { name: "Shop" })).toBeVisible();
  await page.getByRole("button", { name: "How do I get sparks?" }).click();
  await expect(page.getByRole("dialog", { name: "Sparks" })).toBeVisible();
  if (process.env.HELP_SHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.HELP_SHOTS}/sparks.png` });
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
