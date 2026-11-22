import { test, expect } from "@playwright/test";

test("the title screen loads with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/shipwreck");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toHaveText("Shipwreck");
  await expect(page.getByText(/More than 1,500 people died/)).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "title"
  );
  const link = page.getByRole("link", { name: /What's new/ });
  await expect(link).toHaveAttribute("href", "/shipwreck/versions");
  expect(errors).toEqual([]);
});

test("the versions page lists the releases", async ({ page }) => {
  await page.goto("/shipwreck/versions");
  await expect(
    page.getByRole("heading", { name: "The Lusitania" })
  ).toBeVisible();
  await expect(page.getByText("The Titanic's last night")).toBeVisible();
});

for (const [width, height] of [
  [744, 1133],
  [1133, 744],
  [390, 844],
]) {
  test(`the title screen fits ${width}x${height} without scrolling sideways @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/shipwreck");
    await expect(page.getByTestId("shipwreck-title")).toBeVisible();
    await expect(page.getByTestId("shipwreck-real-night")).toBeVisible();
    await expect(page.getByTestId("shipwreck-what-if")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`the night's HUD fits ${width}x${height} with every control on screen @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/shipwreck");
    await page.getByTestId("shipwreck-real-night").click();
    await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
    // Open the side panels too: the HUD at its fullest.
    await page.getByTestId("shipwreck-cameras-button").click();
    await expect(page.getByTestId("shipwreck-cameras")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    for (const id of [
      "shipwreck-back",
      "shipwreck-clock",
      "shipwreck-help-button",
      "shipwreck-play",
      "shipwreck-speed-1",
      "shipwreck-speed-100",
      "shipwreck-timeline",
      "shipwreck-xray",
      "shipwreck-places-button",
      "shipwreck-cameras-button",
      "shipwreck-camera-cinematic",
      "shipwreck-panel-button",
    ]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box!.x, id).toBeGreaterThanOrEqual(0);
      expect(box!.y, id).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, id).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height, id).toBeLessThanOrEqual(height);
    }
    // Main controls are big enough for small fingers.
    const play = await page.getByTestId("shipwreck-play").boundingBox();
    expect(play!.height).toBeGreaterThanOrEqual(64);
  });
}

/** Waits for the run to finish computing (the sim runs in the frame loop). */
async function waitDone(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => window.__shipwreck?.getState?.().done === true,
    null,
    { timeout: 240_000 }
  );
}

test("the real night plays to the end card", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "night"
  );
  await expect(page.getByTestId("shipwreck-caption")).toContainText("11:40 PM");
  await waitDone(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute("data-outcome", "broke-in-two");
  // The sim's own sinking time, not a fixed one.
  const sankAt = await page.evaluate(() => {
    const e = window.__shipwreck!.getEvents!().find(
      (x) => x.kind === "stern-under"
    )!;
    const s = (23 * 3600 + 40 * 60 + Math.floor(e.realT)) % 86400;
    const h = Math.floor(s / 3600) % 12 || 12;
    return `${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} AM`;
  });
  await expect(end).toContainText(`Titanic sank at ${sankAt}`);
  await expect(end).toContainText("Carpathia");
  await expect(page.getByTestId("shipwreck-new-ending")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "end"
  );
  expect(await page.evaluate(() => window.__shipwreck!.getOutcome!())).toBe(
    "broke-in-two"
  );
  // Look at the wreck: back to the HUD on the free camera.
  await page.getByTestId("shipwreck-look").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(
    await page.evaluate(() => window.__shipwreck!.getState!().camera)
  ).toBe("orbit");
  expect(errors).toEqual([]);
});

test("What if? with the first four compartments open stays afloat", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-what-if").click();
  await expect(page.getByTestId("shipwreck-editor")).toBeVisible();
  await page.getByTestId("shipwreck-preset-clear").click();
  await expect(page.getByTestId("shipwreck-go")).toBeDisabled();
  for (const id of ["fore-peak", "hold1", "hold2", "hold3"])
    await page.getByTestId(`shipwreck-chip-${id}`).click();
  await expect(page.getByTestId("shipwreck-hole-count")).toHaveText("4 holes");
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await waitDone(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "floated");
  await expect(end).toContainText("With 4 holes, her bulkheads held");
  // The choice is remembered for next time.
  await page.getByTestId("shipwreck-try-what-if").click();
  await expect(page.getByTestId("shipwreck-hole-count")).toHaveText("4 holes");
});

test("the HUD's X-ray, place, camera and help buttons work", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-real-night").click();
  await page.waitForFunction(
    () => (window.__shipwreck?.getState?.().computedT ?? 0) > 4500,
    null,
    { timeout: 180_000 }
  );
  const state = () => page.evaluate(() => window.__shipwreck!.getState!());
  await page.getByTestId("shipwreck-play").click();
  expect((await state()).playing).toBe(false);
  await page.getByTestId("shipwreck-speed-100").click();
  expect((await state()).speed).toBe(100);

  await page.getByTestId("shipwreck-xray").click();
  expect((await state()).xray).toBe(true);
  await page.getByTestId("shipwreck-xray").click();
  expect((await state()).xray).toBe(false);

  await page.getByTestId("shipwreck-places-button").click();
  await page.getByTestId("shipwreck-place-boiler-room-6").click();
  let s = await state();
  expect(s.place).toBe("boiler-room-6");
  expect(s.xray).toBe(true);

  await page.getByTestId("shipwreck-cameras-button").click();
  await page.getByTestId("shipwreck-camera-lifeboat").click();
  s = await state();
  expect(s.camera).toBe("lifeboat");
  expect(s.place).toBeNull();

  // A timeline icon jumps to its event.
  await page.getByTestId("shipwreck-mark-boat").click();
  const firstBoat = await page.evaluate(
    () =>
      window.__shipwreck!.getEvents!().find((e) => e.kind === "boat-lowered")!.t
  );
  expect((await state()).t).toBeCloseTo(firstBoat, 0);

  // A stat chip explains itself (the water panel starts closed).
  await page.getByTestId("shipwreck-panel-button").click();
  await page.getByTestId("shipwreck-stat-bow").click();
  await expect(page.getByTestId("shipwreck-help")).toContainText("about 15°");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByTestId("shipwreck-help-button").click();
  await expect(page.getByTestId("shipwreck-help")).toContainText(
    "How to watch"
  );
});

for (const ship of [
  { id: "titanic", name: "Titanic", query: "", breakX: -27.1 },
  { id: "lusitania", name: "Lusitania", query: "&ship=lusitania", breakX: 4 },
]) {
  test(`the model viewer draws the ${ship.name} within its budget`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.setViewportSize({ width: 1133, height: 744 });
    await page.goto(`/shipwreck?model${ship.query}`);
    const ready = () =>
      page.waitForFunction(
        () => window.__shipwreck?.getModelInfo?.()?.ready === true,
        null,
        { timeout: 180_000 }
      );
    await ready();
    expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
      "model"
    );
    // Whole, then broken in two: draw calls and triangles at the top tier.
    for (const breakX of [null, ship.breakX]) {
      await page.evaluate(
        (b) =>
          window.__shipwreck!.setModelView!({
            breakX: b,
            camera: "side",
            quality: "high",
          }),
        breakX
      );
      await ready();
      const info = await page.evaluate(() =>
        window.__shipwreck!.getModelInfo!()
      );
      expect(info!.calls).toBeGreaterThan(10);
      expect(info!.calls).toBeLessThanOrEqual(90);
      expect(info!.modelTriangles).toBeLessThanOrEqual(300_000);
      expect(info!.ship).toBe(ship.id);
    }
    expect(errors).toEqual([]);
  });
}

test("the night scene plays the real night to the break and the wreck", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck?scene&quality=medium");
  await page.waitForFunction(
    () => window.__shipwreck?.getState?.().done === true,
    null,
    { timeout: 240_000 }
  );
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "scene"
  );
  // Seek to the break (from the sim's own event), X-ray on, then the wreck.
  const breakT = await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.pause!();
    const e = h.getEvents!().find((x) => x.kind === "breakup");
    h.seek!(e!.t + 2);
    h.setCamera!("cinematic");
    return e!.t;
  });
  await page.waitForTimeout(1500);
  let state = await page.evaluate(() => window.__shipwreck!.getState!());
  expect(state.t).toBeCloseTo(breakT + 2, 0);
  expect(state.phase).toBe("breakup");
  expect(state.eventsSeen).toContain("breakup");
  await page.evaluate(() => window.__shipwreck!.setXray!(true));
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => window.__shipwreck!.getRenderInfo!());
  expect(info!.calls).toBeGreaterThan(10);
  expect(info!.calls).toBeLessThanOrEqual(160);
  expect(info!.triangles).toBeLessThanOrEqual(450_000);

  // A place pin flies there and reports the water.
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(3 * 3600 - 20 * 60); // 1:20 AM
    h.flyToPlace!("boiler-room-6");
  });
  await page.waitForTimeout(1500);
  state = await page.evaluate(() => window.__shipwreck!.getState!());
  expect(state.place).toBe("boiler-room-6");
  expect(state.xray).toBe(true);
  expect(state.camera).toBe("orbit");

  // Double-tap the ship on the free camera to fly in close.
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.flyToPlace!(null);
    h.setXray!(false);
    h.flyToView!([0, 0, 15], [60, -260, 60], true);
  });
  await page.waitForTimeout(1200);
  const camAt = async () =>
    (await page.evaluate(() => window.__shipwreck!.getRenderInfo!()))!.camera;
  const before = await camAt();
  await page.mouse.dblclick(566, 372);
  await page.waitForTimeout(3000);
  const after = await camAt();
  // It flew in: the camera moved a long way toward the ship.
  expect(Math.hypot(...after.map((v, i) => v - before[i]))).toBeGreaterThan(
    100
  );

  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
    h.setCamera!("underwater");
  });
  await page.waitForTimeout(1000);
  state = await page.evaluate(() => window.__shipwreck!.getState!());
  expect(state.phase).toBe("wreck");
  expect(errors).toEqual([]);
});

test("the Lusitania's real afternoon reaches the end card at ×100, then the Titanic's iceberg is back @smoke", async ({
  page,
}) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-lusitania").click();
  await expect(page.getByTestId("shipwreck-ship-lusitania")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await expect(page.getByTestId("shipwreck-parent-line")).toContainText(
    "1,190"
  );
  expect(await page.evaluate(() => window.__shipwreck!.ship!())).toBe(
    "lusitania"
  );
  await expect(page.getByTestId("shipwreck-real-night")).toHaveText(
    /The real afternoon/
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "lusitania"
  );
  await expect(page.getByTestId("shipwreck-clock")).toContainText("PM");
  // Her afternoon: the Irish coast, no iceberg.
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("coast")))
    .toBe(true);
  expect(
    await page.evaluate(() => window.__shipwreck!.isShown!("iceberg"))
  ).toBe(false);

  // Played (not seeked) to the end at ×100.
  await page.getByTestId("shipwreck-speed-100").click();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().speed)).toBe(
    100
  );
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible({ timeout: 360_000 });
  await expect(end).toHaveAttribute("data-outcome", "sank");
  await expect(end).toContainText(/Lusitania sank at 2:\d\d PM/);
  await expect(end).toContainText("18 minutes after the torpedo");
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "end"
  );

  // Back to the title, the Titanic again: her iceberg, and no coast.
  await page.getByTestId("shipwreck-look").click();
  await page.getByTestId("shipwreck-back").click();
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.getByTestId("shipwreck-ship-titanic").click();
  await expect(page.getByTestId("shipwreck-real-night")).toHaveText(
    /The real night/
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await expect(page.getByTestId("shipwreck-caption")).toContainText("11:40 PM");
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "titanic"
  );
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("iceberg")))
    .toBe(true);
  expect(await page.evaluate(() => window.__shipwreck!.isShown!("coast"))).toBe(
    false
  );
  expect(errors).toEqual([]);
});

test("What if? on the Lusitania with her portholes shut runs to an end", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-lusitania").click();
  await page.getByTestId("shipwreck-what-if").click();
  const editor = page.getByTestId("shipwreck-editor");
  await expect(editor).toHaveAttribute("data-ship", "lusitania");
  await page.getByTestId("shipwreck-preset-real").click();
  const portholes = page.getByTestId("shipwreck-portholes");
  await expect(portholes).toHaveAttribute("aria-pressed", "true");
  await portholes.click();
  await expect(portholes).toHaveAttribute("aria-pressed", "false");
  await expect(portholes).toHaveText(/Portholes shut/);
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await waitDone(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "floated");
  await expect(end).toContainText("With her portholes shut");
  expect(await page.evaluate(() => window.__shipwreck!.getOutcome!())).toBe(
    "floated"
  );
  // The choice is remembered for next time.
  await page.getByTestId("shipwreck-try-what-if").click();
  await expect(page.getByTestId("shipwreck-portholes")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
});
