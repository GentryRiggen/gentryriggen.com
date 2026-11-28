import { test, expect, type Page } from "@playwright/test";
import { concordiaRecipe } from "@/components/shipwreck/model/concordiaRecipe";
import { boatSpot } from "@/lib/shipwreck/boatRide";
import { CONCORDIA_INTERIOR } from "@/lib/shipwreck/interior/concordia";
import { CONCORDIA_POOL_GLASS } from "@/lib/shipwreck/ships/concordiaLayout";
import { getShip } from "@/lib/shipwreck/ships";
import { CONCORDIA_WALK } from "@/lib/shipwreck/walk/concordiaDecks";
import { insideBlocker, pointInPolygon } from "@/lib/shipwreck/walk/types";

/**
 * Walking the Costa Concordia (1.17): the pool hall, a lifeboat, her lean
 * and the slide into the sea; going inside her (1.18): the boat deck's
 * door, the glass lift, the low lobby flooding, the 30° close and the
 * balcony. Chromium only; times key on her heel, never the clock (except
 * 22:00 and the boat's lowering, found from the events).
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

/** The game itself (its HUD: the picker, the lift's buttons), at 22:00. */
async function startGame(page: Page) {
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
}

/** Taps the camera picker's room button `label` and waits to be inside. */
async function pickRoom(page: Page, label: string) {
  await expect(page.getByTestId("shipwreck-walk")).toBeEnabled({
    timeout: 60_000,
  });
  await page.getByTestId("shipwreck-cameras-button").click();
  const button = page.getByRole("button", { name: `Walk inside: ${label}` });
  await expect(button).toBeVisible();
  await button.click();
  await page.waitForFunction(
    () => window.__shipwreck!.getWalk!()?.inside === true,
    null,
    { timeout: 20_000 }
  );
}

/** Seeks in steps of 15 s from `t` until her heel reaches `heel`; the time. */
async function seekToHeel(page: Page, t: number, heel: number) {
  for (;;) {
    await seekTo(page, t);
    if ((await walk(page)).heelDeg >= heel) return t;
    t += 15;
    expect(t).toBeLessThan(5200);
  }
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
      { timeout: 60_000 }
    );
    expect((await walk(page)).ride).toBeNull();
    for (const deck of ["4", "5", "7"]) {
      await page.evaluate(() => window.__shipwreck!.rideLift!("up"));
      await page.waitForFunction(
        (a) => window.__shipwreck!.getWalk!()?.area === a,
        `lift-a@${deck}`,
        { timeout: 60_000 }
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

test.describe("Shipwreck: inside the Costa Concordia", () => {
  test.setTimeout(240_000);
  const link = (id: string) =>
    CONCORDIA_INTERIOR.links.find((l) => l.id === id)!;
  /** lobby-1's low (starboard) side, where the sea comes in first. */
  const LOBBY_STBD: [number, number] = [59, -13.4];

  test("goes in by the starboard boat deck's door", async ({ page }) => {
    await startNight(page);
    await seekTo(page, T_2200);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    const door = link("entry-s");
    // On the promenade at the door, facing it (inboard: to port).
    await place(
      page,
      "boat-deck-s",
      door.from.at[0],
      door.from.at[1],
      Math.PI / 2
    );
    await page.evaluate(() => window.__shipwreck!.enterDoor!("entry-s"));
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.area === "entry-s",
      null,
      { timeout: 10_000 }
    );
    expect(await walk(page)).toMatchObject({ inside: true, area: "entry-s" });
  });

  test("the picker's Atrium, then the glass lift down to the low lobby and up to deck 7", async ({
    page,
  }) => {
    await startGame(page);
    await pickRoom(page, "Atrium");
    expect(await walk(page)).toMatchObject({
      inside: true,
      area: "atrium-well",
    });
    // Into lift-a's car at deck 3 (its door onto the atrium).
    await place(page, "lift-a@3", 63.1, 2.6, 0);
    const ride = async (dir: "up" | "down", to: string) => {
      await page.evaluate((d) => window.__shipwreck!.rideLift!(d), dir);
      await page.waitForFunction(
        () => window.__shipwreck!.getWalk!()?.ride === "lift-a"
      );
      await page.waitForFunction(
        (a) => {
          const w = window.__shipwreck!.getWalk!();
          return w?.area === a && w.ride === null;
        },
        to,
        { timeout: 60_000 }
      );
    };
    await ride("down", "lift-a@0");
    for (const deck of ["3", "4", "5", "7"]) await ride("up", `lift-a@${deck}`);
    expect(await walk(page)).toMatchObject({ area: "lift-a@7", ride: null });
  });

  test("walking up to a glass lift in the atrium: the car arrives first, never appears round you", async ({
    page,
  }) => {
    await startNight(page);
    await seekTo(page, T_2200);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    const lift = CONCORDIA_INTERIOR.lifts![0];
    const door = lift.stops[1].door;
    const dx = (door[0][0] + door[1][0]) / 2;
    const dy = (door[0][1] + door[1][1]) / 2;
    // Deck 3's car z (the stop): read where the car is drawn once it is
    // parked round a walker standing in it.
    await place(page, "lift-a@3", 63.1, dy, 0);
    await page.waitForTimeout(300);
    const stopZ = (await page.evaluate(() =>
      window.__shipwreck!.liftCarZ!("lift-a")
    ))!;
    expect(stopZ).not.toBeNull();
    // Off to the well floor's far side (the car goes back to its loop),
    // then onto deck 3's landing facing the door, and walk straight in.
    await place(page, "atrium-3", 74, 0, Math.PI);
    await page.waitForTimeout(6000);
    await place(page, "atrium-3", dx + 1.6, dy, Math.PI);
    const seen = await page.evaluate(
      async ([z0]) => {
        const h = window.__shipwreck!;
        h.setWalkInput!(1, 0);
        const out: { area: string | null; z: number | null }[] = [];
        const t0 = performance.now();
        while (performance.now() - t0 < 12_000) {
          await new Promise((r) => requestAnimationFrame(r));
          const w = h.getWalk!();
          out.push({ area: w?.area ?? null, z: h.liftCarZ!("lift-a") });
          if (w?.area === "lift-a@3" && performance.now() - t0 > 500) break;
        }
        h.setWalkInput!(0, 0);
        return out.map((o) => ({ ...o, off: o.z === null ? 0 : o.z - z0 }));
      },
      [stopZ] as const
    );
    expect(seen.some((s) => s.area === "lift-a@3")).toBe(true);
    // The car was already there when they stepped in: the last frame
    // before shows it at the stop (within the door's 3 cm and one
    // frame's glide), not on its way.
    const first = seen.findIndex((s) => s.area === "lift-a@3");
    expect(first).toBeGreaterThan(0);
    expect(Math.abs(seen[first - 1].off)).toBeLessThan(0.06);
    // And while it was still on its way they stood on the landing.
    for (const s of seen)
      if (Math.abs(s.off) > 0.06) expect(s.area).not.toBe("lift-a@3");
  });

  test("the low lobby floods slowly on its starboard side, never over 0.8 m, before 29 degrees", async ({
    page,
  }) => {
    await startNight(page);
    // 22:55 on the real night: the first boat goes down.
    const lowered = await page.evaluate(
      () =>
        window.__shipwreck!.getEvents!().find(
          (e) => e.kind === "boat-lowered" && e.index === 0
        )!.t
    );
    let t = lowered;
    await seekTo(page, t);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    let deepest = -Infinity;
    for (;;) {
      await place(page, "lobby-1", ...LOBBY_STBD, Math.PI);
      await page.waitForTimeout(300);
      const w = await walk(page);
      if (w.heelDeg >= 29) break;
      expect(w.inside).toBe(true);
      expect(w.depthM, `t ${t}`).toBeLessThanOrEqual(0.8);
      deepest = Math.max(deepest, w.depthM);
      // Her clock runs 6× once she is aground: 10 s is a real minute.
      t += 10;
      expect(t).toBeLessThan(5200);
      await seekTo(page, t);
    }
    expect(deepest).toBeGreaterThan(0);
  });

  test("at 30 degrees her rooms close and you are back out on deck", async ({
    page,
  }) => {
    await startNight(page);
    await seekTo(page, T_2200);
    await page.evaluate(() => window.__shipwreck!.startWalk!());
    await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
    const t = await seekToHeel(page, 3400, 28);
    await place(page, "lobby-1", 59, 0, Math.PI);
    expect((await walk(page)).inside).toBe(true);
    await seekToHeel(page, t, 30);
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.inside === false,
      null,
      { timeout: 20_000 }
    );
    const w = await walk(page);
    expect(w.inside).toBe(false);
    expect(w.phase).toBe("deck");
  });

  test("the picker's Stateroom, then out onto its balcony", async ({
    page,
  }) => {
    await startGame(page);
    await pickRoom(page, "Stateroom");
    expect((await walk(page)).area).toBe("stateroom");
    // Facing the balcony's glass door, the bed's foot in the way: walk past
    // the foot of the bed, then turn for the door and out.
    const entry = CONCORDIA_INTERIOR.entries!.find(
      (e) => e.id === "stateroom"
    )!;
    let yaw = entry.yaw;
    const walkTo = async (x: number, y: number, until: string) => {
      const w = await walk(page);
      const heading = Math.atan2(y - w.y, x - w.x);
      await page.evaluate(
        (a) => window.__shipwreck!.turnWalk!(a),
        heading - yaw
      );
      yaw = heading;
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
      await page.waitForFunction(until, null, { timeout: 20_000 });
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
    };
    await walkTo(50.0, -13.9, "window.__shipwreck.getWalk().y < -13.8");
    const door = CONCORDIA_INTERIOR.seams.find(
      (m) => [m.a, m.b].sort().join() === "balcony,stateroom"
    )!;
    const doorX = (door.at[0][0] + door.at[1][0]) / 2;
    await walkTo(
      doorX,
      door.at[0][1] - 1,
      "window.__shipwreck.getWalk().area === 'balcony'"
    );
    expect(await walk(page)).toMatchObject({ inside: true, area: "balcony" });
  });
});
