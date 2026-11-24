import { test, expect } from "@playwright/test";
import { CARPATHIA_WALK } from "@/lib/shipwreck/walk/carpathiaDecks";
import { insideBlocker, pointInPolygon } from "@/lib/shipwreck/walk/types";

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
        { timeout: 150_000, intervals: [100] }
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

test("no Walk button on the Edmund Fitzgerald (she has no walk map)", async ({
  page,
}) => {
  await page.goto("/shipwreck");
  await page.waitForFunction(() => Boolean(window.__shipwreck?.setShip));
  await page.getByTestId("shipwreck-ship-fitzgerald").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "fitzgerald"
  );
  // Once she has frames, the HUD is complete: still no Walk button. (Her
  // first frames are computed here: a busy machine draws few frames.)
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const h = window.__shipwreck!;
          h.pump!(100);
          return h.getState!().computedT;
        }),
      { timeout: 60_000 }
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("shipwreck-play")).toBeVisible();
  await expect(page.getByTestId("shipwreck-walk")).toHaveCount(0);
  // And the hook's walk does nothing on her.
  await page.evaluate(() => window.__shipwreck!.startWalk!());
  expect(
    await page.evaluate(() => window.__shipwreck!.getState!().camera)
  ).not.toBe("walk");
  expect(await page.evaluate(() => window.__shipwreck!.getWalk!())).toBeNull();
});

test("walk the HMHS Britannic's decks: the stick walks, then she lies down and the walker floats", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto("/shipwreck");
  await page.waitForFunction(() => Boolean(window.__shipwreck?.setShip));
  await page.getByTestId("shipwreck-ship-britannic").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "britannic"
  );

  // She has a walk map now: the Walk button is offered once she has frames.
  const walk = page.getByTestId("shipwreck-walk");
  await expect(walk).toBeVisible();
  await expect(walk).toBeEnabled({ timeout: 60_000 });
  await page.evaluate(() => window.__shipwreck!.pause!());
  await walk.click();
  const stick = page.getByTestId("shipwreck-walk-stick");
  await expect(stick).toBeVisible();
  expect(
    await page.evaluate(() => window.__shipwreck!.getState!().camera)
  ).toBe("walk");

  // Drag the stick up for a second: the walker moves along her boat deck.
  await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
  const w0 = await page.evaluate(() => window.__shipwreck!.getWalk!()!);
  expect(w0.phase).toBe("deck");
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
    .not.toBeCloseTo(w0.x, 1);
  expect(await page.evaluate(() => window.__shipwreck!.getWalk!()!.phase)).toBe(
    "deck"
  );

  // Late in the morning she lies on her side on the floor: the walker is
  // in the water, floating (as on the Titanic and the Lusitania).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const h = window.__shipwreck!;
          const end = performance.now() + 2000;
          while (!h.getState!().done && performance.now() < end) h.pump!(200);
          return h.getState!().done;
        }),
      { timeout: 200_000, intervals: [100] }
    )
    .toBe(true);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  await page.waitForFunction(
    () => window.__shipwreck!.getWalk!()?.phase === "water",
    null,
    { timeout: 20_000 }
  );
});

test("walk the Carpathia's decks: the stick walks, and she stays on deck", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/shipwreck");
  await page.waitForFunction(() => Boolean(window.__shipwreck?.setShip));
  await page.evaluate(() => window.__shipwreck!.setShip!("carpathia"));
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();

  // She has a walk map: the Walk button is offered once she has a frame.
  const walk = page.getByTestId("shipwreck-walk");
  await expect(walk).toBeVisible();
  await expect(walk).toBeEnabled({ timeout: 60_000 });
  await page.evaluate(() => window.__shipwreck!.pause!());
  await walk.click();
  const stick = page.getByTestId("shipwreck-walk-stick");
  await expect(stick).toBeVisible();
  expect(
    await page.evaluate(() => window.__shipwreck!.getState!().camera)
  ).toBe("walk");

  // Drag the stick up for a second: the walker moves along her boat deck.
  await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
  const w0 = await page.evaluate(() => window.__shipwreck!.getWalk!()!);
  expect(w0.phase).toBe("deck");
  const box = (await stick.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - box.height / 2, { steps: 4 });
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.getWalk!()!.x))
    .not.toBeCloseTo(w0.x, 1);

  // Keep running forward: her decks hold (the boat deck's front is a wall,
  // never the sea).
  await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
  const w1 = await page.evaluate(() => window.__shipwreck!.getWalk!()!);
  expect(w1.phase).toBe("deck");
  // On one of her walked decks (inside its outline, inside the rails) and
  // not inside a house, mast or fitting there.
  const at: [number, number] = [w1.x, w1.y];
  const onArea = CARPATHIA_WALK.areas.find((a) =>
    pointInPolygon(at, a.outline)
  );
  expect(onArea?.id).toBeDefined();
  expect(insideBlocker(CARPATHIA_WALK, onArea!.id, at, 0)).toBe(false);
});

test("ride a Titanic lifeboat: it lowers at once and rows away", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/shipwreck");
  await page.waitForFunction(() => Boolean(window.__shipwreck?.setShip));
  await page.evaluate(() => window.__shipwreck!.setShip!("titanic"));
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await page.evaluate(() => window.__shipwreck!.pause!());
  // Compute the night ahead (software WebGL draws few frames).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const h = window.__shipwreck!;
          const end = performance.now() + 2000;
          while (!h.getState!().done && performance.now() < end) h.pump!(200);
          return h.getState!().done;
        }),
      { timeout: 150_000, intervals: [100] }
    )
    .toBe(true);
  await page.evaluate(() => window.__shipwreck!.seek!(600));

  // The top bar's boat button: in the next boat, high on her boat deck.
  await page.getByTestId("shipwreck-ride-boat").click();
  await page.waitForFunction(
    () => window.__shipwreck!.getWalk!()?.phase === "boat",
    null,
    { timeout: 20_000 }
  );
  await expect(page.getByTestId("shipwreck-walk-stick")).toHaveCount(0);
  await page.waitForFunction(
    () => (window.__shipwreck!.getRenderInfo!()?.camera[1] ?? 0) > 10,
    null,
    { timeout: 20_000 }
  );

  // Seven minutes on: the boat is down on the sea and still ridden.
  await page.evaluate(() => window.__shipwreck!.seek!(1020));
  await page.waitForFunction(
    () => {
      const y = window.__shipwreck!.getRenderInfo!()?.camera[1] ?? 99;
      return y > 0 && y < 3;
    },
    null,
    { timeout: 20_000 }
  );
  expect(await page.evaluate(() => window.__shipwreck!.getWalk!()?.phase)).toBe(
    "boat"
  );

  // Back on deck: walking her deck again.
  await page.getByTestId("shipwreck-leave-boat").click();
  await page.waitForFunction(
    () => window.__shipwreck!.getWalk!()?.phase === "deck",
    null,
    { timeout: 20_000 }
  );

  // Walk to the starboard rail, then aft: beside boat 9's davit the
  // get-in button shows, and boards that boat.
  await page.evaluate(() => window.__shipwreck!.seek!(600));
  await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 1));
  await page.waitForFunction(
    () => (window.__shipwreck!.getWalk!()?.y ?? 0) < -13,
    null,
    { timeout: 30_000 }
  );
  await page.evaluate(() => window.__shipwreck!.setWalkInput!(-1, 0));
  const board = page.getByTestId("shipwreck-board-boat");
  await expect(board).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
  await board.click();
  await page.waitForFunction(
    () => window.__shipwreck!.getWalk!()?.phase === "boat",
    null,
    { timeout: 20_000 }
  );
});
