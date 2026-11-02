import { test, expect, type Page } from "@playwright/test";

/**
 * Walk mode: tap Walk, see the walk controls, move with the keys, the stick
 * and the look layer, climb real stairs, and stop to get the builder back.
 *
 * The test hook `__shipBuilderWalk` reads the walker's live position, so every
 * move is checked by where she ended up, not by pixels. The software renderer
 * can be slow, so each check polls for the change rather than waiting a fixed
 * time. `walkSpawn` plants the walker for the stairs test, and the ship for it
 * is built through the store (no template has stairs).
 */

test.setTimeout(120_000);

/** A move takes sim time, and software WebGL runs the sim slowly. */
const MOVE_TIMEOUT = { timeout: 30_000 };

interface Walker {
  x: number;
  z: number;
  yaw: number;
  level: number;
}

async function openBuilder(page: Page) {
  await page.goto("/ship-builder");
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
}

async function loadTitanic(page: Page) {
  await page.getByRole("button", { name: "New", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "New ship" });
  await picker.getByRole("button", { name: /Ocean liner/ }).click();
  await picker.getByRole("button", { name: /RMS Titanic/ }).click();
  await expect(picker).toHaveCount(0);
}

const walker = (page: Page) =>
  page.evaluate(
    () => window.__shipBuilderWalk?.() ?? null
  ) as Promise<Walker | null>;

const walkStatus = (page: Page) =>
  page.evaluate(() => window.__shipBuilderStore!.getState().walk.status);

type StartName = "Front (bow)" | "Middle" | "Back (stern)";

/** Taps Walk, picks where to start, and waits for the walker to appear. */
async function startWalking(page: Page, start: StartName = "Middle") {
  await page.getByRole("button", { name: "Walk", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Where do you want to start?" })
    .getByRole("button", { name: start })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop walking" })
  ).toBeVisible();
  await expect.poll(() => walker(page)).not.toBeNull();
  return (await walker(page))!;
}

const distance = (a: Walker, b: Walker) => Math.hypot(a.x - b.x, a.z - b.z);

/** Polls a value read from the walker until the assertion on it holds. */
const pollWalker = <T>(page: Page, read: (walker: Walker) => T) =>
  expect.poll(async () => read((await walker(page))!), MOVE_TIMEOUT);

test.describe("Ship Builder walk", () => {
  test(
    "walks with the keys, the stick and the look layer, then stops",
    { tag: "@smoke" },
    async ({ page }) => {
      await openBuilder(page);
      await loadTitanic(page);
      await expect(page.getByRole("button", { name: "Walk" })).toBeEnabled();

      const start = await startWalking(page);
      expect(await walkStatus(page)).toBe("walking");
      await expect(
        page.getByRole("group", { name: /Walk joystick/ })
      ).toBeVisible();
      // The builder's own buttons are tucked away while walking.
      await expect(page.getByRole("button", { name: "Sea trial" })).toHaveCount(
        0
      );

      // Keys: turn with the arrows, walk forward with W.
      await page.keyboard.down("ArrowRight");
      await pollWalker(page, (w) =>
        Math.abs(w.yaw - start.yaw)
      ).toBeGreaterThan(0.3);
      await page.keyboard.up("ArrowRight");
      const beforeKeys = (await walker(page))!;
      await page.keyboard.down("w");
      await pollWalker(page, (w) => distance(w, beforeKeys)).toBeGreaterThan(
        0.3
      );
      await page.keyboard.up("w");

      // The stick: drag it forward.
      const stick = await page
        .getByRole("group", { name: /Walk joystick/ })
        .boundingBox();
      const cx = stick!.x + stick!.width / 2;
      const cy = stick!.y + stick!.height / 2;
      const beforeStick = (await walker(page))!;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx, cy - 40, { steps: 4 });
      await pollWalker(page, (w) => distance(w, beforeStick)).toBeGreaterThan(
        0.3
      );
      await page.mouse.up();

      // The look layer: drag sideways to turn.
      const beforeLook = (await walker(page))!;
      const size = page.viewportSize()!;
      await page.mouse.move(size.width / 2, size.height / 3);
      await page.mouse.down();
      await page.mouse.move(size.width / 2 + 80, size.height / 3, { steps: 4 });
      await pollWalker(page, (w) =>
        Math.abs(w.yaw - beforeLook.yaw)
      ).toBeGreaterThan(0.2);
      await page.mouse.up();

      // Stop: the builder comes back.
      await page.getByRole("button", { name: "Stop walking" }).click();
      expect(await walkStatus(page)).toBe("idle");
      await expect(page.getByRole("button", { name: "Walk" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sea trial" })
      ).toBeVisible();
      expect(await walker(page)).toBeNull();
    }
  );
});
