import {
  test,
  expect,
  type Browser,
  type BrowserType,
  type Page,
} from "@playwright/test";

/**
 * Iceberg flows (v2.6): the Below deck wall editor and the aim-then-strike
 * trial. Like the other trial specs these run in headless Chromium with
 * software WebGL. `trialSeconds` far past the longest trial jumps the sim
 * straight to its end, so even the ~30 s sinking shows its result at once.
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(90_000);

/** Past any iceberg trial (it ends by 90 s), so the sim jumps to its end. */
const FAST_FORWARD_SECONDS = 1000;

async function openBuilder(
  browser: Browser,
  baseURL: string | undefined
): Promise<Page> {
  const page = await browser.newPage({
    baseURL,
    viewport: { width: 1280, height: 800 },
  });
  // The script runs in the page, so the value is passed in, not closed over.
  await page.addInitScript((trialSeconds) => {
    window.__SHIP_BUILDER_TEST__ = { trialSeconds };
  }, FAST_FORWARD_SECONDS);
  await page.goto("/ship-builder");
  await expect(page.getByRole("heading", { name: "Ship Builder" })).toBeVisible(
    { timeout: 60_000 }
  );
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
  await expect(page.getByTestId("ship-canvas").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });
  return page;
}

function launch(playwright: { chromium: BrowserType }) {
  return playwright.chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
}

const wallSlot = (page: Page, at: number) =>
  page.getByTestId(`below-deck-slot-${at}`);

const compartments = (page: Page) => page.getByTestId("stat-compartments");

const trialStatus = (page: Page) =>
  page.evaluate(() => window.__shipBuilderStore!.getState().trial.status);

const wallCount = (page: Page) =>
  page.evaluate(
    () => window.__shipBuilderStore!.getState().ship.hull.bulkheads?.length ?? 0
  );

async function strikeMidships(page: Page) {
  await page.getByRole("button", { name: "Sea trial" }).click();
  await page.getByRole("menuitem", { name: "Iceberg" }).click();
  await expect(page.getByText("Tap where the iceberg hits")).toBeVisible();
  // In the side view the hull's side sits a little below the canvas middle.
  const box = await page.getByTestId("ship-canvas").boundingBox();
  if (!box) throw new Error("no canvas box");
  // The camera glides to the side view first, so a tap that lands before it
  // settles can miss the hull: tap again until the trial starts.
  await expect(async () => {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.58);
    expect(await trialStatus(page)).not.toBe("aiming");
  }).toPass({ timeout: 15_000 });
}

test.describe("Ship Builder iceberg", () => {
  test("tapping a wall slot steps low, waterline, deck; undo restores", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      const slot = wallSlot(page, 2);
      await expect(slot).toHaveAttribute("aria-label", /Wall 2: none/);
      await expect(compartments(page)).toContainText("1");

      await slot.click();
      await expect(slot).toHaveAttribute("aria-label", /Wall 2: low/);
      await expect(compartments(page)).toContainText("2");

      await slot.click();
      await expect(slot).toHaveAttribute(
        "aria-label",
        /Wall 2: up to the waterline/
      );
      await expect(compartments(page)).toContainText("2");

      await slot.click();
      await expect(slot).toHaveAttribute(
        "aria-label",
        /Wall 2: up to the deck/
      );

      // A fourth tap takes the wall away again.
      await slot.click();
      await expect(slot).toHaveAttribute("aria-label", /Wall 2: none/);
      await expect(compartments(page)).toContainText("1");

      // Undo walks back through the taps.
      await page.keyboard.press("Control+z");
      await expect(slot).toHaveAttribute(
        "aria-label",
        /Wall 2: up to the deck/
      );
      await page.keyboard.press("Control+z");
      await page.keyboard.press("Control+z");
      await page.keyboard.press("Control+z");
      await expect(slot).toHaveAttribute("aria-label", /Wall 2: none/);
      await expect(compartments(page)).toContainText("1");
      expect(await wallCount(page)).toBe(0);
    } finally {
      await browser.close();
    }
  });

  test("a well-walled ship stays afloat", async ({ playwright, baseURL }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      // The Titanic template has raised walls that hold a hit midships. (The
      // blank starter hull has one-segment rooms, so a gash opens too many.)
      await page.getByRole("button", { name: "New", exact: true }).click();
      const picker = page.getByRole("dialog", { name: "New ship" });
      await picker.getByRole("button", { name: /Ocean liner/ }).click();
      await picker.getByRole("button", { name: /RMS Titanic/ }).click();
      await expect(picker).toHaveCount(0);
      expect(await wallCount(page)).toBeGreaterThan(0);

      await strikeMidships(page);
      const card = page.getByRole("dialog");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(
        card.getByRole("heading", { name: "She stayed afloat!" })
      ).toBeVisible();
    } finally {
      await browser.close();
    }
  });

  test("a ship with no walls sinks and the tip points to Below deck", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      expect(await wallCount(page)).toBe(0);

      await strikeMidships(page);
      const card = page.getByRole("dialog");
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(
        card.getByRole("heading", { name: "She sank" })
      ).toBeVisible();
      await expect(card).toContainText("Below deck");
    } finally {
      await browser.close();
    }
  });

  test("Try another spot returns to aiming", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      await strikeMidships(page);
      const card = page.getByRole("dialog");
      await expect(card).toBeVisible({ timeout: 60_000 });
      await card.getByRole("button", { name: "Try another spot" }).click();

      await expect(card).toHaveCount(0);
      await expect(page.getByText("Tap where the iceberg hits")).toBeVisible();
      expect(await trialStatus(page)).toBe("aiming");
    } finally {
      await browser.close();
    }
  });

  test("Cancel and Esc return to building, and building works again", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      const hint = page.getByText("Tap where the iceberg hits");
      const seaTrial = page.getByRole("button", { name: "Sea trial" });

      await seaTrial.click();
      await page.getByRole("menuitem", { name: "Iceberg" }).click();
      await expect(hint).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(hint).toHaveCount(0);
      await expect(seaTrial).toBeFocused();
      expect(await trialStatus(page)).toBe("idle");

      await seaTrial.click();
      await page.getByRole("menuitem", { name: "Iceberg" }).click();
      await expect(hint).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(hint).toHaveCount(0);
      expect(await trialStatus(page)).toBe("idle");

      // Editing is live again: a wall tap lands.
      await wallSlot(page, 1).click();
      expect(await wallCount(page)).toBe(1);
    } finally {
      await browser.close();
    }
  });
});
