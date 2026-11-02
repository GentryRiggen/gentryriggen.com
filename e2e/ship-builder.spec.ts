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
  test(
    "builds a boat deck and updates stats",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      await expect(page.getByTestId("stat-people")).toHaveText("480");
      await expect(page.getByTestId("stat-seats")).toHaveText("0");
      await buildBoatDeck(page);
      await expectBoatDeckStats(page);
    }
  );

  test(
    "share link reopens the same ship",
    { tag: "@smoke" },
    async ({ page, browser }) => {
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
    }
  );

  test(
    "autosaves and restores after reload",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      await place(page, /Deck block 1×1/, {
        kind: "grid",
        level: 0,
        x: 3,
        z: 1,
      });
      // The autosave waits 500 ms, but with WebGL on (locally) the 3D scene
      // can hold the main thread for seconds while it starts up.
      await expect
        .poll(
          () =>
            page.evaluate(() => localStorage.getItem("ship-builder:autosave")),
          { timeout: 15_000 }
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
    }
  );

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

  test(
    "loads the Titanic template from the New ship dialog",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      await page.getByRole("button", { name: "New", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "New ship" });
      await dialog.getByRole("button", { name: /Ocean liner/ }).click();
      await dialog.getByRole("button", { name: /RMS Titanic/ }).click();
      await expect(dialog).toHaveCount(0);

      await expect(page.getByLabel("Ship name")).toHaveValue("RMS Titanic");
      const ship = await page.evaluate(
        () => window.__shipBuilderStore!.getState().ship
      );
      expect(ship.name).toBe("RMS Titanic");
      expect(ship.parts.length).toBeGreaterThan(50);
    }
  );
});
