import { test, expect, type Page } from "@playwright/test";
import { encodeGhost } from "@/lib/plane-builder/ghost/ghost";

// Software WebGL for Chromium (see plane-builder.spec.ts).
test.use({
  launchOptions: [
    async ({ browserName }, use) =>
      use(
        browserName === "chromium"
          ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
          : {}
      ),
    { scope: "worker" },
  ],
});

test.setTimeout(120_000);

async function open(page: Page) {
  await page.goto("/plane-builder");
  await expect(
    page.getByRole("heading", { name: "Plane Builder" })
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__planeBuilderStore));
}

async function dragLaunch(page: Page) {
  const overlay = page.getByTestId("launch-overlay");
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  if (!box) throw new Error("launch overlay has no box");
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x - 100, centre.y + 100, { steps: 5 });
  await page.mouse.move(centre.x - 200, centre.y + 200, { steps: 5 });
  await page.mouse.up();
}

/** A ghost that flew 40 m/s along the meadow for 60 seconds. */
const GHOST = encodeGhost(
  60,
  Array.from({ length: 601 }, (_, i) => ({
    x: i * 4,
    y: 12,
    z: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
  }))
);

test.describe("Plane Builder ghosts and the daily challenge", () => {
  test("races a ghost, and the toggle hides it", async ({ page }) => {
    await open(page);
    await page.evaluate((ghost) => {
      const store = window.__planeBuilderStore!.getState();
      store.hydrate({
        ...store.progress,
        bestTimes: { meadow: 60 },
        ghosts: { meadow: ghost },
      });
    }, GHOST);

    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await page.getByRole("button", { name: "Launch!" }).click();
    await dragLaunch(page);
    await expect(page.getByTestId("ghost-gap")).toContainText(
      /Ghost: \+\d+\.\ds (ahead|behind)/,
      { timeout: 30_000 }
    );
  });

  test("the toggle turns the readout off", async ({ page }) => {
    await open(page);
    await page.evaluate((ghost) => {
      const store = window.__planeBuilderStore!.getState();
      store.hydrate({
        ...store.progress,
        bestTimes: { meadow: 60 },
        ghosts: { meadow: ghost },
      });
    }, GHOST);
    const toggle = page.getByRole("button", { name: "Ghost plane" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await page.getByRole("button", { name: "Launch!" }).click();
    await dragLaunch(page);
    await expect(page.getByTestId("daily-twist")).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("ghost-gap")).toHaveCount(0);
  });

  test("flies the daily challenge with its twist on screen", async ({
    page,
  }) => {
    await open(page);
    const card = page.getByTestId("daily-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("daily-countdown")).toContainText(
      /New one in \d+:\d\d:\d\d/
    );
    await expect(page.getByTestId("daily-best")).toContainText("No time yet");

    await card.getByRole("button", { name: "Fly today's challenge" }).click();
    await expect(page.getByTestId("daily-banner")).toBeVisible();
    await page.getByRole("button", { name: "Launch!" }).click();
    await dragLaunch(page);
    await expect(page.getByTestId("daily-twist")).toContainText("Daily:", {
      timeout: 30_000,
    });
  });
});
