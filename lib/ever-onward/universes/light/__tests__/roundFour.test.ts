import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  manualGain,
  newRun,
  performAction,
  reconcileRun,
  tick,
  upgradeCost,
  visibleTeasers,
} from "../../../engine/engine";
import { newSave, parseSave } from "../../../engine/save";
import type { RunState, UpgradeDef } from "../../../engine/types";
import { def } from "./fixtures";
import { TUNING } from "../tuning";
import { litCount, warmthOf } from "../warmth";
import {
  WEATHER_OPEN_FLAG,
  WEATHER_VANE_ID,
  chanceOf,
  lastStorm,
  POST_WATCH,
  crewPostActionId,
  weatherStage,
} from "../weather";
import {
  REMOVED_LAST_COSTS,
  REMOVED_LAST_SCALE,
  REMOVED_SKY_COSTS,
  REMOVED_SKY_SCALE,
} from "../costs";

const RACING_FINS_ID = "fins-1";
const MISSION_CONTROL_ID = "mission-control";
const RAIN_BARREL_ID = "rain-barrel";

const upgrade = (id: string): UpgradeDef =>
  def.upgrades.find((u) => u.id === id)!;
const shown = (id: string, run: RunState): boolean =>
  upgrade(id).visibleWhen?.(run) ?? true;

const wait = (run: RunState, seconds: number, step = 1): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += step) next = tick(def, next, step);
  return next;
};

const at = (
  phase: number,
  owned: Record<string, number> = {},
  resources: Record<string, number> = {},
  flags: Record<string, boolean> = {}
): RunState => {
  const base = newRun(def);
  return {
    ...base,
    phase,
    owned,
    flags: { ...base.flags, ...flags },
    resources: { ...base.resources, ...resources },
  };
};

describe("every beat can still be reached (Round 4 lowered some caps)", () => {
  const dir = join(__dirname, "..");
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => [f, readFileSync(join(dir, f), "utf8")] as const);
  const pattern = /(?:owned|level)\(run, "([\w-]+)"\) (>=|>) (\d+)/g;

  it("never asks for more levels of an upgrade than it has", () => {
    let checked = 0;
    for (const [file, text] of sources) {
      for (const [, id, op, n] of text.matchAll(pattern)) {
        const u = def.upgrades.find((x) => x.id === id);
        expect({ file, id, exists: u !== undefined }).toEqual({
          file,
          id,
          exists: true,
        });
        const max = u!.maxLevel ?? 1;
        const needed = op === ">=" ? Number(n) : Number(n) + 1;
        expect({ file, id, needed, ok: needed <= max }).toEqual({
          file,
          id,
          needed,
          ok: true,
        });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("tells the lens story and shows the lighthouse teaser at the new lens cap", () => {
    const lensMax = upgrade("lens").maxLevel!;
    const run = wait(at(0, { lens: lensMax }, { ships: 20 }), 2);
    expect(run.story).toContain("coast-lens");
    expect(visibleTeasers(def, run).map((t) => t.upgradeId)).toContain(
      "lighthouse"
    );
  });
});

describe("old saves with levels above today's caps", () => {
  const refund = (id: string, from: number, to: number, run: RunState) => {
    let sum = 0;
    for (let level = to; level < from; level += 1)
      sum += upgradeCost({ ...run, owned: { [id]: level } }, upgrade(id));
    return sum;
  };

  it("clamps the levels and gives back what they cost, in the phase's currency", () => {
    const old = at(0, { lens: 5, keeper: 2 }, { coins: 100 });
    const loaded = reconcileRun(def, old);
    expect(loaded.owned.lens).toBe(3);
    expect(loaded.owned.keeper).toBe(2);
    expect(loaded.resources.coins).toBeCloseTo(
      100 + refund("lens", 5, 3, old),
      6
    );
    expect(Number.isFinite(loaded.resources.coins)).toBe(true);
  });

  it("only clamps an upgrade from a phase that is over (its money is gone)", () => {
    const old = at(1, { lens: 5, crank: 5 }, { coins: 7, power: 50 });
    const loaded = reconcileRun(def, old);
    expect(loaded.owned.lens).toBe(3);
    expect(loaded.owned.crank).toBe(2);
    expect(loaded.resources.coins).toBe(7);
    expect(loaded.resources.power).toBeCloseTo(
      50 + refund("crank", 5, 2, old),
      6
    );
  });

  it("survives a real save round trip, with no NaN and no 'Level 5 of 3'", () => {
    const run = at(2, { aim: 5, collector: 2 }, { energy: 10 });
    const save = newSave();
    save.universes.light = {
      run,
      best: null,
      completions: 0,
      embers: 0,
      prestigeUpgrades: {},
    };
    const parsed = parseSave(JSON.parse(JSON.stringify(save)))!;
    const loaded = reconcileRun(def, parsed.universes.light.run);
    for (const u of def.upgrades)
      expect(loaded.owned[u.id] ?? 0).toBeLessThanOrEqual(u.maxLevel ?? 1);
    for (const value of Object.values(loaded.resources))
      expect(Number.isNaN(value)).toBe(false);
    expect(loaded.resources.energy).toBeGreaterThan(10);
    // a second load gives nothing more
    expect(reconcileRun(def, loaded).resources.energy).toBe(
      loaded.resources.energy
    );
  });
});

describe("side-machine helpers arrive mid-life, and hands still pay more", () => {
  it("the weather vane shows after two fronts (no crews needed), and a hand shield pays more", () => {
    const flags = { [WEATHER_OPEN_FLAG]: true };
    expect(shown(WEATHER_VANE_ID, at(1, {}, { wxFronts: 1 }, flags))).toBe(
      false
    );
    expect(shown(WEATHER_VANE_ID, at(1, {}, { wxFronts: 2 }, flags))).toBe(
      true
    );

    let run = tick(
      def,
      at(1, { gen1: 5, gen2: 3, [WEATHER_VANE_ID]: 1 }, { power: 1000 }),
      1
    );
    for (let t = 0; t < 600 && weatherStage(run) !== "forecast"; t += 1)
      run = tick(def, run, 1);
    const likeliest = [0, 1, 2].sort(
      (a, b) => chanceOf(run, b) - chanceOf(run, a)
    )[0];
    const sure = {
      ...run,
      resources: {
        ...run.resources,
        ...Object.fromEntries(
          [0, 1, 2].flatMap((t) => [
            [`wxChance${t}`, t === likeliest ? 100 : 0],
            [`wxBase${t}`, t === likeliest ? 100 : 0],
          ])
        ),
        wxTarget: likeliest,
      },
    };
    const land = (r: RunState) => {
      let next = r;
      for (let t = 0; t < 600 && weatherStage(next) === "forecast"; t += 1)
        next = tick(def, next, 1);
      return next;
    };
    const byVane = land(sure);
    const sent = performAction(
      def,
      sure,
      crewPostActionId(0, POST_WATCH + likeliest)
    );
    const byHand = land({
      ...sent,
      resources: { ...sent.resources, [`wxReady${likeliest}`]: 1 },
    });
    expect(lastStorm(byHand).payout).toBeGreaterThan(lastStorm(byVane).payout);
  });

  it("an old save's racing fins and mission control are paid back in the sky, once", () => {
    const run = tick(
      def,
      at(
        2,
        {
          collector: 5,
          probe: 1,
          [RACING_FINS_ID]: 1,
          [MISSION_CONTROL_ID]: 1,
        },
        { energy: 0 }
      ),
      1
    );
    const paid =
      (REMOVED_SKY_COSTS[RACING_FINS_ID] +
        REMOVED_SKY_COSTS[MISSION_CONTROL_ID]) *
      REMOVED_SKY_SCALE;
    expect(run.owned[RACING_FINS_ID]).toBeUndefined();
    expect(run.owned[MISSION_CONTROL_ID]).toBeUndefined();
    expect(run.resources.energy).toBeGreaterThanOrEqual(paid);
    expect(tick(def, run, 1).resources.energy).toBeLessThan(paid * 1.5);
  });

  it("pays back the cut rain barrel at what it cost, once, in the last part", () => {
    const run = tick(
      def,
      at(3, { [RAIN_BARREL_ID]: 1 }, { resolve: 0, lights: 11 }),
      1
    );
    expect(run.owned[RAIN_BARREL_ID]).toBeUndefined();
    expect(run.resources.resolve).toBeGreaterThanOrEqual(
      REMOVED_LAST_COSTS[RAIN_BARREL_ID] * REMOVED_LAST_SCALE
    );
    const again = tick(def, run, 1);
    expect(again.resources.resolve).toBeLessThan(
      run.resources.resolve + REMOVED_LAST_COSTS[RAIN_BARREL_ID]
    );
  });

  it("keeps the lights an old save already let go gone, and starts a save with no warmth numbers cold-free", () => {
    const old = tick(
      def,
      at(3, { "letgo-porch": 1, "letgo-signs": 1 }, { lights: 9, flame: 500 }),
      1
    );
    expect(litCount(old)).toBe(9);
    expect(old.resources.lights).toBe(9);
    expect(warmthOf(old)).toBeGreaterThan(0);
  });
});

describe("the flame", () => {
  it("still answers a tap when it is full: the tap earns a little resolve", () => {
    const full = at(3, {}, { flame: TUNING.last.flameFull, lights: 11 });
    expect(warmthOf(full)).toBe(1);
    // TapButton shows a "+gain" floater whenever this is above 0
    expect(manualGain(def, full)).toBeGreaterThan(0);
  });
});
