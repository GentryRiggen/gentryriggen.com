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
import { flameOf } from "../tick";
import {
  HAUL_ACTION,
  SET_NETS_ACTION,
  TIDE_MILL_ID,
  TIDE_OPEN_FLAG,
  netState,
} from "../tide";
import {
  WEATHER_OPEN_FLAG,
  WEATHER_VANE_ID,
  chanceOf,
  lastStorm,
  shieldActionId,
  weatherStage,
} from "../weather";
import {
  MISSION_CONTROL_ID,
  PROBES_OPEN_FLAG,
  RACING_FINS_ID,
  isProbeOut,
  launchActionId,
} from "../probes";
import {
  PICK_ACTION,
  RAIN_BARREL_ID,
  WATER_ACTION,
  picksSoFar,
  progressOf,
} from "../garden";

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
  it("the tide mill shows after two hauls, and tending beats the mill alone", () => {
    const flags = { [TIDE_OPEN_FLAG]: true };
    const nets = { "nets-1": 1 };
    expect(shown(TIDE_MILL_ID, at(0, nets, { tdHauls: 1 }, flags))).toBe(false);
    expect(shown(TIDE_MILL_ID, at(0, nets, { tdHauls: 2 }, flags))).toBe(true);

    const milled = tick(
      def,
      at(
        0,
        { keeper: 6, "dock-1": 1, ...nets, [TIDE_MILL_ID]: 1 },
        { oil: 999 }
      ),
      1
    );
    const cycle = TUNING.tide.cycleSeconds;
    let tended = performAction(def, milled, SET_NETS_ACTION);
    for (let t = 0; t < cycle * 2; t += 1) {
      tended = tick(def, tended, 1);
      if (netState(tended) === "full")
        tended = performAction(def, tended, HAUL_ACTION);
      if (netState(tended) === "empty")
        tended = performAction(def, tended, SET_NETS_ACTION);
    }
    const alone = wait(milled, cycle * 2);
    expect(tended.resources.coins).toBeGreaterThan(alone.resources.coins);
  });

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
    const sent = performAction(def, sure, shieldActionId(likeliest));
    const byHand = land({
      ...sent,
      resources: { ...sent.resources, [`wxReady${likeliest}`]: 1 },
    });
    expect(lastStorm(byHand).payout).toBeGreaterThan(lastStorm(byVane).payout);
  });

  it("racing fins show after one run home, then mission control; hand plus scout beats the scout", () => {
    const flags = { [PROBES_OPEN_FLAG]: true };
    expect(shown(RACING_FINS_ID, at(2, {}, { prRuns: 0 }, flags))).toBe(false);
    expect(shown(RACING_FINS_ID, at(2, {}, { prRuns: 1 }, flags))).toBe(true);
    expect(shown(MISSION_CONTROL_ID, at(2, {}, {}, flags))).toBe(false);
    expect(
      shown(MISSION_CONTROL_ID, at(2, { [RACING_FINS_ID]: 1 }, {}, flags))
    ).toBe(true);

    const open = tick(
      def,
      at(2, { collector: 5, probe: 1, "nav-1": 1, [MISSION_CONTROL_ID]: 1 }),
      0.1
    );
    const short = launchActionId(0);
    let both = performAction(def, open, short);
    let scoutOnly = performAction(def, open, short);
    for (let t = 0; t < 600; t += 1) {
      both = tick(def, both, 1);
      scoutOnly = tick(def, scoutOnly, 1);
      if (!isProbeOut(both)) both = performAction(def, both, short);
    }
    expect(both.resources.energy).toBeGreaterThan(scoutOnly.resources.energy);
  });

  it("the rain barrel shows after three real picks, and watering by hand still helps", () => {
    let run = at(3, {}, { resolve: 5000, lights: 12, flame: 600 });
    for (const id of ["letgo-porch", "letgo-signs", "letgo-stadium"])
      run = {
        ...run,
        owned: { ...run.owned, [id]: 1 },
        resources: { ...run.resources, lights: run.resources.lights - 1 },
      };
    run = wait(run, TUNING.garden.growSeconds + 5);
    expect(shown(RAIN_BARREL_ID, run)).toBe(false);
    run = performAction(def, run, PICK_ACTION);
    expect(picksSoFar(run)).toBe(3);
    expect(shown(RAIN_BARREL_ID, run)).toBe(true);

    const barrel: RunState = {
      ...run,
      owned: { ...run.owned, [RAIN_BARREL_ID]: 1 },
    };
    let watered = barrel;
    // a stretch short enough that nothing is back in bloom yet
    for (let t = 0; t < 80; t += 1) {
      watered = tick(def, watered, 1);
      watered = performAction(def, watered, WATER_ACTION);
    }
    const alone = wait(barrel, 80);
    const growth = (r: RunState) =>
      [0, 1, 2].reduce((sum, plot) => sum + progressOf(r, plot), 0);
    expect(growth(watered)).toBeGreaterThan(growth(alone));
  });
});

describe("the flame", () => {
  it("still answers a tap when it is full: the tap lets go a little", () => {
    const full = at(3, {}, { flame: TUNING.last.flameFull, lights: 12 });
    expect(flameOf(full)).toBe(TUNING.last.flameFull);
    // TapButton shows a "+gain" floater whenever this is above 0
    expect(manualGain(def, full)).toBeGreaterThan(0);
  });
});
