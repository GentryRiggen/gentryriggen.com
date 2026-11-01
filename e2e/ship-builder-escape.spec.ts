import { test, expect, type Page } from "@playwright/test";

/**
 * Escaping the sinking ship: board a lifeboat from the deck, go into the
 * water and get too cold, or swim to a boat and climb in. `trialSpeed` plays
 * the sinking faster, `trialSeconds: 0` holds it at the start while the
 * walker is planted (`walkSpawn`) at a boat's boarding spot, and
 * `escapeWarmthSeconds` makes the cold win in moments. The launches and the
 * swim to a boat use the `__shipBuilderLaunches` and `__shipBuilderSwimToBoat`
 * hooks (see useTestHook.ts).
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(150_000);

const LONG = { timeout: 90_000 };

async function openTitanic(page: Page) {
  await page.addInitScript(() => {
    window.__SHIP_BUILDER_TEST__ = { trialSpeed: 12 };
  });
  await page.goto("/ship-builder");
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
  await page.getByRole("button", { name: "New", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "New ship" });
  await picker.getByRole("button", { name: /Ocean liner/ }).click();
  await picker.getByRole("button", { name: /RMS Titanic/ }).click();
  await expect(picker).toHaveCount(0);
  await page.evaluate(() =>
    window.__shipBuilderStore!.getState().setBreakMode("never")
  );
}

/** Taps Walk and starts from the middle (or the planted spawn). */
async function startWalking(page: Page) {
  await page.getByRole("button", { name: "Walk", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Where do you want to start?" })
    .getByRole("button", { name: "Middle" })
    .click();
}

/** Walks from the middle, hits, and waits for the splash card. */
async function walkIntoTheWater(page: Page) {
  await startWalking(page);
  await page.getByRole("button", { name: "Hit with an iceberg" }).click();
  await expect(page.getByRole("dialog", { name: "Splash!" })).toBeVisible(LONG);
}

/**
 * How the escape ended, from the store. The result card's line for each
 * ending is unit-tested in SeaTrialResult's tests, so the trial is not
 * played out to the card here.
 */
async function lastEscapeEnding(page: Page) {
  return page.evaluate(
    () => window.__shipBuilderStore!.getState().lastEscape?.ending ?? null
  );
}

test.describe("Ship Builder escape", () => {
  test("board a lifeboat from the deck", async ({ page }) => {
    await openTitanic(page);
    // Hold the sinking at its start while the walker is planted at a boat.
    await page.evaluate(() => {
      window.__SHIP_BUILDER_TEST__!.trialSeconds = 0;
      window.__shipBuilderStore!.getState().startTrial("calm", 20);
    });
    await expect
      .poll(() =>
        page.evaluate(() => window.__shipBuilderLaunches?.().length ?? 0)
      )
      .toBeGreaterThan(0);
    const spawn = await page.evaluate(() => {
      const davit = window.__shipBuilderLaunches!().find(
        (l) => l.kind === "davit" && l.walkSpawn
      );
      return davit?.walkSpawn ?? null;
    });
    expect(spawn).not.toBeNull();
    await page.evaluate((at) => {
      window.__SHIP_BUILDER_TEST__!.walkSpawn = { ...at!, yaw: 0 };
    }, spawn);
    await startWalking(page);

    const board = page.getByTestId("escape-action");
    // The escape runner needs a frame or two: slow on a loaded software GL.
    await expect(board).toHaveText("Board", { timeout: 30_000 });
    await board.click();
    await expect
      .poll(() => page.evaluate(() => window.__shipBuilderEscape!().phase.kind))
      .toBe("in-boat");

    // Let her go: the card waits until the boat is lowered and rowed away.
    await page.evaluate(() => {
      delete window.__SHIP_BUILDER_TEST__!.trialSeconds;
    });
    await expect(
      page.getByRole("dialog", { name: "You're safe!" })
    ).toBeVisible(LONG);
    expect(await lastEscapeEnding(page)).toBe("deck");
  });

  test("swim until a fishing boat fishes you out", async ({ page }) => {
    await openTitanic(page);
    await walkIntoTheWater(page);
    // The card also closes itself after 4 s; on a loaded software renderer
    // that can beat the click, which is fine.
    await page
      .getByRole("button", { name: "Swim!" })
      .click({ timeout: 3_000 })
      .catch(() => undefined);
    await expect(page.getByRole("dialog", { name: "Splash!" })).toHaveCount(0);
    await expect(page.getByRole("meter", { name: "Warmth" })).toBeVisible();

    // Two seconds from warm to frozen.
    await page.evaluate(() => {
      window.__SHIP_BUILDER_TEST__!.escapeWarmthSeconds = 2;
    });
    // Swim steps run on the clamped frame clock: slow on software GL.
    await expect(
      page.getByRole("dialog", { name: "Brrr! Human ice cube!" })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("meter", { name: "Warmth" })).toHaveCount(0);
    expect(await lastEscapeEnding(page)).toBe("frozen");
  });

  test("swim to a boat and climb in", async ({ page }) => {
    await openTitanic(page);
    await walkIntoTheWater(page);

    // Put the swimmer beside a boat once one has rowed out and only bobs.
    await expect
      .poll(() => page.evaluate(() => window.__shipBuilderSwimToBoat!()), LONG)
      .toBe(true);
    const climbIn = page.getByTestId("escape-action");
    await expect(climbIn).toHaveText("Climb in", { timeout: 30_000 });
    // A boat in reach closes the splash card so Climb in is never hidden.
    await expect(page.getByRole("dialog", { name: "Splash!" })).toHaveCount(0);
    await climbIn.click();

    await expect(
      page.getByRole("dialog", { name: "Saved from the sea!" })
    ).toBeVisible();
    expect(await lastEscapeEnding(page)).toBe("swim");
  });
});
