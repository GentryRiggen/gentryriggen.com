import { test, expect, type Page } from "@playwright/test";
import { concordiaRecipe } from "@/components/shipwreck/model/concordiaRecipe";
import { boatSpot } from "@/lib/shipwreck/boatRide";
import { CONCORDIA_POOL_GLASS } from "@/lib/shipwreck/ships/concordiaLayout";
import { getShip } from "@/lib/shipwreck/ships";
import { CONCORDIA_WALK } from "@/lib/shipwreck/walk/concordiaDecks";
import { insideBlocker, pointInPolygon } from "@/lib/shipwreck/walk/types";

/**
 * Walking the Costa Concordia (1.17): the pool hall, a lifeboat, her lean
 * and the slide into the sea. Chromium only; times key on her heel, never
 * the clock (except 22:00 and the boat's lowering, found from the events).
 */

/** 22:00 on the real night: 14 min 53 s after the strike (21:45:07). */
const T_2200 = 14 * 60 + 53;

async function startNight(page: Page) {
  await page.goto("/shipwreck?scene&ship=concordia&quality=low");
  await page.waitForFunction(() => Boolean(window.__shipwreck?.getState));
  await page.waitForFunction(
    () => window.__shipwreck?.getState?.().done === true,
    null,
    { timeout: 240_000 }
  );
  await page.evaluate(() => window.__shipwreck!.pause!());
}

const walk = (page: Page) =>
  page.evaluate(() => window.__shipwreck!.getWalk!()!);

async function place(
  page: Page,
  area: string,
  x: number,
  y: number,
  yaw: number
) {
  await page.evaluate(
    ([a, px, py, pyaw]) =>
      window.__shipwreck!.placeWalk!(a as string, +px, +py, +pyaw),
    [area, x, y, yaw] as const
  );
  await page.waitForFunction(
    (a) => window.__shipwreck!.getWalk!()?.area === a,
    area
  );
}

/** Seeks to shown time `t` and waits for a frame of it to be walked. */
async function seekTo(page: Page, t: number) {
  await page.evaluate((s) => window.__shipwreck!.seek!(s), t);
  await page.waitForTimeout(500);
}

test.describe("Shipwreck: walking the Costa Concordia", () => {
  test.setTimeout(240_000);

  test("starts in the pool hall and walks out into the forward lido", async ({
    page,
  }) => {
    await startNight(page);
    await seekTo(page, T_2200);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    expect((await walk(page)).area).toBe("pool-hall");

    // Stand by her forward glass doors and walk through.
    await place(
      page,
      "pool-hall",
      CONCORDIA_POOL_GLASS.x1 - 4,
      0,
      0 // facing the bow
    );
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.area === "lido-fwd",
      null,
      { timeout: 20_000 }
    );
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
    expect((await walk(page)).phase).toBe("deck");
  });

  test("climbs into the first lifeboat from the starboard boat deck", async ({
    page,
  }) => {
    await startNight(page);
    const spec = getShip("concordia");
    const boat = concordiaRecipe(spec).boats[0];
    const spot = boatSpot(boat);
    // Five minutes before the first boat leaves (22:55 on the real night;
    // the events say when in the shown time).
    const lowered = await page.evaluate(
      () =>
        window.__shipwreck!.getEvents!().find(
          (e) => e.kind === "boat-lowered" && e.index === 0
        )!.t
    );
    await seekTo(page, lowered - 5 * 60);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    // Beside boat 0 on the promenade, a metre in from its inboard side.
    await place(page, "boat-deck-s", spot.x, spot.y + 1, 0);
    await page.evaluate(() => window.__shipwreck!.boardBoat!(0));
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.phase === "boat",
      null,
      { timeout: 20_000 }
    );
    expect((await walk(page)).phase).toBe("boat");
  });

  test("leans: slides downhill on deck at 30 degrees, into the sea past 40", async ({
    page,
  }) => {
    await startNight(page);
    await seekTo(page, T_2200);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);

    // An open spot on the forward lido, 3 m clear of anything.
    const area = CONCORDIA_WALK.areas.find((a) => a.id === "lido-fwd")!;
    let open: [number, number] | null = null;
    for (let x = 36; x <= 56 && !open; x += 1)
      for (let y = -10; y <= 10 && !open; y += 1)
        if (
          pointInPolygon([x, y], area.outline) &&
          !insideBlocker(CONCORDIA_WALK, "lido-fwd", [x, y], 3)
        )
          open = [x, y];
    expect(open).not.toBeNull();
    await place(page, "lido-fwd", open![0], open![1], 0);

    // Seek until her heel reaches 30 degrees (about 59 min after the
    // strike, in steps).
    let t = 3500;
    for (;;) {
      await seekTo(page, t);
      if ((await walk(page)).heelDeg >= 30) break;
      t += 15;
      expect(t).toBeLessThan(4200);
    }
    await place(page, "lido-fwd", open![0], open![1], 0);
    const before = await walk(page);
    expect(before.phase).toBe("deck");
    await page.waitForTimeout(3000);
    const after = await walk(page);
    // Downhill is her low side (starboard, y falling), and still on deck.
    expect(after.phase).toBe("deck");
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(
      0.3
    );
    expect(after.y).toBeLessThan(before.y);

    // Past 40 degrees deck walking ends: into the sea, no way back on deck.
    for (;;) {
      t += 30;
      expect(t).toBeLessThan(5200);
      await seekTo(page, t);
      const w = await walk(page);
      if (w.heelDeg >= 40) break;
    }
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.phase === "water",
      null,
      { timeout: 30_000 }
    );
    await expect(
      page.getByRole("button", { name: "Back on deck" })
    ).toHaveCount(0);
  });

  test("rides the glass lift from the low lobby up to deck 7 and back out", async ({
    page,
  }) => {
    // The game itself (its HUD has the lift's buttons), computed to 22:00.
    await page.goto("/shipwreck");
    await page.waitForFunction(() => Boolean(window.__shipwreck?.setShip));
    await page.evaluate(() => window.__shipwreck!.setShip!("concordia"));
    await page.getByTestId("shipwreck-real-night").click();
    await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
    await page.evaluate(() => window.__shipwreck!.pause!());
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const h = window.__shipwreck!;
            h.pump!(200);
            return h.getState!().computedT;
          }),
        { timeout: 120_000 }
      )
      .toBeGreaterThan(T_2200 + 10);
    await seekTo(page, T_2200);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    // In lift-a's car at the low lobby, facing aft (its door).
    await place(page, "lift-a@0", 63.1, 2.6, Math.PI);
    // Only up from the bottom: the picture button, words in its label.
    const up = page.getByTestId("shipwreck-lift-up");
    await expect(up).toBeVisible();
    await expect(up).toHaveAttribute("aria-label", "Lift up");
    await expect(page.getByTestId("shipwreck-lift-down")).toHaveCount(0);
    await up.click();
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.ride === "lift-a"
    );
    // The buttons hide while riding; no dark wipe on her.
    await expect(up).toHaveCount(0);
    await expect(page.getByTestId("shipwreck-walk-lift")).toHaveCount(0);
    // A ride to the next stop up (deck 3), then on to deck 7.
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.area === "lift-a@3",
      null,
      { timeout: 30_000 }
    );
    expect((await walk(page)).ride).toBeNull();
    for (const deck of ["4", "5", "7"]) {
      await page.evaluate(() => window.__shipwreck!.rideLift!("up"));
      await page.waitForFunction(
        (a) => window.__shipwreck!.getWalk!()?.area === a,
        `lift-a@${deck}`,
        { timeout: 30_000 }
      );
    }
    await expect(page.getByTestId("shipwreck-lift-up")).toHaveCount(0);
    await expect(page.getByTestId("shipwreck-lift-down")).toBeVisible();
    // Out through the car's aft door into the deck 7 lobby.
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.area === "lobby-7",
      null,
      { timeout: 10_000 }
    );
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
  });
});
