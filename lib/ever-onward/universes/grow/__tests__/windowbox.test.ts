import { newRun, performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { TUNING } from "../tuning";
import {
  SHADE_ACTION_ID,
  SUN_ACTION_ID,
  aimOf,
  canMoveBlind,
  isBlindMoving,
  leafOf,
  leafSeconds,
  lightOf,
  momentOf,
  moveBlind,
  moistOf,
  moistTerm,
  openWindowBox,
  paceOf,
  skyOf,
  tickWindowBox,
  thrivesSoFar,
  wiltsSoFar,
} from "../windowbox";
import { def } from "./fixtures";

const B = TUNING.windowbox;
const SKY = Object.fromEntries(B.skies.map((s, i) => [s.id, i]));

/** A seed-phase run with the pot open and the sky held on one kind. */
function pot(sky: string, seed = 1): RunState {
  const run = { ...newRun(def), phase: 3, rng: seed * 7919 + 13 };
  run.resources = { ...run.resources };
  openWindowBox(run);
  run.resources.wbSky = SKY[sky];
  // Hold the sky for the whole test unless it is told to change.
  run.resources.wbSkyLen = 1e9;
  return run;
}

const step = (run: RunState, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1) {
    run.time += 1;
    tickWindowBox(run, 1);
  }
};

describe("the old window box dial", () => {
  it("starts in the middle with perky leaves and the blind at rest", () => {
    const run = pot("cloud");
    expect(aimOf(run)).toBe(B.startAim);
    expect(leafOf(run)).toBe("perky");
    expect(isBlindMoving(run)).toBe(false);
    expect(momentOf(run)).toBe("");
  });

  it("takes a little time to move the blind, a step at a time", () => {
    const run = pot("cloud");
    const before = lightOf(run);
    moveBlind(run, 1);
    expect(aimOf(run)).toBe(B.startAim + 1);
    expect(lightOf(run)).toBe(before);
    expect(isBlindMoving(run)).toBe(true);
    step(run, 2);
    expect(lightOf(run)).toBeGreaterThan(before);
    expect(isBlindMoving(run)).toBe(true);
    step(run, Math.ceil(B.moveSeconds));
    expect(isBlindMoving(run)).toBe(false);
    expect(lightOf(run)).toBeCloseTo(1, 5);
  });

  it("stops at the ends of the blind", () => {
    const run = pot("cloud");
    moveBlind(run, 1);
    expect(canMoveBlind(run, 1)).toBe(false);
    moveBlind(run, 1);
    expect(aimOf(run)).toBe(B.steps - 1);
    moveBlind(run, -1);
    moveBlind(run, -1);
    moveBlind(run, -1);
    expect(aimOf(run)).toBe(0);
  });

  it("works through the action buttons, and blocks them at the ends", () => {
    const run = pot("cloud");
    const sun = performAction(def, run, SUN_ACTION_ID);
    expect(aimOf(sun)).toBe(2);
    expect(performAction(def, sun, SUN_ACTION_ID)).toBe(sun);
    const shade = performAction(def, sun, SHADE_ACTION_ID);
    expect(aimOf(shade)).toBe(1);
  });

  it("dries the soil in sun and keeps it moist in shade", () => {
    const sunny = pot("bright");
    moveBlind(sunny, 1);
    step(sunny, 60);
    const shady = pot("bright");
    moveBlind(shady, -1);
    step(shady, 60);
    expect(moistOf(sunny)).toBeLessThan(moistOf(shady));
    expect(moistOf(sunny)).toBeLessThan(B.startMoist);
    expect(moistOf(shady)).toBeGreaterThan(B.startMoist);
  });

  it("shows the leaves curling, then crisp, as the soil dries, and a big moment when they do", () => {
    const run = pot("heat");
    moveBlind(run, 1);
    const seen = new Set<string>();
    for (let t = 0; t < 90; t += 1) {
      step(run, 1);
      seen.add(leafOf(run));
    }
    expect(seen).toEqual(new Set(["perky", "curl", "dry"]));
    expect(wiltsSoFar(run)).toBe(1);
    expect(leafSeconds(run)).toBeGreaterThan(0);
  });

  it("shows droopy, then soggy leaves in the rain with the blind drawn", () => {
    const run = pot("rain");
    moveBlind(run, -1);
    const seen = new Set<string>();
    for (let t = 0; t < 120; t += 1) {
      step(run, 1);
      seen.add(leafOf(run));
    }
    expect(seen.has("droop")).toBe(true);
    expect(seen.has("soggy")).toBe(true);
  });

  it("recovers: a dried-out pot perks up again once the blind comes down", () => {
    const run = pot("heat");
    moveBlind(run, 1);
    step(run, 90);
    expect(leafOf(run)).toBe("dry");
    const parched = moistTerm(moistOf(run));
    moveBlind(run, -1);
    moveBlind(run, -1);
    step(run, 40);
    expect(leafOf(run)).not.toBe("dry");
    expect(moistTerm(moistOf(run))).toBeGreaterThan(parched);
  });

  it("thrives when the sun is strong and the soil is just right, and says so for a few seconds", () => {
    const run = pot("bright");
    let isShown = false;
    for (let t = 0; t < 60 && thrivesSoFar(run) === 0; t += 1) {
      step(run, 1);
      isShown = momentOf(run) === "thrive";
    }
    expect(thrivesSoFar(run)).toBe(1);
    expect(isShown).toBe(true);
    step(run, Math.ceil(B.momentSeconds) + 1);
    expect(momentOf(run)).not.toBe("thrive");
  });

  it("moves the best answer: each sky wants a different amount of sun", () => {
    /** The blind place that keeps the soil closest to steady in this sky. */
    const bestAim = (sky: string): number => {
      let best = 0;
      let bestDrift = Infinity;
      for (let aim = 0; aim < B.steps; aim += 1) {
        const light = aim / (B.steps - 1);
        const drift = Math.abs(
          B.skies[SKY[sky]].wet - B.evap * light * B.skies[SKY[sky]].sun
        );
        if (drift < bestDrift) {
          best = aim;
          bestDrift = drift;
        }
      }
      return best;
    };
    expect(bestAim("rain")).toBeGreaterThan(bestAim("cloud"));
    expect(bestAim("cloud")).toBeGreaterThan(bestAim("heat"));
    expect(new Set(B.skies.map((s) => bestAim(s.id))).size).toBeGreaterThan(2);
  });

  it("changes the sky now and then, from its own random stream", () => {
    const run = pot("cloud");
    run.resources.wbSkyLen = B.skyMin;
    const skies = new Set<string>();
    const rng = run.rng;
    for (let t = 0; t < 900; t += 1) {
      step(run, 1);
      skies.add(skyOf(run).id);
    }
    expect(skies.size).toBe(B.skies.length);
    expect(run.rng).toBe(rng);
  });

  it("is deterministic for the same seed", () => {
    const a = pot("cloud", 7);
    const b = pot("cloud", 7);
    a.resources.wbSkyLen = b.resources.wbSkyLen = B.skyMin;
    step(a, 300);
    step(b, 300);
    expect(a.resources).toEqual(b.resources);
  });

  it("starts safely from a save with no window box numbers", () => {
    const old = { ...newRun(def), phase: 3 };
    old.resources = { ...old.resources, growth: 40 };
    const next = tick(def, old, 1);
    expect(next.resources.growth).toBeGreaterThanOrEqual(40);
    expect(leafOf(next)).toBe("perky");
  });

  describe("no dominant setting", () => {
    /** Mean pace over twenty minutes of weather, for 24 different skies. */
    function meanPace(play: (run: RunState) => void): number {
      let total = 0;
      const seeds = 24;
      for (let seed = 1; seed <= seeds; seed += 1) {
        const run = pot("cloud", seed);
        run.resources.wbSkyLen = B.skyMin;
        let sum = 0;
        for (let t = 0; t < 1200; t += 1) {
          run.time += 1;
          play(run);
          tickWindowBox(run, 1);
          sum += paceOf(run);
        }
        total += sum / 1200;
      }
      return total / seeds;
    }
    const fixed = (aim: number) => (run: RunState) => {
      if (aimOf(run) !== aim) moveBlind(run, aimOf(run) < aim ? 1 : -1);
    };
    /** Reads only the leaves, like a player: shade when dry, sun when soggy. */
    const reader = (run: RunState) => {
      if (isBlindMoving(run)) return;
      const leaf = leafOf(run);
      if (leaf === "perky" || leafSeconds(run) < 3) return;
      moveBlind(run, leaf === "curl" || leaf === "dry" ? -1 : 1);
    };

    it("neither always-sun, always-shade nor any one setting beats reading the leaves", () => {
      const read = meanPace(reader);
      const settings = Array.from({ length: B.steps }, (_, aim) =>
        meanPace(fixed(aim))
      );
      const bestFixed = Math.max(...settings);
      // Always shade is the slowest, always sun is not much better, and the
      // reader clearly beats every one of them.
      expect(settings[0]).toBeLessThan(settings[B.steps - 1]);
      expect(read).toBeGreaterThan(bestFixed * 1.15);
      expect(read).toBeGreaterThan(settings[B.steps - 1] * 1.4);
      expect(read).toBeGreaterThan(settings[0] * 2.5);
    });

    it("even a slow reader is not worse than leaving it alone", () => {
      const slow = meanPace((run) => {
        if (isBlindMoving(run)) return;
        const leaf = leafOf(run);
        if (leaf === "perky" || leafSeconds(run) < 10) return;
        moveBlind(run, leaf === "curl" || leaf === "dry" ? -1 : 1);
      });
      expect(slow).toBeGreaterThan(meanPace(fixed(B.startAim)) * 0.95);
    });
  });
});
