import {
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import { newSave, parseSave } from "../../../engine/save";
import type { RunState } from "../../../engine/types";
import { simulate } from "../../../engine/sim";
import { lightBots } from "../bots";
import { def } from "./fixtures";
import {
  PICK_ACTION,
  RAIN_BARREL_ID,
  WATER_ACTION,
  bloomCount,
  gardenResultLine,
  isGardenOpen,
  keepsakeNames,
  picksSoFar,
  plantedCount,
  progressOf,
  stageOf,
  waterCooldownLeft,
  GARDEN_PLANTS,
} from "../garden";
import { LET_GO } from "../upgrades";
import { sceneInfo } from "../scene";
import { TUNING } from "../tuning";

const G = TUNING.garden;

/** A fresh Last Light run with plenty of resolve, nothing let go yet. */
const lastRun = (owned: Record<string, number> = {}): RunState => {
  const base = newRun(def);
  return {
    ...base,
    phase: 3,
    owned,
    resources: { ...base.resources, resolve: 5000, lights: 12, flame: 600 },
  };
};

const letGo = (run: RunState, id: string): RunState => ({
  ...run,
  owned: { ...run.owned, [id]: 1 },
  resources: { ...run.resources, lights: run.resources.lights - 1 },
});

const wait = (run: RunState, seconds: number, step = 1): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += step) next = tick(def, next, step);
  return next;
};

const planted = (): RunState => wait(letGo(lastRun(), "letgo-porch"), 0.1);

/** Ticks until the first plot blooms. */
const bloomed = (run = planted()): RunState => wait(run, G.growSeconds + 5);

describe("the memory garden", () => {
  it("plots follow the let-go lights, in order", () => {
    expect(GARDEN_PLANTS.map((p) => p.id)).toEqual(LET_GO.map((l) => l.id));
  });

  it("opens with the first let-go and never on a timer", () => {
    const waited = wait(lastRun(), 600, 5);
    expect(isGardenOpen(waited)).toBe(false);
    const run = planted();
    expect(isGardenOpen(run)).toBe(true);
    expect(plantedCount(run)).toBe(1);
  });

  it("tells its story line only after the seed has sprouted", () => {
    const run = planted();
    expect(run.story).not.toContain("last-garden");
    expect(wait(run, 30).story).toContain("last-garden");
  });

  it("grows through sprout, bud and bloom by itself", () => {
    let run = planted();
    expect(stageOf(run, 0)).toBe("sprout");
    run = wait(run, G.growSeconds * 0.5);
    expect(stageOf(run, 0)).toBe("bud");
    run = wait(run, G.growSeconds * 0.6);
    expect(stageOf(run, 0)).toBe("bloom");
    expect(G.growSeconds).toBeGreaterThanOrEqual(120);
    expect(G.growSeconds).toBeLessThanOrEqual(180);
  });

  it("grows faster with watering, and never faster than the can allows", () => {
    const dry = wait(planted(), 60);
    const watered = wait(performAction(def, planted(), WATER_ACTION), 60);
    expect(progressOf(watered, 0)).toBeGreaterThan(progressOf(dry, 0) * 1.5);
  });

  it("rests the can for a short while after watering", () => {
    const run = performAction(def, planted(), WATER_ACTION);
    expect(waterCooldownLeft(run)).toBe(G.waterCooldown);
    const again = performAction(def, run, WATER_ACTION);
    expect(again.resources.gdWaterings).toBe(1);
    const later = wait(run, G.waterCooldown + 1);
    expect(waterCooldownLeft(later)).toBe(0);
    expect(performAction(def, later, WATER_ACTION).resources.gdWaterings).toBe(
      2
    );
  });

  it("is safe to skip watering: it still blooms, only slower", () => {
    const run = wait(planted(), G.growSeconds + 5);
    expect(stageOf(run, 0)).toBe("bloom");
  });

  it("lets blooms wait forever without wilting", () => {
    const run = wait(bloomed(), 3 * 3600, 30);
    expect(stageOf(run, 0)).toBe("bloom");
    expect(progressOf(run, 0)).toBe(1);
    expect(bloomCount(run)).toBe(1);
  });

  it("pays resolve and warms the flame when a bloom is picked", () => {
    const ready = bloomed();
    const before = ready.resources.resolve;
    const flameBefore = ready.resources.flame;
    const picked = performAction(def, ready, PICK_ACTION);
    expect(picksSoFar(picked)).toBe(1);
    expect(gardenResultLine(picked)).toMatch(/memory flower/);
    const settled = wait(picked, G.surgeSeconds + 1);
    expect(settled.resources.resolve).toBeGreaterThan(before);
    expect(picked.resources.flame).toBeGreaterThan(flameBefore * 0.99);
    expect(keepsakeNames(picked)).toEqual(["Porch lights"]);
    // the payout is small: a few seconds of letting go
    expect(settled.resources.gdEarned).toBeLessThan(30);
  });

  it("grows a picked flower back from a bud, more slowly", () => {
    const picked = performAction(def, bloomed(), PICK_ACTION);
    expect(stageOf(picked, 0)).toBe("bud");
    const firstLap = G.growSeconds * (1 - 0);
    const secondLap = (G.growSeconds * (1 - G.regrowTo)) / G.regrowPace;
    expect(secondLap).toBeGreaterThan(firstLap * 0.6);
    expect(stageOf(wait(picked, secondLap * 0.5), 0)).toBe("bud");
    expect(stageOf(wait(picked, secondLap + 5), 0)).toBe("bloom");
  });

  it("picks nothing, and pays nothing, with no bloom", () => {
    const run = planted();
    const same = performAction(def, run, PICK_ACTION);
    expect(picksSoFar(same)).toBe(0);
  });

  it("makes the rain barrel an addition to hand watering, never a replacement", () => {
    const base = letGo(lastRun(), "letgo-porch");
    const withBarrel: RunState = {
      ...base,
      owned: { ...base.owned, [RAIN_BARREL_ID]: 1 },
      resources: { ...base.resources, gdRain: G.rainEvery },
    };
    expect(withBarrel.owned[RAIN_BARREL_ID]).toBe(1);
    const t = 80;
    const dry = progressOf(wait(base, t), 0);
    const rain = progressOf(wait(withBarrel, t), 0);
    const hand = progressOf(wait(performAction(def, base, WATER_ACTION), t), 0);
    const both = progressOf(
      wait(performAction(def, withBarrel, WATER_ACTION), t),
      0
    );
    expect(rain).toBeGreaterThan(dry);
    expect(hand).toBeGreaterThan(rain);
    expect(both).toBeGreaterThanOrEqual(hand);
    expect(both).toBeGreaterThan(rain);
  });

  it("offers the rain barrel after a few picks, halfway through the garden", () => {
    const shown = (run: RunState) =>
      def.upgrades.find((u) => u.id === RAIN_BARREL_ID)?.visibleWhen?.(run);
    expect(shown(planted())).toBe(false);
    const once = performAction(def, bloomed(), PICK_ACTION);
    expect(shown(once)).toBe(false);
    const thrice = { ...once, resources: { ...once.resources, gdPicks: 3 } };
    expect(shown(thrice)).toBe(true);
  });

  it("still completes the ending normally with blooms waiting", () => {
    let run = bloomed();
    run = {
      ...run,
      resources: { ...run.resources, lights: 1, boatProgress: 100 },
    };
    expect(bloomCount(run)).toBe(1);
    run = performAction(def, run, "flash-lamp");
    run = tick(def, run, 1);
    expect(run.complete).toBe(true);
    // a pick that was flowing in when the ending came still finishes quietly
    expect(() => wait(run, 10)).not.toThrow();
  });

  it("round-trips through a save", () => {
    const run = performAction(def, bloomed(), WATER_ACTION);
    const save = newSave();
    save.universes.light = {
      run,
      best: null,
      completions: 0,
      embers: 0,
      prestigeUpgrades: {},
    };
    const loaded = parseSave(JSON.parse(JSON.stringify(save)))?.universes.light
      .run;
    expect(loaded).toBeDefined();
    expect(bloomCount(loaded as RunState)).toBe(1);
    expect((loaded as RunState).resources.gdCool).toBe(run.resources.gdCool);
  });

  it("reads an old save without any garden numbers as an empty garden", () => {
    const run = planted();
    const old: RunState = {
      ...run,
      resources: Object.fromEntries(
        Object.entries(run.resources).filter(([id]) => !id.startsWith("gd"))
      ),
    };
    const loaded = reconcileRun(def, old);
    expect(progressOf(loaded, 0)).toBe(0);
    expect(() => wait(loaded, 5)).not.toThrow();
    expect(wait(loaded, 5).resources.gdP0).toBeGreaterThan(0);
  });

  it("never touches the run's own random stream, and is deterministic", () => {
    const a = bloomed();
    const b = bloomed();
    expect(a.rng).toBe(b.rng);
    expect(a.resources.gdP0).toBe(b.resources.gdP0);
    const plain = wait(lastRun(), G.growSeconds);
    expect(a.rng).toBe(plain.rng);
  });

  it("quantizes what the scene sees", () => {
    const first = sceneInfo(planted()).gardenCode;
    const next = sceneInfo(wait(planted(), 1)).gardenCode;
    expect(next).toBe(first);
    expect(sceneInfo(bloomed()).gardenCode).not.toBe(first);
  });

  it("does not shrink the last phase by more than about a tenth", () => {
    const bots = lightBots();
    const length = (strategy: typeof bots.tapper): number => {
      const { finalRun } = simulate(def, {
        strategy: { ...strategy, greetAfter: Infinity },
        maxSeconds: 8 * 3600,
        step: 1,
      });
      const t = finalRun.transitions;
      const lastEnter = t.find((x) => x.to === "last")?.at ?? 0;
      return finalRun.time - lastEnter;
    };
    const withGarden = length(bots.tapper);
    const without = length({
      ...bots.tapper,
      actions: (run, available) =>
        (bots.tapper.actions?.(run, available) ?? []).filter(
          (id) => id !== WATER_ACTION && id !== PICK_ACTION
        ),
    });
    expect(withGarden).toBeGreaterThan(without * 0.88);
  });
});
