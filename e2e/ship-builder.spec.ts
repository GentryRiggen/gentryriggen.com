import { test, expect, type Page } from "@playwright/test";
import type { Anchor } from "@/lib/ship-builder/model/types";

async function openBuilder(page: Page, hash = "") {
  await page.goto(`/ship-builder${hash}`);
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
}

async function place(page: Page, partName: RegExp, anchor: Anchor) {
  const button = page.getByRole("button", { name: partName });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
  const result = await page.evaluate(
    (a) => window.__shipBuilderStore!.getState().placeAt(a),
    anchor
  );
  expect(result).toEqual({ ok: true });
}

async function partId(page: Page, index: number): Promise<string> {
  return page.evaluate(
    (i) => window.__shipBuilderStore!.getState().ship.parts[i].id,
    index
  );
}

async function buildBoatDeck(page: Page) {
  await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x: 0, z: 0 });
  await place(page, /Deck block 1×1/, { kind: "grid", level: 1, x: 0, z: 0 });
  const upper = await partId(page, 1);
  await place(page, /^Davit/, {
    kind: "attach",
    parentId: upper,
    pointId: "davit:0:0",
  });
  const davit = await partId(page, 2);
  await place(page, /^Lifeboat/, {
    kind: "attach",
    parentId: davit,
    pointId: "boat",
  });
  await place(page, /First-class cabins/, {
    kind: "grid",
    level: 0,
    x: 1,
    z: 0,
  });
}

async function expectBoatDeckStats(page: Page) {
  await expect(page.getByTestId("stat-people")).toHaveText("510");
  await expect(page.getByTestId("stat-seats")).toHaveText("65");
  await expect(page.getByTestId("stat-coverage")).toHaveText("13%");
}

test.describe("Ship Builder", () => {
  test("builds a boat deck and updates stats", async ({ page }) => {
    await openBuilder(page);
    await expect(page.getByTestId("stat-people")).toHaveText("480");
    await expect(page.getByTestId("stat-seats")).toHaveText("0");
    await buildBoatDeck(page);
    await expectBoatDeckStats(page);
  });

  test("share link reopens the same ship", async ({ page, browser }) => {
    await openBuilder(page);
    await buildBoatDeck(page);
    await page.getByRole("button", { name: "Share" }).click();
    const link = await page.getByLabel("Share link URL").inputValue();
    expect(link).toContain("/ship-builder#ship=");

    const context = await browser.newContext();
    const fresh = await context.newPage();
    await fresh.goto(link);
    await expect(
      fresh.getByRole("heading", { name: "Ship Builder" })
    ).toBeVisible();
    await expectBoatDeckStats(fresh);
    await expect(fresh).toHaveURL(/\/ship-builder$/);
    await context.close();
  });

  test("an invalid share link shows a notice", async ({ page }) => {
    await openBuilder(page, "#ship=not-a-ship");
    await expect(page.getByRole("status")).toHaveText(
      /Couldn't load that ship/
    );
    await expect(page.getByTestId("stat-people")).toHaveText("480");
  });

  test("autosaves and restores after reload", async ({ page }) => {
    await openBuilder(page);
    await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x: 3, z: 1 });
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("ship-builder:autosave"))
      )
      .toContain("deck-1x1");
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__shipBuilderStore!.getState().ship.parts.length
        )
      )
      .toBe(1);
  });

  test("undo with the keyboard and lengthen the hull", async ({ page }) => {
    await openBuilder(page);
    await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x: 0, z: 0 });
    await page.getByRole("heading", { name: "Ship Builder" }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+z");
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__shipBuilderStore!.getState().ship.parts.length
        )
      )
      .toBe(0);
    await page.getByRole("button", { name: "Lengthen hull" }).click();
    await expect(page.getByTestId("hull-length")).toHaveText("9 segments");
  });

  test("shows the rule reason for an invalid placement", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("button", { name: /Deck block 1×1/ }).click();
    await page.evaluate(() =>
      window
        .__shipBuilderStore!.getState()
        .hoverAt({ kind: "grid", level: 1, x: 5, z: 1 })
    );
    await expect(page.getByTestId("placement-reason")).toHaveText(
      "Needs a deck beneath every cell"
    );
  });

  test("Wider adds a column to the hull and raises the tonnage", async ({
    page,
  }) => {
    await openBuilder(page);
    const tonnage = async () =>
      Number(
        (await page.getByTestId("stat-tonnage").innerText()).replace(/\D/g, "")
      );
    await expect(page.getByTestId("beam-width")).toHaveText("4 wide");
    const before = await tonnage();
    await page.getByRole("button", { name: "Wider" }).click();
    await expect(page.getByTestId("beam-width")).toHaveText("5 wide");
    expect(await tonnage()).toBeGreaterThan(before);
  });

  test("a wing block beyond the hull edge counts in the stats", async ({
    page,
  }) => {
    await openBuilder(page);
    await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x: 5, z: 0 });
    await expect(page.getByTestId("stat-people")).toHaveText("480");
    await place(page, /First-class cabins/, {
      kind: "grid",
      level: 0,
      x: 5,
      z: -1,
    });
    await expect(page.getByTestId("stat-people")).toHaveText("510");
    expect(
      await page.evaluate(
        () => window.__shipBuilderStore!.getState().ship.parts.length
      )
    ).toBe(2);
  });

  test("holding a placed block deletes it", async ({
    browserName,
    playwright,
    baseURL,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebGL is only reliable in headless Chromium"
    );
    const browser = await playwright.chromium.launch({
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    });
    try {
      const page = await browser.newPage({
        baseURL,
        viewport: { width: 1280, height: 800 },
      });
      await openBuilder(page);
      await page.getByRole("button", { name: "Top view" }).click();
      // The top view looks at the middle of the hull, so a 2x2 patch of blocks
      // covers the canvas centre wherever the grid lines fall.
      for (const x of [11, 12]) {
        for (const z of [1, 2]) {
          await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x, z });
        }
      }
      const count = () =>
        page.evaluate(
          () => window.__shipBuilderStore!.getState().ship.parts.length
        );
      expect(await count()).toBe(4);

      const box = await page.getByTestId("ship-canvas").boundingBox();
      if (!box) throw new Error("canvas has no box");
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      // Move across the block first, as a real pointer would, so the scene has
      // a pointer position before the press.
      await page.mouse.move(centre.x - 3, centre.y - 3);
      await page.mouse.move(centre.x + 3, centre.y + 3, { steps: 5 });
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await expect.poll(count).toBe(3);
    } finally {
      await browser.close();
    }
  });

  test("paints a tapped block and Esc leaves paint mode", async ({
    browserName,
    playwright,
    baseURL,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebGL is only reliable in headless Chromium"
    );
    const browser = await playwright.chromium.launch({
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    });
    try {
      const page = await browser.newPage({
        baseURL,
        viewport: { width: 1280, height: 800 },
      });
      await openBuilder(page);
      await page.getByRole("button", { name: "Top view" }).click();
      // A 2x2 patch covers the canvas centre wherever the grid lines fall.
      for (const x of [11, 12]) {
        for (const z of [1, 2]) {
          await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x, z });
        }
      }
      await page.getByRole("button", { name: "Paint", exact: true }).click();
      await page.getByRole("button", { name: "Red", exact: true }).click();
      await expect(
        page.getByText("Painting · tap a part or the hull")
      ).toBeVisible();

      const box = await page.getByTestId("ship-canvas").boundingBox();
      if (!box) throw new Error("canvas has no box");
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      // Move across the block first, as a real pointer would, so the scene has
      // a pointer position before the press.
      await page.mouse.move(centre.x - 3, centre.y - 3);
      await page.mouse.move(centre.x + 3, centre.y + 3, { steps: 5 });
      await page.mouse.down();
      await page.mouse.up();

      const paintedColors = () =>
        page.evaluate(() =>
          window
            .__shipBuilderStore!.getState()
            .ship.parts.map((part) => part.color)
            .filter(Boolean)
        );
      await expect.poll(paintedColors).toEqual(["red"]);

      await page.keyboard.press("Escape");
      await expect
        .poll(() =>
          page.evaluate(() => window.__shipBuilderStore!.getState().tool.kind)
        )
        .toBe("none");
      await expect(
        page.getByRole("group", { name: "Paint colours" })
      ).toHaveCount(0);
    } finally {
      await browser.close();
    }
  });

  test("renders the 3D scene", async ({ browserName, playwright, baseURL }) => {
    test.skip(
      browserName !== "chromium",
      "WebGL is only reliable in headless Chromium"
    );
    // Headless Chromium has no GPU and no longer falls back to SwiftShader on
    // its own, so the default browser has no WebGL (the app correctly shows its
    // fallback). Launch a software-rendering Chromium just for this check.
    const browser = await playwright.chromium.launch({
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    });
    try {
      const page = await browser.newPage({ baseURL });
      await openBuilder(page);
      await expect(
        page.locator('[data-testid="ship-canvas"] canvas')
      ).toBeVisible();
    } finally {
      await browser.close();
    }
  });

  test("places a large funnel, a large lifeboat and a propeller", async ({
    page,
  }) => {
    await openBuilder(page);
    for (const [x, z] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x, z });
    }
    await place(page, /^Large funnel/, {
      kind: "attach",
      parentId: await partId(page, 0),
      pointId: "funnel-lg:0:0",
    });

    // Two adjacent edge blocks on level 1 carry the davits.
    for (const x of [3, 4]) {
      await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x, z: 0 });
      await place(page, /Deck block 1×1/, { kind: "grid", level: 1, x, z: 0 });
    }
    const davitIds: string[] = [];
    for (const x of [3, 4]) {
      const count = await page.evaluate(
        () => window.__shipBuilderStore!.getState().ship.parts.length
      );
      const upper = await page.evaluate(
        ([cellX]) =>
          window
            .__shipBuilderStore!.getState()
            .ship.parts.find(
              (p) =>
                p.anchor.kind === "grid" &&
                p.anchor.level === 1 &&
                p.anchor.x === cellX
            )!.id,
        [x]
      );
      await place(page, /^Davit/, {
        kind: "attach",
        parentId: upper,
        pointId: `davit:${x}:0`,
      });
      davitIds.push(await partId(page, count));
    }
    // The boat hangs from the forward davit of the pair.
    await place(page, /^Large lifeboat/, {
      kind: "attach",
      parentId: davitIds[0],
      pointId: "big-boat",
    });

    await page.getByRole("button", { name: "Below view" }).click();
    await place(page, /^Propeller/, {
      kind: "attach",
      parentId: "hull",
      pointId: "prop:0",
    });

    await expect
      .poll(async () =>
        Number(await page.getByTestId("stat-speed").innerText())
      )
      .toBeGreaterThan(0);
    await expect(page.getByText(/No propellers/)).toHaveCount(0);
  });

  test("searches parts with a typo and keeps the panel header visible", async ({
    page,
  }) => {
    await openBuilder(page);
    const parts = page.getByRole("complementary", { name: "Parts" });
    if (!(await parts.isVisible()))
      await page.getByRole("button", { name: "Parts", exact: true }).click();

    await page.getByRole("searchbox", { name: "Search parts" }).fill("funel");
    await expect(page.getByRole("button", { name: /^Funnel/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Mast/ })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Search parts" }).clear();
    await parts.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(
      page.getByRole("searchbox", { name: "Search parts" })
    ).toBeInViewport();
  });

  test("starts a cargo ship from the New ship dialog", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New ship" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Cargo ship/ }).click();
    await expect(dialog).toHaveCount(0);

    const ship = await page.evaluate(
      () => window.__shipBuilderStore!.getState().ship
    );
    expect(ship.kind).toBe("cargo");
    expect(ship.hull).toMatchObject({
      bow: "bulbous",
      stern: "transom",
      paint: { topsides: "navy", bottom: "red" },
    });
  });
  test("builds a cargo stack and shows its TEU", async ({ page }) => {
    await openBuilder(page);
    await page.evaluate(() =>
      window.__shipBuilderStore!.getState().newShip("cargo")
    );
    await expect(page.getByTestId("stat-cargo")).toHaveCount(0);

    await place(page, /^Hatch cover/, { kind: "grid", level: 0, x: 4, z: 1 });
    await place(page, /^Container/, { kind: "grid", level: 1, x: 4, z: 1 });
    await place(page, /^Container/, { kind: "grid", level: 2, x: 4, z: 1 });
    await expect(page.getByTestId("stat-cargo")).toHaveText("4");

    await place(page, /^Freefall lifeboat/, {
      kind: "attach",
      parentId: "hull",
      pointId: "freefall",
    });
    await expect(page.getByTestId("stat-seats")).toHaveText("40");
  });
});
