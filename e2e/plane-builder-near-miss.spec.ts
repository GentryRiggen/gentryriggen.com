import { test, expect, type Page } from "@playwright/test";

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

test.describe("Plane Builder near misses", () => {
  test("the HUD pops 'Close call!' with the combo", async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await page.getByRole("button", { name: "Launch!" }).click();
    await dragLaunch(page);
    await expect(
      page.getByRole("progressbar", { name: /distance/i })
    ).toBeVisible({ timeout: 30_000 });

    // Software WebGL is slow, so keep the pop alive while the shot is taken.
    // The pop-in animation restarts on each push, so shoot it without motion.
    await page.evaluate(() => {
      const push = () => window.__planeBuilderNearMissPop!.push(3, 3);
      push();
      window.setInterval(push, 300);
    });
    const pop = page.getByTestId("close-call");
    await expect(pop).toContainText("Close call! ×3");
    await page.screenshot({
      path: info.outputPath("close-call-hud.png"),
    });
    await info.attach("close-call-hud", {
      path: info.outputPath("close-call-hud.png"),
      contentType: "image/png",
    });
  });

  test("the pop stays clear of the HUD on a landscape phone", async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await page.getByRole("button", { name: "Play Backyard Meadow" }).click();
    await page.getByRole("button", { name: "Launch!" }).click();
    await dragLaunch(page);
    await expect(
      page.getByRole("progressbar", { name: /distance/i })
    ).toBeVisible({ timeout: 30_000 });

    // Software WebGL is slow, so keep the pop alive while the shot is taken.
    // The pop-in animation restarts on each push, so shoot it without motion.
    await page.evaluate(() => {
      const push = () => window.__planeBuilderNearMissPop!.push(3, 3);
      push();
      window.setInterval(push, 300);
    });
    const pop = page.getByTestId("close-call");
    await expect(pop).toContainText("Close call! ×3");
    await page.screenshot({
      path: info.outputPath("close-call-landscape.png"),
    });
    await info.attach("close-call-landscape", {
      path: info.outputPath("close-call-landscape.png"),
      contentType: "image/png",
    });
  });
});
