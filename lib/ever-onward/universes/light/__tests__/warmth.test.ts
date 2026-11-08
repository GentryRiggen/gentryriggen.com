import {
  canPerformAction,
  manualAction,
  newRun,
  performAction,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { sceneInfo } from "..";
import { def, runAtPhaseStart } from "./fixtures";
import { TUNING } from "../tuning";
import {
  LIGHT_COUNT,
  SHELTER_ACTION,
  boatPace,
  burnOf,
  burnTotal,
  canLetGo,
  chillForecast,
  chillIn,
  chillMult,
  companyOf,
  flowerNames,
  goodbyeIndex,
  isChillBlowing,
  isLit,
  letGoActionId,
  letGoCount,
  litCount,
  lockLeft,
  lumpNow,
  paceAt,
  resolvePerSecond,
  shelterCost,
  stokeOf,
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
    expect(paceAt(0)).toBeCloseTo(L.boatFloor, 5);
    expect(paceAt(1)).toBeCloseTo(1, 5);
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

  it("stokes a little when tapped, and the stoke fades so mashing gains nothing past a cap", () => {
    let run = start();
    for (let i = 0; i < 100; i += 1) run = manualAction(def, run);
    expect(stokeOf(run)).toBeCloseTo(L.stokeMax, 5);
    expect(stokeOf(wait(run, 20))).toBeLessThan(L.stokeMax);
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
    expect(gone.resources.resolve - before).toBeCloseTo(pays, 5);
    expect(gone.resources.lights).toBe(11);
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

  it("holds a story card back only in a goodbye's first seconds", () => {
    const gone = performAction(def, start(), letGoActionId(4));
    expect(isSceneBusyFor(gone)).toBe(true);
    expect(isSceneBusyFor(wait(gone, 5))).toBe(false);
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

describe("the cold winds", () => {
  it("come from the start seed, whatever the player taps", () => {
    const run = start();
    const tapped = manualAction(def, run);
    expect(tapped.resources.wmChillIn).toBe(run.resources.wmChillIn);
    expect(tapped.resources.wmChillSize).toBe(run.resources.wmChillSize);
    const a = wait(run, 400);
    const b = wait(tapped, 400);
    expect(b.resources.wmChillSize).toBe(a.resources.wmChillSize);
  });

  it("are forecast a little ahead, then blow for a spell", () => {
    let run = start();
    expect(chillForecast(run)).toBeNull();
    // run to just inside the forecast
    run = wait(run, Math.floor(chillIn(run) - L.chill.lead + 1));
    const size = chillForecast(run);
    expect(size).not.toBeNull();
    expect(sceneInfo(run).chill).toBe(1 + (size ?? 0));
    run = wait(run, L.chill.lead + 1);
    expect(isChillBlowing(run)).toBe(true);
    expect(chillMult(run)).toBeGreaterThan(1);
    expect(sceneInfo(run).chill).toBeGreaterThanOrEqual(4);
    run = wait(run, L.chill.seconds + 1);
    expect(isChillBlowing(run)).toBe(false);
  });

  it("make the lights burn harder while they blow", () => {
    const run = start();
    const windy = withResources(run, { wmChillLeft: 20, wmChillSize: 2 });
    expect(warmthTarget(windy)).toBeLessThanOrEqual(warmthTarget(run));
    expect(chillMult(windy)).toBeCloseTo(L.chill.mult[2], 5);
  });

  it("can be cupped against: it costs resolve and the wind bites less", () => {
    let run = withResources(start(), {
      wmChillLeft: 20,
      wmChillSize: 2,
      resolve: 1e6,
    });
    expect(canPerformAction(def, run, SHELTER_ACTION)).toBe(true);
    const bare = chillMult(run);
    const before = run.resources.resolve;
    const cost = shelterCost(run);
    run = performAction(def, run, SHELTER_ACTION);
    expect(before - run.resources.resolve).toBeCloseTo(cost, 5);
    expect(chillMult(run)).toBeLessThan(bare);
    // once per wind
    expect(canPerformAction(def, run, SHELTER_ACTION)).toBe(false);
  });

  it("offers no cupping while the air is still", () => {
    const run = withResources(start(), { resolve: 1e6 });
    expect(canPerformAction(def, run, SHELTER_ACTION)).toBe(false);
  });
});

describe("a save from before the warmth", () => {
  it("reads as a calm start: no wind planned yet gets one on the first tick", () => {
    const old = withResources(newRun(def), {
      flame: 600,
      lights: 12,
      wmChillSeed: 0,
      wmChillIn: 0,
    });
    const next = tick(def, { ...old, phase: 3 }, 1);
    expect(next.resources.wmChillIn).toBeGreaterThan(0);
    expect(warmthOf(next)).toBeGreaterThan(0);
  });
});
