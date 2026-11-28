import { test, expect, type Page } from "@playwright/test";
import { TITANIC_INTERIOR } from "@/lib/shipwreck/interior";

/** Seconds into the night at a real clock time (11:40 PM start). */
const at = (h: number, m: number, s = 0) => (h * 60 + m) * 60 + s;
const T_1150PM = at(0, 10);
const T_0130AM = at(1, 50);
const T_0213_50 = at(2, 33, 50);

const room = (id: string) => TITANIC_INTERIOR.rooms.find((r) => r.id === id)!;
function centre(id: string): [number, number] {
  const xs = room(id).outline.map((p) => p[0]);
  const ys = room(id).outline.map((p) => p[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

async function startNight(page: Page) {
  await page.goto("/shipwreck?scene&quality=low");
  await page.waitForFunction(() => Boolean(window.__shipwreck?.getState));
  await page.waitForFunction(
    () => window.__shipwreck?.getState?.().done === true,
    null,
    { timeout: 240_000 }
  );
  await page.evaluate(() => {
    const h = window.__shipwreck!;
    h.pause!();
    h.startWalk!();
  });
  await page.waitForFunction(() => window.__shipwreck!.getWalk!() !== null);
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

test.describe("Shipwreck interiors", () => {
  test.setTimeout(180_000);

  test("in by the staircase door and down the Grand Staircase to B deck", async ({
    page,
  }) => {
    await startNight(page);
    await page.evaluate((t) => window.__shipwreck!.seek!(t), T_0130AM);
    // Outboard of the starboard door, facing her house (port), and walk in.
    await place(page, "boat-deck", 35.5, -7, Math.PI / 2);
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.inside,
      null,
      {
        timeout: 20_000,
      }
    );
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
    expect((await walk(page)).area).toBe("gs-boat");
    // The eyes widen inside: 65 degrees.
    await expect
      .poll(() =>
        page.evaluate(() => window.__shipwreck!.getRenderInfo!()?.fov ?? 0)
      )
      .toBeCloseTo(65, 0);

    // Down the broad flight (forward), the landing, then a twin flight aft:
    // twice, boat -> A -> B. The area changes through the flights.
    const seen = new Set<string>(["gs-boat"]);
    for (const deck of ["gs-a", "gs-b"]) {
      const w = await walk(page);
      await place(page, w.area!, 34, 0, 0);
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
      await page.waitForFunction(
        () => {
          const a = window.__shipwreck!.getWalk!()?.area ?? "";
          return /landing$/.test(a);
        },
        null,
        { timeout: 20_000 }
      );
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
      const landing = (await walk(page)).area!;
      seen.add(landing);
      await place(page, landing, 39.8, -2.25, Math.PI);
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
      await page.waitForFunction(
        (d) => window.__shipwreck!.getWalk!()?.area === d,
        deck,
        { timeout: 20_000 }
      );
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
      seen.add(deck);
    }
    expect((await walk(page)).area).toBe("gs-b");
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  test("Scotland Road: the wall holds and the water is ahead", async ({
    page,
  }) => {
    await startNight(page);
    await page.evaluate((t) => window.__shipwreck!.seek!(t), T_0130AM);
    await place(page, "scotland-road", 20, 4.3, 0);
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
    await page.waitForFunction(
      () => (window.__shipwreck!.getWalk!()?.depthM ?? 0) > 0,
      null,
      { timeout: 30_000 }
    );
    // Hold forward a while: the walker never wades deeper than 0.8 m.
    let deepest = 0;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(250);
      deepest = Math.max(deepest, (await walk(page)).depthM);
    }
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
    expect(deepest).toBeGreaterThan(0);
    expect(deepest).toBeLessThanOrEqual(0.8 + 0.05);
  });

  test("the lift runs at 11:50 PM and not at 1:30 AM", async ({ page }) => {
    await startNight(page);
    const lift = TITANIC_INTERIOR.links.find((l) => l.kind === "lift")!;
    const ride = async (t: number, runs: boolean) => {
      await page.evaluate((s) => window.__shipwreck!.seek!(s), t);
      // 0.8 m aft of the car's door spot (the stop is 0.5 m wide), facing
      // forward: walk onto it.
      await place(page, "lift-b", lift.from.at[0] - 0.8, lift.from.at[1], 0);
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
      if (runs) {
        await page.waitForFunction(
          () => window.__shipwreck!.getWalk!()?.area === "lift-e",
          null,
          { timeout: 15_000 }
        );
      } else {
        // Nothing to poll for: give the ride its usual time to (not) happen.
        await page.waitForTimeout(2000);
      }
      await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
      return (await walk(page)).area;
    };
    expect(await ride(T_1150PM, true)).toBe("lift-e");
    expect(await ride(T_0130AM, false)).toBe("lift-b");
  });

  test("inside at 2:13:50 and past the break, she floats", async ({ page }) => {
    await startNight(page);
    // A seek puts the walker back on deck: place her after it.
    await page.evaluate((t) => window.__shipwreck!.seek!(t), T_0213_50);
    // The top of the Grand Staircase is still dry.
    await place(page, "gs-boat", 34, 4, 0);
    expect((await walk(page)).inside).toBe(true);
    await page.evaluate(() => {
      const h = window.__shipwreck!;
      const e = h.getEvents!().find((v) => v.kind === "breakup")!;
      h.seek!(e.t + 20);
    });
    // Run on: interiors close when she breaks, she floats in the sea.
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(1, 0));
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.phase === "water",
      null,
      { timeout: 30_000 }
    );
    await page.evaluate(() => window.__shipwreck!.setWalkInput!(0, 0));
    expect((await walk(page)).inside).toBe(false);
  });

  test("the camera picker's Grand Staircase starts the walk inside it", async ({
    page,
  }) => {
    await page.goto("/shipwreck");
    await page.waitForFunction(() => Boolean(window.__shipwreck?.setShip));
    await page.evaluate(() => window.__shipwreck!.setShip!("titanic"));
    await page.getByTestId("shipwreck-real-night").click();
    await expect(page.getByTestId("shipwreck-hud")).toBeVisible();
    await expect(page.getByTestId("shipwreck-walk")).toBeEnabled({
      timeout: 60_000,
    });
    await page.evaluate(() => window.__shipwreck!.pause!());
    await page.getByTestId("shipwreck-cameras-button").click();
    const gs = page.getByRole("button", {
      name: "Walk inside: Grand Staircase",
    });
    await expect(gs).toBeVisible();
    await gs.click();
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.inside === true,
      null,
      { timeout: 20_000 }
    );
    expect(await walk(page)).toMatchObject({ inside: true, area: "gs-boat" });
    // The eyes widen inside, as walking in.
    await expect
      .poll(() =>
        page.evaluate(() => window.__shipwreck!.getRenderInfo!()?.fov ?? 0)
      )
      .toBeCloseTo(65, 0);
  });

  test("Go outside from a suite puts you on the boat deck", async ({
    page,
  }) => {
    await startNight(page);
    await page.evaluate((t) => window.__shipwreck!.seek!(t), T_1150PM);
    const [x, y] = centre("suite-2");
    await place(page, "suite-2", x, y, 0);
    await page.evaluate(() => window.__shipwreck!.goOutside!());
    await page.waitForFunction(
      () => window.__shipwreck!.getWalk!()?.area === "boat-deck",
      null,
      { timeout: 10_000 }
    );
    expect((await walk(page)).inside).toBe(false);
  });
});
