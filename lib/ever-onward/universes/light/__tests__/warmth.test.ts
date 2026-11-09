import {
  canPerformAction,
  manualAction,
  newRun,
  performAction,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { describeChanges } from "../../../engine/changes";
import { sceneInfo } from "..";
import { def, runAtPhaseStart } from "./fixtures";
import { TUNING } from "../tuning";
import { REMOVED_LAST_COSTS, REMOVED_LAST_SCALE } from "../costs";
import { TOTAL_LIGHTS } from "../resources";
import {
  LIGHT_COUNT,
  WIND_KINDS,
  boatPace,
  burnOf,
  burnTotal,
  canLetGo,
  chillForecast,
  chillIn,
  chillKind,
  companyOf,
  flowerNames,
  goodbyeIndex,
  goodbyeLine,
  isTired,
  TIRED_WARNING_SECONDS,
  fogLevel,
  isBitten,
  isCarried,
  isChillBlowing,
  isLit,
  letGoActionId,
  letGoCount,
  litCount,
  lockLeft,
  lumpNow,
  paceAt,
  resolvePerSecond,
  windOn,
  warmthOf,
  warmthTarget,
} from "../warmth";

const L = TUNING.last;

/** Whether the picture holds pop-ups back right now. */
const isSceneBusyFor = (run: RunState): boolean =>
  def.isSceneBusy?.(run) ?? false;

/** The last part's first moment, the same for every test. */
const start = (): RunState => runAtPhaseStart(3);

const wait = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

const withResources = (
  run: RunState,
  resources: Record<string, number>
): RunState => ({ ...run, resources: { ...run.resources, ...resources } });

describe("every remembered light costs warmth", () => {
  it("starts with all eleven burning, and the flame at 30%", () => {
    const run = start();
    expect(litCount(run)).toBe(LIGHT_COUNT);
    expect(warmthOf(run)).toBeCloseTo(0.3, 5);
  });

  it("gives each light its own cost and company, and moves them from run to run", () => {
    const run = start();
    const burns = Array.from({ length: LIGHT_COUNT }, (_, i) => burnOf(run, i));
    expect(new Set(burns.map((b) => b.toFixed(4))).size).toBeGreaterThan(6);
    const other = withResources(run, { wmSeed: 12345 });
    const moved = Array.from({ length: LIGHT_COUNT }, (_, i) =>
      burnOf(other, i)
    );
    expect(moved).not.toEqual(burns);
    // ... but never past the spread
    burns.forEach((b, i) => {
      const base = L.lights[i].burn;
      expect(b).toBeGreaterThanOrEqual(base * (1 - L.spread) - 1e-9);
      expect(b).toBeLessThanOrEqual(base * (1 + L.spread) + 1e-9);
    });
  });

  it("is the same whenever the player happens to tap (the lights come from the start seed)", () => {
    const run = start();
    const tapped = manualAction(def, manualAction(def, run));
    expect(burnOf(tapped, 4)).toBe(burnOf(run, 4));
    expect(companyOf(tapped, 4)).toBe(companyOf(run, 4));
    const later = wait(run, 90);
    expect(burnOf(later, 4)).toBe(burnOf(run, 4));
  });

  it("leaves a warmer flame the fewer lights burn", () => {
    const run = start();
    const fewer = { ...run, owned: { ...run.owned, "letgo-towers": 1 } };
    expect(warmthTarget(fewer)).toBeGreaterThan(warmthTarget(run));
    expect(burnTotal(fewer)).toBeLessThan(burnTotal(run));
  });

  it("slows the boat when the flame is cold and speeds it when it is warm", () => {
    // fog slows the boat at the coldest, and a warm flame makes it surge
    expect(paceAt(0)).toBeCloseTo(L.boatFloor * L.fogPace, 5);
    expect(paceAt(1)).toBeCloseTo(1 + L.surgePace, 5);
    for (let w = 0.05; w <= 1; w += 0.05)
      expect(paceAt(w)).toBeGreaterThan(paceAt(w - 0.05));
    const run = start();
    const cold = withResources(run, { flame: 80 });
    const warm = withResources(run, { flame: 900 });
    expect(boatPace(warm)).toBeGreaterThan(boatPace(cold) * 3);
    expect(wait(warm, 60).resources.boatProgress).toBeGreaterThan(
      wait(cold, 60).resources.boatProgress
    );
  });

  it("earns more resolve while the flame is warm, but never stops when it is cold", () => {
    const run = start();
    const cold = withResources(run, { flame: 0 });
    const warm = withResources(run, { flame: 1000 });
    expect(resolvePerSecond(warm)).toBeGreaterThan(resolvePerSecond(cold));
    expect(resolvePerSecond(cold)).toBeGreaterThan(0);
  });

  it("never warms the flame with taps: a tap gives resolve only", () => {
    const run = start();
    let mashed = run;
    for (let i = 0; i < 100; i += 1) mashed = manualAction(def, mashed);
    expect(warmthTarget(mashed)).toBe(warmthTarget(run));
    expect(mashed.resources.resolve).toBeGreaterThan(run.resources.resolve);
    expect(warmthOf(wait(mashed, 30))).toBeCloseTo(warmthOf(wait(run, 30)), 9);
  });

  it("counts the same eleven lights in the lights left", () => {
    expect(TOTAL_LIGHTS).toBe(LIGHT_COUNT);
    expect(start().resources.lights).toBe(LIGHT_COUNT);
  });

  it("keeps the fog level steady near a step: it moves only once the warmth is well past it", () => {
    let run = withResources(start(), { flame: 300 });
    run = wait(run, 1);
    const held = fogLevel(run);
    // a hair either side of a step does not flip the level
    for (const flame of [305, 295, 300, 306, 294]) {
      run = wait(withResources(run, { flame }), 1);
      expect(fogLevel(run)).toBe(held);
    }
    // a long way colder moves it
    expect(
      fogLevel(wait(withResources(run, { flame: 90 }), 1))
    ).toBeGreaterThan(held);
  });
});

describe("letting one go", () => {
  it("pays a lump of resolve, leaves a flower and frees the warmth it cost", () => {
    const run = withResources(start(), { flame: 600 });
    const before = run.resources.resolve;
    const pays = lumpNow(run, 2);
    const gone = performAction(def, run, letGoActionId(2));
    expect(isLit(gone, 2)).toBe(false);
    expect(letGoCount(gone)).toBe(1);
    // the lump comes in over the next while, as the flower opens, not all at once
    expect(gone.resources.resolve - before).toBeLessThan(pays);
    expect(gone.resources.wmOwed).toBeCloseTo(pays, 5);
    const paid = wait(gone, L.lumpSeconds * 3);
    expect(paid.resources.wmOwed).toBeLessThan(pays * 0.05);
    expect(gone.resources.lights).toBe(LIGHT_COUNT - 1);
    expect(flowerNames(gone)).toEqual(["Stadium lights"]);
    expect(sceneInfo(gone).letGoMask).toBe(1 << 2);
    expect(warmthTarget(wait(gone, L.riseSeconds + 1))).toBeGreaterThan(
      warmthTarget(run)
    );
  });

  it("pays more when the flame is warm than when it is cold", () => {
    const run = start();
    const cold = withResources(run, { flame: 50 });
    const warm = withResources(run, { flame: 950 });
    expect(lumpNow(warm, 5)).toBeGreaterThan(lumpNow(cold, 5) * 1.5);
    expect(lumpNow(cold, 5)).toBeGreaterThan(0);
  });

  it("takes a moment: the next light waits, and the first fades out over the settle", () => {
    const run = start();
    const gone = performAction(def, run, letGoActionId(0));
    expect(lockLeft(gone)).toBeCloseTo(L.goSeconds, 5);
    expect(canLetGo(gone, 1)).toBe(false);
    expect(canPerformAction(def, gone, letGoActionId(1))).toBe(false);
    // its warmth cost fades out over the rise, not all at once
    const justAfter = burnTotal(gone);
    const risen = burnTotal(wait(gone, L.riseSeconds + 1));
    expect(justAfter).toBeGreaterThan(risen);
    const ready = wait(gone, L.goSeconds + 1);
    expect(canPerformAction(def, ready, letGoActionId(1))).toBe(true);
  });

  it("cannot be taken back", () => {
    const gone = performAction(def, start(), letGoActionId(7));
    const again = wait(gone, L.goSeconds + 1);
    expect(canPerformAction(def, again, letGoActionId(7))).toBe(false);
  });

  it("shows the goodbye in the picture for a few seconds, then lets it go", () => {
    const gone = performAction(def, start(), letGoActionId(4));
    expect(goodbyeIndex(gone)).toBe(4);
    expect(sceneInfo(gone).goodbye).toBe(5);
    expect(sceneInfo(wait(gone, L.goodbyeSeconds + 1)).goodbye).toBe(0);
  });

  it("holds a story card back for the whole goodbye and a moment after", () => {
    const gone = performAction(def, start(), letGoActionId(4));
    expect(isSceneBusyFor(gone)).toBe(true);
    expect(isSceneBusyFor(wait(gone, L.goodbyeSeconds - 1))).toBe(true);
    // the banner is gone, the pop-up still waits
    const after = wait(gone, L.goodbyeSeconds + 1);
    expect(sceneInfo(after).goodbye).toBe(0);
    expect(isSceneBusyFor(after)).toBe(true);
    expect(
      isSceneBusyFor(wait(gone, L.goodbyeSeconds + L.goodbyeAfter + 1))
    ).toBe(false);
    expect(isSceneBusyFor(start())).toBe(false);
  });

  it("keeps the lights an old save already let go (bought with resolve) gone", () => {
    const old = {
      ...start(),
      owned: { "letgo-porch": 1, "letgo-night": 1 },
    };
    expect(litCount(old)).toBe(9);
    expect(sceneInfo(old).letGoMask).toBe(1 | (1 << 10));
    expect(canPerformAction(def, old, letGoActionId(0))).toBe(false);
  });

  it("finishes by letting every last light go with the flash", () => {
    let run = start();
    run.resources.boatProgress = 100;
    run = performAction(def, run, "flash-lamp");
    expect(litCount(run)).toBe(0);
    expect(run.complete).toBe(true);
  });
});

/** Runs to the first wind's forecast, then to its start. */
const toForecast = (run: RunState): RunState =>
  wait(run, Math.floor(chillIn(run) - L.chill.lead + 1));

describe("the cold winds", () => {
  it("come from the start seed, whatever the player taps", () => {
    const run = start();
    const tapped = manualAction(def, run);
    expect(tapped.resources.wmChillIn).toBe(run.resources.wmChillIn);
    expect(tapped.resources.wmChillSize).toBe(run.resources.wmChillSize);
    expect(tapped.resources.wmChillKind).toBe(run.resources.wmChillKind);
    const a = wait(run, 400);
    const b = wait(tapped, 400);
    expect(b.resources.wmChillSize).toBe(a.resources.wmChillSize);
    expect(b.resources.wmChillKind).toBe(a.resources.wmChillKind);
  });

  it("are forecast a little ahead with their kind, then blow for a spell", () => {
    let run = start();
    expect(chillForecast(run)).toBeNull();
    run = toForecast(run);
    const size = chillForecast(run);
    expect(size).not.toBeNull();
    expect(sceneInfo(run).chill).toBe(1 + (size ?? 0));
    expect(sceneInfo(run).windKind).toBe(chillKind(run) + 1);
    run = wait(run, L.chill.lead + 1);
    expect(isChillBlowing(run)).toBe(true);
    expect(sceneInfo(run).chill).toBeGreaterThanOrEqual(4);
    run = wait(run, L.chill.seconds + 1);
    expect(isChillBlowing(run)).toBe(false);
    // a wind's kind shows exactly while a wind is forecast or blowing
    const after = sceneInfo(run);
    expect(after.windKind > 0).toBe(after.chill > 0);
  });

  it("is never the same kind twice running", () => {
    let run = start();
    let last = -1;
    for (let wind = 0; wind < 12; wind += 1) {
      run = wait(run, chillIn(run) + 1);
      expect(isChillBlowing(run)).toBe(true);
      expect(chillKind(run)).not.toBe(last);
      last = chillKind(run);
      run = wait(run, L.chill.seconds + 1);
    }
  });

  it("bites only the lights of its kind, and passes the rest by", () => {
    for (let kind = 0; kind < WIND_KINDS.length; kind += 1) {
      const windy = withResources(start(), {
        wmChillLeft: 20,
        wmChillSize: 1,
        wmChillKind: kind,
      });
      for (let i = 0; i < LIGHT_COUNT; i += 1) {
        const bitten = WIND_KINDS[kind].lights.includes(i);
        expect(isBitten(windy, i)).toBe(bitten);
        expect(windOn(windy, i)).toBe(bitten ? L.chill.mult[1] : 1);
      }
    }
    // every light is bitten by exactly one kind
    for (let i = 0; i < LIGHT_COUNT; i += 1)
      expect(WIND_KINDS.filter((k) => k.lights.includes(i))).toHaveLength(1);
  });

  it("makes the bitten lights burn harder while it blows, and costs the flame some warmth", () => {
    const run = start();
    const windy = withResources(run, {
      wmChillLeft: 20,
      wmChillSize: 2,
      wmChillKind: 1,
    });
    expect(warmthTarget(windy)).toBeLessThan(warmthTarget(run));
  });

  it("pays more to let a bitten light go while its wind blows (the wind carries the goodbye)", () => {
    const calm = withResources(start(), { flame: 700 });
    const windy = withResources(calm, {
      wmChillLeft: 20,
      wmChillSize: 0,
      wmChillKind: 1,
    });
    // light 2 (the stadium) is a town light, light 4 (the harbor) is not
    expect(isCarried(windy, 2)).toBe(true);
    expect(isCarried(windy, 4)).toBe(false);
    expect(lumpNow(windy, 2)).toBeCloseTo(lumpNow(calm, 2) * L.chill.carry, 5);
    expect(lumpNow(windy, 4)).toBeCloseTo(lumpNow(calm, 4), 5);
    // a forecast wind is not blowing yet: nothing is carried
    const coming = withResources(calm, {
      wmChillLeft: 0,
      wmChillIn: 10,
      wmChillKind: 1,
    });
    expect(lumpNow(coming, 2)).toBeCloseTo(lumpNow(calm, 2), 5);
  });

  it("offers nothing to cup a hand round: the choice is which light to let go", () => {
    const ids = (def.actions ?? []).map((a) => a.id);
    expect(ids.some((id) => /shelter|cup/i.test(id))).toBe(false);
  });
});

describe("a light left alone", () => {
  it("burns down by itself after a while, the heaviest first, with its flower", () => {
    let run = start();
    const heaviest = Array.from({ length: LIGHT_COUNT }, (_, i) => i).reduce(
      (a, b) => (burnOf(run, b) > burnOf(run, a) ? b : a)
    );
    run = wait(run, L.netSeconds - 1);
    expect(litCount(run)).toBe(LIGHT_COUNT);
    run = wait(run, 2);
    expect(litCount(run)).toBe(LIGHT_COUNT - 1);
    expect(isLit(run, heaviest)).toBe(false);
    expect(run.resources.wmNets).toBe(1);
    expect(goodbyeIndex(run)).toBe(heaviest);
  });

  it("says so honestly: it burned down on its own, you did not let it go", () => {
    const burned = wait(start(), L.netSeconds + 2);
    expect(goodbyeLine(burned)).toMatch(/burned down on their own/);
    expect(goodbyeLine(burned)).not.toMatch(/You let/);
    const chosen = performAction(def, start(), letGoActionId(3));
    expect(goodbyeLine(chosen)).toMatch(/^You let the /);
  });

  it("marks the light that is about to go as tired, shortly before and not earlier", () => {
    const early = wait(start(), L.netSeconds - TIRED_WARNING_SECONDS - 5);
    expect(
      Array.from({ length: LIGHT_COUNT }, (_, i) => isTired(early, i))
    ).not.toContain(true);
    const late = wait(start(), L.netSeconds - 5);
    const tired = Array.from({ length: LIGHT_COUNT }, (_, i) => i).filter((i) =>
      isTired(late, i)
    );
    expect(tired).toHaveLength(1);
    const after = wait(late, 10);
    expect(isLit(after, tired[0])).toBe(false);
    expect(isTired(after, tired[0])).toBe(false);
  });

  it("reads the lights count as 'N left' with no minus sign", () => {
    const before = start();
    const after = performAction(def, before, letGoActionId(3));
    const lines = describeChanges(
      def,
      { ...before, phase: 3 },
      { ...after, phase: 3 }
    );
    expect(lines.some((l) => /11 left → 10 left/.test(l))).toBe(true);
    expect(lines.join(" ")).not.toMatch(/-1/);
  });

  it("waits the same time again for the next, and never for a player who is letting go", () => {
    let run = wait(start(), L.netSeconds + 2);
    expect(litCount(run)).toBe(LIGHT_COUNT - 1);
    run = wait(run, L.netSeconds - 10);
    expect(litCount(run)).toBe(LIGHT_COUNT - 1);
    const active = performAction(
      def,
      wait(start(), L.netSeconds - 5),
      letGoActionId(3)
    );
    expect(wait(active, L.netSeconds - 5).resources.wmNets ?? 0).toBe(0);
  });
});

describe("a save from before the warmth", () => {
  it("reads as a calm start: no wind planned yet gets one on the first tick", () => {
    const old = withResources(newRun(def), {
      flame: 600,
      lights: 11,
      wmChillSeed: 0,
      wmChillIn: 0,
    });
    const next = tick(def, { ...old, phase: 3 }, 1);
    expect(next.resources.wmChillIn).toBeGreaterThan(0);
    expect(warmthOf(next)).toBeGreaterThan(0);
  });
});

describe("the rain barrel refund", () => {
  it("pays back what was paid, price cuts and all", () => {
    const id = Object.keys(REMOVED_LAST_COSTS)[0];
    const owns = (costMult?: number): RunState => {
      const run = withResources(start(), { resolve: 0 });
      run.owned[id] = 1;
      if (costMult !== undefined) run.mods.costMult = costMult;
      return run;
    };
    const full = REMOVED_LAST_COSTS[id] * REMOVED_LAST_SCALE;
    const plain = tick(def, owns(), 0.01);
    expect(plain.resources.resolve).toBeGreaterThanOrEqual(full);
    expect(plain.owned[id]).toBeUndefined();
    const cheaper = tick(def, owns(0.5), 0.01);
    expect(cheaper.resources.resolve).toBeGreaterThanOrEqual(full * 0.5);
    expect(cheaper.resources.resolve).toBeLessThan(full * 0.6);
  });
});

describe("the lights' own seed", () => {
  it("never falls back on a stream the player's taps move", () => {
    const bare = withResources(start(), { wmSeed: 0, nightSeed: 0, hbSeed: 0 });
    const a = { ...bare, rng: 111 };
    const b = { ...bare, rng: 987654 };
    expect(burnOf(a, 3)).toBe(burnOf(b, 3));
    expect(companyOf(a, 3)).toBe(companyOf(b, 3));
  });
});
