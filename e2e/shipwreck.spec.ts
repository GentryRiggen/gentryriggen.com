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
    // One read for every box: software WebGL makes each round trip to the
    // page wait behind a slow frame.
    const ids = [
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
    ];
    const boxes = await page.evaluate(
      (list) =>
        list.map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      ids
    );
    ids.forEach((id, i) => {
      const box = boxes[i];
      expect(box, id).not.toBeNull();
      expect(box!.x, id).toBeGreaterThanOrEqual(0);
      expect(box!.y, id).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, id).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height, id).toBeLessThanOrEqual(height);
    });
    // Main controls are big enough for small fingers.
    expect(boxes[ids.indexOf("shipwreck-play")]!.height).toBeGreaterThanOrEqual(
      64
    );
  });
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
  await computeAll(page);
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
  await computeAll(page);
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
  await computeAll(page);
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

/**
 * Computes the run ahead in big steps (software WebGL draws few frames, and
 * the game computes 6 ms a frame), until done.
 */
async function computeAll(page: import("@playwright/test").Page) {
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
}

test("the Edmund Fitzgerald's real storm reaches the end card at ×100, then the Lusitania's and the Titanic's scenes are back @smoke", async ({
  page,
}) => {
  test.setTimeout(540_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-fitzgerald").click();
  await expect(page.getByTestId("shipwreck-ship-fitzgerald")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await expect(page.getByTestId("shipwreck-parent-line")).toContainText(
    "Lake Superior"
  );
  expect(await page.evaluate(() => window.__shipwreck!.ship!())).toBe(
    "fitzgerald"
  );
  await expect(page.getByTestId("shipwreck-real-night")).toHaveText(
    /The real storm/
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "fitzgerald"
  );
  await expect(page.getByTestId("shipwreck-clock")).toContainText("PM");
  // Her storm: the storm sky, no iceberg and no coast.
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("storm-sky")))
    .toBe(true);
  for (const name of ["iceberg", "coast"])
    expect(
      await page.evaluate((n) => window.__shipwreck!.isShown!(n), name)
    ).toBe(false);

  // Played to the end at the top speed, on the free camera
  // (the cinematic one holds her big seas at ×1).
  await computeAll(page);
  // The last quarter hour of her run: hours of storm at ×100 is far more
  // frames than software WebGL draws in a test.
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT - 900);
  });
  await page.getByTestId("shipwreck-cameras-button").click();
  await page.getByTestId("shipwreck-camera-orbit").click();
  await page.getByTestId("shipwreck-speed-100").click();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().speed)).toBe(
    100
  );
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible({ timeout: 300_000 });
  await expect(end).toHaveAttribute("data-outcome", /sank|broke-in-two/);
  await expect(end).toContainText(/Edmund Fitzgerald sank at 7:\d\d PM/);
  await expect(end).toContainText("Whitefish Bay");
  // Her real run earns no "New ending found!" badge.
  await expect(page.getByTestId("shipwreck-new-ending")).toHaveCount(0);

  // Back to the title: the Lusitania's coast, then the Titanic's iceberg.
  await page.getByTestId("shipwreck-look").click();
  for (const ship of [
    { id: "lusitania", label: /The real afternoon/, shown: "coast" },
    { id: "titanic", label: /The real night/, shown: "iceberg" },
  ]) {
    await page.getByTestId("shipwreck-back").click();
    await expect(page.getByTestId("shipwreck-title")).toBeVisible();
    await page.getByTestId(`shipwreck-ship-${ship.id}`).click();
    await expect(page.getByTestId("shipwreck-real-night")).toHaveText(
      ship.label
    );
    await page.getByTestId("shipwreck-real-night").click();
    await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
    expect(
      await page.evaluate(() => window.__shipwreck!.getState!().ship)
    ).toBe(ship.id);
    await expect
      .poll(() =>
        page.evaluate((n) => window.__shipwreck!.isShown!(n), ship.shown)
      )
      .toBe(true);
    expect(
      await page.evaluate(() => window.__shipwreck!.isShown!("storm-sky"))
    ).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("What if? on the Edmund Fitzgerald with tight hatches, no damage and a calmer storm makes Whitefish Bay", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-fitzgerald").click();
  await page.getByTestId("shipwreck-what-if").click();
  const editor = page.getByTestId("shipwreck-editor");
  await expect(editor).toHaveAttribute("data-ship", "fitzgerald");
  await page.getByTestId("shipwreck-preset-clear").click();
  await expect(page.getByTestId("shipwreck-hole-count")).toHaveText(
    "No damage"
  );
  await page.getByTestId("shipwreck-storm-calmer").click();
  await expect(page.getByTestId("shipwreck-storm-calmer")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "floated");
  await expect(end).toContainText("She made it to Whitefish Bay.");
  await expect(end).toContainText("In a calmer storm");
  expect(await page.evaluate(() => window.__shipwreck!.getOutcome!())).toBe(
    "floated"
  );
  // The choice is remembered for next time.
  await page.getByTestId("shipwreck-try-what-if").click();
  await expect(page.getByTestId("shipwreck-hole-count")).toHaveText(
    "No damage"
  );
  await expect(page.getByTestId("shipwreck-storm-calmer")).toHaveAttribute(
    "aria-checked",
    "true"
  );
});

test("What if? on the Lusitania with two torpedoes runs to an end", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-lusitania").click();
  await page.getByTestId("shipwreck-what-if").click();
  await expect(page.getByTestId("shipwreck-editor")).toHaveAttribute(
    "data-ship",
    "lusitania"
  );
  await page.getByTestId("shipwreck-preset-clear").click();
  for (const id of ["br1", "br3"])
    await page.getByTestId(`shipwreck-chip-${id}`).click();
  await expect(page.getByTestId("shipwreck-hole-count")).toHaveText(
    "2 torpedoes"
  );
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute(
    "data-outcome",
    /sank|broke-in-two|floated/
  );
  expect(await page.evaluate(() => window.__shipwreck!.getOutcome!())).not.toBe(
    null
  );
});

test("the HMHS Britannic's real morning reaches the end card at ×100, then the Titanic's iceberg is back @smoke", async ({
  page,
}) => {
  test.setTimeout(540_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-britannic").click();
  await expect(page.getByTestId("shipwreck-ship-britannic")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  expect(await page.evaluate(() => window.__shipwreck!.ship!())).toBe(
    "britannic"
  );
  await expect(page.getByTestId("shipwreck-real-night")).toHaveText(
    /The real morning/
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "britannic"
  );
  await expect(page.getByTestId("shipwreck-clock")).toContainText("AM");
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("coast")))
    .toBe(true);
  expect(
    await page.evaluate(() => window.__shipwreck!.isShown!("iceberg"))
  ).toBe(false);
  // Her decks are walkable (1.6.0): the Walk button shows.
  await expect(page.getByTestId("shipwreck-walk")).toBeVisible();

  // The last quarter hour of her run at ×100 (a full hour is far more
  // frames than software WebGL draws in a test).
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT - 900);
  });
  await page.getByTestId("shipwreck-cameras-button").click();
  await page.getByTestId("shipwreck-camera-orbit").click();
  await page.getByTestId("shipwreck-speed-100").click();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().speed)).toBe(
    100
  );
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible({ timeout: 300_000 });
  await expect(end).toHaveAttribute("data-outcome", /sank|broke-in-two/);
  await expect(end).toContainText("HMHS Britannic sank at 9:06 AM");

  // Back to the title, the Titanic again: her iceberg, and no coast.
  await page.getByTestId("shipwreck-look").click();
  await page.getByTestId("shipwreck-back").click();
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.getByTestId("shipwreck-ship-titanic").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
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

test("What if? on the HMHS Britannic with portholes shut, doors closed and engines stopped keeps her afloat", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-britannic").click();
  await page.getByTestId("shipwreck-what-if").click();
  await expect(page.getByTestId("shipwreck-editor")).toHaveAttribute(
    "data-ship",
    "britannic"
  );
  await page.getByTestId("shipwreck-preset-real").click();
  for (const id of ["portholes", "doors", "engines"]) {
    const toggle = page.getByTestId(`whatif-${id}`);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  }
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "floated");
  await expect(end).toContainText("She stayed afloat.");
  expect(await page.evaluate(() => window.__shipwreck!.getOutcome!())).toBe(
    "floated"
  );
});

test("the title screen shows all four ships, tappable, at iPad mini portrait @smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 744, height: 1133 });
  await page.goto("/shipwreck");
  for (const id of ["titanic", "lusitania", "fitzgerald", "britannic"]) {
    const card = page.getByTestId(`shipwreck-ship-${id}`);
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(744);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(1133);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await card.click();
    await expect(card).toHaveAttribute("aria-checked", "true");
  }
  await page.screenshot({
    path: "test-results/britannic-title-portrait.png",
  });
});

test("the Carpathia's real morning reaches the end card at ×100 @smoke", async ({
  page,
}) => {
  test.setTimeout(540_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-carpathia").click();
  await expect(page.getByTestId("shipwreck-ship-carpathia")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  expect(await page.evaluate(() => window.__shipwreck!.ship!())).toBe(
    "carpathia"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "carpathia"
  );
  // Her morning: open sea, no coast, no iceberg, no storm sky.
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("day-sky")))
    .toBe(true);
  for (const name of ["coast", "iceberg", "storm-sky"])
    expect(
      await page.evaluate((n) => window.__shipwreck!.isShown!(n), name),
      name
    ).toBe(false);

  // Her runs start 40 s early (the wakes run in); played to the end.
  await page.getByTestId("shipwreck-speed-100").click();
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible({ timeout: 480_000 });
  await expect(end).toHaveAttribute("data-outcome", "sank");
  expect(errors).toEqual([]);
});

test("the Carpathia's paint tray swaps her livery without restarting the run", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-carpathia").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  // Let the run get going, then freeze it and read the clock.
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.getState!().t))
    .toBeGreaterThan(-39);
  await page.evaluate(() => window.__shipwreck!.pause!());
  const before = await page.evaluate(() => window.__shipwreck!.livery!());
  const brush = page.getByTestId("shipwreck-livery");
  await expect(brush).toBeVisible();
  await brush.click();
  await expect(page.getByTestId("shipwreck-paint-tray")).toBeVisible();
  // A fun paint (1.7): the tray stays open to compare.
  const next = "fun-blue-funnel";
  expect(next).not.toBe(before);
  const t0 = await page.evaluate(() => window.__shipwreck!.getState!().t);
  await page
    .locator(`[data-testid="shipwreck-paint"][data-livery="${next}"]`)
    .click();
  await expect(page.getByTestId("shipwreck-paint-tray")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.livery!()))
    .toBe(next);
  // Straight after the swap: no restart (the clock is where it was), still
  // paused, still on the night.
  const after = await page.evaluate(() => window.__shipwreck!.getState!());
  expect(after.t).toBeGreaterThanOrEqual(t0);
  expect(after.playing).toBe(false);
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "night"
  );
  // Then it keeps going.
  await page.evaluate(() => window.__shipwreck!.play!());
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.getState!().t))
    .toBeGreaterThan(t0);
});

test("switching Carpathia, Lusitania, Carpathia shows the right scenes each time", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-carpathia").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("day-sky")))
    .toBe(true);
  await page.evaluate(() => window.__shipwreck!.setShip!("lusitania"));
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "lusitania"
  );
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("coast")))
    .toBe(true);
  await page.evaluate(() => window.__shipwreck!.setShip!("carpathia"));
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "carpathia"
  );
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("day-sky")))
    .toBe(true);
  expect(await page.evaluate(() => window.__shipwreck!.isShown!("coast"))).toBe(
    false
  );
});

test("What if? on the Carpathia with one forward hole and no finisher floats to an end", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-carpathia").click();
  await page.getByTestId("shipwreck-what-if").click();
  await expect(page.getByTestId("shipwreck-editor")).toHaveAttribute(
    "data-ship",
    "carpathia"
  );
  await page.getByTestId("shipwreck-preset-clear").click();
  const hold1 = page.getByTestId("shipwreck-chip-hold1");
  await hold1.click();
  await expect(hold1).toHaveAttribute("aria-checked", "true");
  // The finishing torpedo is off (it is on in her real morning).
  const finisher = page.getByTestId("shipwreck-finisher");
  if ((await finisher.getAttribute("aria-checked")) === "true")
    await finisher.click();
  await expect(finisher).toHaveAttribute("aria-checked", "false");
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute("data-outcome", "floated");
  expect(await page.evaluate(() => window.__shipwreck!.getOutcome!())).toBe(
    "floated"
  );
});

test("the What if? Go button keeps its full size on screen at 1133x744", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-what-if").click();
  await expect(page.getByTestId("shipwreck-editor")).toBeVisible();
  const box = await page.getByTestId("shipwreck-go").boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.y + box!.height).toBeLessThanOrEqual(744);
});

test("the Costa Concordia's real night reaches her rest by the harbour at ×100, then the Titanic's iceberg is back @smoke", async ({
  page,
}) => {
  test.setTimeout(540_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-concordia").click();
  await expect(page.getByTestId("shipwreck-ship-concordia")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "concordia"
  );
  // Giglio's coast and harbour lights, no iceberg; her decks walkable (1.17).
  // (The island is built a little each frame, so no frame is blocked: in
  // software WebGL's few frames a second that takes a while.)
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("coast")), {
      timeout: 120_000,
    })
    .toBe(true);
  expect(
    await page.evaluate(() => window.__shipwreck!.isShown!("giglio-lights"))
  ).toBe(true);
  expect(
    await page.evaluate(() => window.__shipwreck!.isShown!("iceberg"))
  ).toBe(false);
  await expect(page.getByTestId("shipwreck-walk")).toBeVisible();

  // The last ten minutes of her run at ×100.
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT - 600);
  });
  await page.getByTestId("shipwreck-cameras-button").click();
  await page.getByTestId("shipwreck-camera-orbit").click();
  await page.getByTestId("shipwreck-speed-100").click();
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible({ timeout: 300_000 });
  await expect(end).toHaveAttribute("data-outcome", "aground");
  await expect(end).toContainText("She lies on her side by the harbour.");
  await expect(end).toContainText("12:41 AM");

  // Back to the title, the Titanic again: her iceberg, and no Giglio.
  await page.getByTestId("shipwreck-look").click();
  await page.getByTestId("shipwreck-back").click();
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.getByTestId("shipwreck-ship-titanic").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.isShown!("iceberg")))
    .toBe(true);
  expect(
    await page.evaluate(() => window.__shipwreck!.isShown!("giglio-lights"))
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("What if? on the Costa Concordia with only her fifth and sixth rooms open stays afloat", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-concordia").click();
  await page.getByTestId("shipwreck-what-if").click();
  await expect(page.getByTestId("shipwreck-editor")).toHaveAttribute(
    "data-ship",
    "concordia"
  );
  await page.getByTestId("shipwreck-preset-clear").click();
  for (const id of ["wtc5", "wtc6"])
    await page.getByTestId(`shipwreck-chip-${id}`).click();
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "floated");
  await expect(end).toContainText("She stayed afloat.");
});

test("What if? on the Costa Concordia blown out to sea sinks", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-concordia").click();
  await page.getByTestId("shipwreck-what-if").click();
  await page.getByTestId("shipwreck-preset-real").click();
  const toSea = page.getByTestId("whatif-to-sea");
  await toSea.click();
  await expect(toSea).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "sank");
  await expect(end).toContainText("Blown out to sea, she sank.");
});

test("the Costa Concordia's paint tray repaints her and puts her own colours back", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-concordia").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await page.evaluate(() => window.__shipwreck!.pause!());
  const hers = await page.evaluate(() => window.__shipwreck!.livery!());
  expect(hers).toBe("costa-2012");
  await page.getByTestId("shipwreck-livery").click();
  await expect(page.getByTestId("shipwreck-paint-tray")).toBeVisible();
  const paint = (id: string) =>
    page.locator(`[data-testid="shipwreck-paint"][data-livery="${id}"]`);
  await paint("fun-navy-hull").click();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.livery!()))
    .toBe("fun-navy-hull");
  await paint("costa-2012").click();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.livery!()))
    .toBe("costa-2012");
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "night"
  );
});

/** Starts a Poseidon What if? from the editor: spots chosen, then a wave. */
async function poseidonWhatIf(
  page: import("@playwright/test").Page,
  wave: "real" | "smaller" | "ahead",
  spots: "all" | "none"
) {
  await page.getByTestId("shipwreck-ship-poseidon").click();
  await page.getByTestId("shipwreck-what-if").click();
  await expect(page.getByTestId("shipwreck-editor")).toHaveAttribute(
    "data-ship",
    "poseidon"
  );
  await page
    .getByTestId(
      spots === "all" ? "shipwreck-preset-real" : "shipwreck-preset-clear"
    )
    .click();
  const chip = page.getByTestId(`whatif-wave-${wave}`);
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("shipwreck-go").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "poseidon"
  );
}

async function seekToEnd(page: import("@playwright/test").Page) {
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
}

test("the Poseidon's real night turns her keel up, then ends floated-then-sank at ×100, then the Fitzgerald and the Concordia are back @smoke", async ({
  page,
}) => {
  test.setTimeout(540_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-poseidon").click();
  await expect(page.getByTestId("shipwreck-ship-poseidon")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "poseidon"
  );
  // No Giglio, no iceberg; her deck is not walkable.
  expect(
    await page.evaluate(() => window.__shipwreck!.isShown!("giglio-lights"))
  ).toBe(false);
  await expect(page.getByTestId("shipwreck-walk")).toHaveCount(0);

  // Upright before the wave; keel up (|roll| > 150) after she capsizes.
  await computeAll(page);
  expect(
    Math.abs(await page.evaluate(() => window.__shipwreck!.getState!().listDeg))
  ).toBeLessThan(10);
  const upAt = await page.evaluate(
    () => window.__shipwreck!.getEvents!().find((e) => e.kind === "capsized")!.t
  );
  await page.evaluate((t) => window.__shipwreck!.seek!(t + 20), upAt);
  await expect
    .poll(() =>
      page.evaluate(() => Math.abs(window.__shipwreck!.getState!().listDeg))
    )
    .toBeGreaterThan(150);
  expect(
    await page.evaluate(() => window.__shipwreck!.getState!().eventsSeen)
  ).toContain("capsized");

  // The last ten minutes at ×100.
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT - 600);
  });
  await page.getByTestId("shipwreck-cameras-button").click();
  await page.getByTestId("shipwreck-camera-orbit").click();
  await page.getByTestId("shipwreck-speed-100").click();
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toBeVisible({ timeout: 300_000 });
  await expect(end).toHaveAttribute("data-outcome", "sank");
  await expect(end).toContainText(/Upside down, she floated for \d+ minutes/);
  await expect(end).toContainText(/then sank at 12:\d\d AM/);

  // The Fitzgerald, then the Concordia (Giglio only for her).
  await page.getByTestId("shipwreck-look").click();
  await page.getByTestId("shipwreck-back").click();
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.getByTestId("shipwreck-ship-fitzgerald").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "fitzgerald"
  );
  expect(
    await page.evaluate(() => window.__shipwreck!.isShown!("giglio-lights"))
  ).toBe(false);
  await page.getByTestId("shipwreck-back").click();
  await expect(page.getByTestId("shipwreck-title")).toBeVisible();
  await page.getByTestId("shipwreck-ship-concordia").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => window.__shipwreck!.isShown!("giglio-lights")),
      { timeout: 120_000 }
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test("What if? on the Poseidon's real wave with no spots open leaves her floating upside down", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await poseidonWhatIf(page, "real", "none");
  await seekToEnd(page);
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "capsized");
  await expect(end).toContainText("Upside down, she was still floating.");
  expect(
    Math.abs(await page.evaluate(() => window.__shipwreck!.getState!().listDeg))
  ).toBeGreaterThan(150);
});

test("What if? on the Poseidon's smaller wave leans her far over, then she stands up again", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await poseidonWhatIf(page, "smaller", "none");
  await seekToEnd(page);
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "floated");
  await expect(end).toContainText("She leaned far over, then stood up again.");
});

test("What if? on the Poseidon with the wave from ahead has her ride over it", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await poseidonWhatIf(page, "ahead", "none");
  await seekToEnd(page);
  const end = page.getByTestId("shipwreck-end");
  await expect(end).toHaveAttribute("data-outcome", "floated");
  await expect(end).toContainText("She rode over the wave.");
});

test("the Poseidon's paint tray repaints her and puts her own colours back", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1133, height: 744 });
  await page.goto("/shipwreck");
  await page.getByTestId("shipwreck-ship-poseidon").click();
  await page.getByTestId("shipwreck-real-night").click();
  await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
  await page.evaluate(() => window.__shipwreck!.pause!());
  expect(await page.evaluate(() => window.__shipwreck!.livery!())).toBe(
    "poseidon"
  );
  await page.getByTestId("shipwreck-livery").click();
  await expect(page.getByTestId("shipwreck-paint-tray")).toBeVisible();
  const paint = (id: string) =>
    page.locator(`[data-testid="shipwreck-paint"][data-livery="${id}"]`);
  await paint("fun-navy-hull").click();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.livery!()))
    .toBe("fun-navy-hull");
  await paint("poseidon").click();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.livery!()))
    .toBe("poseidon");
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "night"
  );
});

test("any ship in any wreck: the Lusitania in the Carpathia's torpedoes plays to the end card", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/shipwreck");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await page.getByTestId("shipwreck-ship-lusitania").click();
  await expect(
    page.getByTestId("shipwreck-wreck-real-lusitania")
  ).toBeVisible();
  await page.getByTestId("shipwreck-wreck-carpathia").click();
  await expect(page.getByTestId("shipwreck-wreck-carpathia")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await expect(page.getByTestId("shipwreck-real-night")).toHaveText("Play");
  // Kept after a reload.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-wreck-carpathia")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.getByTestId("shipwreck-real-night").click();
  await expect
    .poll(() => page.evaluate(() => window.__shipwreck!.getState!().wreck))
    .toBe("carpathia");
  expect(await page.evaluate(() => window.__shipwreck!.getState!().ship)).toBe(
    "lusitania"
  );
  await computeAll(page);
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.seek!(h.getState!().computedT);
  });
  await expect(page.getByTestId("shipwreck-end")).toBeVisible();
  await expect(page.getByTestId("shipwreck-end")).toHaveAttribute(
    "data-outcome",
    /^(sank|broke-in-two)$/
  );
  await expect(page.getByTestId("shipwreck-end")).toContainText(
    "Lusitania sank"
  );
  // Picking a ship again goes back to her own wreck.
  await page.evaluate(() => window.__shipwreck!.setShip!("titanic"));
  await expect(page.getByTestId("shipwreck-wreck-titanic")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  expect(errors).toEqual([]);
});
