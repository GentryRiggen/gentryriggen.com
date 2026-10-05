import {
  test,
  expect,
  type Browser,
  type BrowserType,
  type Page,
} from "@playwright/test";

/**
 * Breakup (v2.8): the liner struck near the bow plunges, breaks in two and,
 * followed down, comes to rest on the sea floor. Like the other trial specs
 * this runs in headless Chromium with software WebGL. The test clock jumps
 * each leg of the trial straight to its end (`trialSeconds` past it), so the
 * whole flow takes a few seconds however slow the renderer is.
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(45_000);

/** Past any iceberg trial and its descent, so each leg jumps to its end. */
const FAST_FORWARD_SECONDS = 1000;

/** A moment early in the trial, long before she breaks. */
const EARLY_SECONDS = 5;

function launch(playwright: { chromium: BrowserType }) {
  return playwright.chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
}

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
    { timeout: 30_000 }
  );
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
  await expect(page.getByTestId("ship-canvas").locator("canvas")).toBeVisible({
    timeout: 20_000,
  });
  return page;
}

const trialStatus = (page: Page) =>
  page.evaluate(() => window.__shipBuilderStore!.getState().trial.status);

const impactX = (page: Page) =>
  page.evaluate(() => {
    const { trial } = window.__shipBuilderStore!.getState();
    return "input" in trial ? trial.input.iceberg?.impactX : undefined;
  });

async function loadTitanic(page: Page) {
  await page.getByRole("button", { name: "New", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "New ship" });
  await picker.getByRole("button", { name: /Ocean liner/ }).click();
  await picker.getByRole("button", { name: /RMS Titanic/ }).click();
  await expect(picker).toHaveCount(0);
}

/** Aims the iceberg and taps the hull near the bow (the right in side view). */
async function strikeNearTheBow(page: Page) {
  await page.getByRole("button", { name: "Sea trial" }).click();
  await page.getByRole("menuitem", { name: "Iceberg" }).click();
  await expect(page.getByText("Tap where the iceberg hits")).toBeVisible();
  const box = await page.getByTestId("ship-canvas").boundingBox();
  if (!box) throw new Error("no canvas box");
  // The camera glides to the side view first, so a tap that lands before it
  // settles can miss the hull: tap again until the trial starts.
  await expect(async () => {
    await page.mouse.click(box.x + box.width * 0.88, box.y + box.height * 0.58);
    expect(await trialStatus(page)).not.toBe("aiming");
  }).toPass({ timeout: 15_000 });
}

test.describe("Ship Builder breakup", () => {
  test("the liner breaks in two, is followed down and Watch again replays", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await openBuilder(browser, baseURL);
      const night = page.getByRole("button", { name: "Night" });
      await loadTitanic(page);
      await strikeNearTheBow(page);
      expect(await impactX(page)).toBeLessThan(15);

      // The trial jumps to where she sank and offers to follow her down
      // (the status bar first, then the result card).
      await expect(night).toHaveAttribute("aria-pressed", "true");
      await page
        .getByRole("button", { name: "Follow her down" })
        .first()
        .click({ timeout: 20_000 });

      const card = page.getByRole("dialog");
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(
        card.getByRole("heading", { name: "She sank" })
      ).toBeVisible();
      await expect(card).toContainText("broke in two");
      await expect(card).toContainText("sea floor");
      await expect(card.getByTestId("scrubber-mark-broke")).toHaveCount(1);
      await expect(
        card.getByTestId("scrubber-mark-touched-bottom")
      ).toHaveCount(1);
      await expect(
        card.getByRole("button", { name: "Follow her down" })
      ).toHaveCount(0);

      // Watch again plays it from the start; hold it early to see it running.
      await page.evaluate((seconds) => {
        window.__SHIP_BUILDER_TEST__!.trialSeconds = seconds;
      }, EARLY_SECONDS);
      await card.getByRole("button", { name: "Watch again" }).click();
      await expect(card).toHaveCount(0);
      expect(await trialStatus(page)).toBe("running");
      await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

      // Leaving puts the sky back as it was.
      await page.getByRole("button", { name: "Stop" }).click();
      expect(await trialStatus(page)).toBe("idle");
      await expect(night).toHaveAttribute("aria-pressed", "false");
    } finally {
      await browser.close();
    }
  });
});
