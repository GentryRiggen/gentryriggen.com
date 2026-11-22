import { test, expect } from "@playwright/test";

/** 2:18 AM on the Titanic: 2 h 38 min of real time after 11:40 PM. */
const TWO_EIGHTEEN_S = 2 * 3600 + 38 * 60;

test(
  "walk the Titanic's deck: the stick walks, the water, Look under, Fly",
  { tag: "@smoke" },
  async ({ page }) => {
    // The whole night is computed before 2:18 AM (slow in software WebGL).
    test.setTimeout(180_000);
    await page.goto("/shipwreck");
    await page.waitForFunction(() => Boolean(window.__shipwreck?.setShip));
    await page.evaluate(() => window.__shipwreck!.setShip!("titanic"));
    await page.getByTestId("shipwreck-real-night").click();
    await expect(page.getByTestId("shipwreck-hud")).toBeVisible();

    // The Walk button is offered on the Titanic, and works once she has a
    // frame.
    const walk = page.getByTestId("shipwreck-walk");
    await expect(walk).toBeVisible();
    await expect(walk).toBeEnabled({ timeout: 60_000 });
    await page.evaluate(() => window.__shipwreck!.pause!());
    await walk.click();

    // The stick shows; the rail buttons (X-ray, places, cameras) are gone.
    const stick = page.getByTestId("shipwreck-walk-stick");
    await expect(stick).toBeVisible();
    for (const id of [
      "shipwreck-xray",
      "shipwreck-places-button",
      "shipwreck-cameras-button",
    ])
      await expect(page.getByTestId(id), id).toHaveCount(0);
    expect(
      await page.evaluate(() => window.__shipwreck!.getState!().camera)
    ).toBe("walk");

    // Drag the stick up for a second: the walker moves along the deck.
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    const x0 = await page.evaluate(() => window.__shipwreck!.getWalk!()!.x);
    const box = (await stick.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - box.height / 2, { steps: 4 });
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => window.__shipwreck!.getWalk!()!.x))
      .not.toBeCloseTo(x0, 1);

    // 2:18 AM: she is going under; the walker is in the water soon. The
    // game computes the night 6 ms a frame and software WebGL draws few
    // frames, so compute it here in bigger steps.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const h = window.__shipwreck!;
            const end = performance.now() + 2000;
            while (!h.getState!().done && performance.now() < end) h.pump!(200);
            return h.getState!().done;
          }),
        { timeout: 300_000, intervals: [100] }
      )
      .toBe(true);
    // The clock reads real time, which runs ahead of `t` once both halves
    // are under: find the `t` that shows 2:18 AM.
    await page.evaluate((real) => {
      const h = window.__shipwreck!;
      let lo = 0;
      let hi = h.getState!().computedT;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        h.seek!(mid);
        if (h.getState!().realT < real) lo = mid;
        else hi = mid;
      }
      h.seek!(hi);
    }, TWO_EIGHTEEN_S);
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.phase === "water",
      null,
      { timeout: 20_000 }
    );

    // Look under: the eyes go under the surface.
    await page.getByRole("button", { name: "Look under the water" }).click();
    await page.waitForFunction(
      () => (window.__shipwreck!.getRenderInfo!()?.camera[1] ?? 0) < 0,
      null,
      { timeout: 10_000 }
    );

    // Fly: back to the free camera.
    await page.getByRole("button", { name: "Fly" }).click();
    await expect
      .poll(() => page.evaluate(() => window.__shipwreck!.getState!().camera))
      .toBe("orbit");
    await expect(stick).toHaveCount(0);
  }
);

// The Walk button is absent on the Edmund Fitzgerald (no walk map): added
// when this branch is rebased on her 1.2.0.
