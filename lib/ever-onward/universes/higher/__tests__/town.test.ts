import { canPerformAction, performAction, tick } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import { genericBots } from "../../../engine/bots";
import type { RunState } from "../../../engine/types";
import {
  footingPolicy,
  holdsOvertime,
  placesLoad,
  playsPlayroom,
  playsTown,
  takesFork,
  together,
  type TownStyle,
} from "../bots";
import { FOREMEN, crewPay, pairMult } from "../foremen";
import { sceneInfo } from "../scene";
import { incomePerSecond, manualPerTap } from "../tick";
import {
  DAYS,
  HATS,
  LAMP_ACTION_ID,
  PARK_ACTION_ID,
  darkness,
  dayNext,
  dayNow,
  foremanActionId,
  hatIds,
  isTownOpen,
  lampPrice,
  townPay,
} from "../town";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart, withResources } from "./fixtures";

const T = TUNING.town;

/** A town with a crew in, the dials open, and bricks to spend. */
function town(
  owned: Record<string, number> = { mason: 3 },
  extra: Record<string, number> = {}
): RunState {
  const base = runAtPhaseStart(1);
  return tick(
    def,
    {
      ...base,
      owned,
      resources: { ...base.resources, bricks: 1e12, ...extra },
    },
    0.1
  );
}

const tall = { mason: 6, crane: 5, scaffolding: 3, "cross-braces": 3 };

describe("the foremen", () => {
  it("are six, each with a plus and a minus", () => {
    expect(FOREMEN).toHaveLength(6);
    for (const f of FOREMEN) {
      expect(f.plus.length).toBeGreaterThan(8);
      expect(f.minus.length).toBeGreaterThan(8);
      const gives =
        f.pay > 1 || f.payDark > 0 || f.tap > 1 || f.lean < 1 || f.dark < 1;
      const costs =
        f.pay < 1 || f.tap < 1 || f.lean > 1 || f.dark > 1 || f.payDark > 0;
      expect([f.name, gives, costs]).toEqual([f.name, true, true]);
    }
  });

  it("get on with some and clash with others, the same both ways", () => {
    const likes = FOREMEN.flatMap((a) =>
      FOREMEN.filter((b) => pairMult(a, b) > 1 && a.id < b.id)
    );
    const clashes = FOREMEN.flatMap((a) =>
      FOREMEN.filter((b) => pairMult(a, b) < 1 && a.id < b.id)
    );
    expect(likes.length).toBeGreaterThan(2);
    expect(clashes.length).toBeGreaterThan(2);
    for (const a of FOREMEN)
      for (const b of FOREMEN) expect(pairMult(a, b)).toBe(pairMult(b, a));
  });

  it("make a trio that gets on pay more than the same pay from one that clashes", () => {
    // Sal and Kim clash; Sal and Tess get on.
    const clash = crewPay([1, 2], 0);
    const like = crewPay([1, 3], 0);
    expect(clash / (1.18 * 0.9 * T.regularPay)).toBeCloseTo(T.pairClash, 5);
    expect(like / (1.18 * 0.92 * T.regularPay)).toBeCloseTo(T.pairLike, 5);
  });

  it("open with the dials, three hats wearing the regular foreman", () => {
    const run = town();
    expect(isTownOpen(run)).toBe(true);
    expect(hatIds(run)).toEqual([0, 0, 0]);
    expect(HATS).toBe(3);
    expect(isTownOpen(runAtPhaseStart(1))).toBe(false);
  });

  it("take a whole shift to swap: the hat stands empty, then the new foreman arrives", () => {
    let run = performAction(def, town(), foremanActionId(0, 1));
    expect(hatIds(run)[0]).toBe(0);
    expect(run.resources.tfP0).toBe(1);
    for (let t = 0; t < T.shiftSeconds - 2; t += 1) run = tick(def, run, 1);
    expect(hatIds(run)[0]).toBe(0);
    expect(run.resources.tfP0).toBe(1);
    for (let t = 0; t < 4; t += 1) run = tick(def, run, 1);
    expect(hatIds(run)[0]).toBe(1);
    expect(run.resources.tfP0).toBe(0);
  });

  it("cannot be on two hats, and a hat cannot be changed while it waits", () => {
    const run = performAction(def, town(), foremanActionId(0, 1));
    expect(canPerformAction(def, run, foremanActionId(1, 1))).toBe(false);
    expect(canPerformAction(def, run, foremanActionId(0, 2))).toBe(false);
    expect(canPerformAction(def, run, foremanActionId(1, 2))).toBe(true);
  });

  it("move what the crew and the taps pay", () => {
    const worn = (id: number): RunState => ({
      ...town({ mason: 4 }),
      resources: { ...town({ mason: 4 }).resources, tfH0: id },
    });
    expect(incomePerSecond(worn(1))).toBeGreaterThan(incomePerSecond(worn(2)));
    expect(manualPerTap(worn(3))).toBeGreaterThan(manualPerTap(worn(6)) * 4);
  });
});

describe("the shadow", () => {
  it("grows with the height of the tower and takes pay away", () => {
    const low = town({ mason: 3 });
    const high = town(tall);
    expect(darkness(high)).toBeGreaterThan(darkness(low) + 0.3);
    expect(townPay(high)).toBeLessThan(townPay(low));
  });

  it("is eased by lamps and by the park, for bricks", () => {
    const run = town(tall);
    const before = darkness(run);
    const lit = performAction(def, run, LAMP_ACTION_ID);
    expect(darkness(lit)).toBeLessThan(before);
    expect(lit.resources.bricks).toBeCloseTo(
      run.resources.bricks - lampPrice(run),
      0
    );
    const park = performAction(def, lit, PARK_ACTION_ID);
    expect(darkness(park)).toBeLessThan(darkness(lit));
    expect(performAction(def, park, PARK_ACTION_ID)).toBe(park);
    const poor = withResources(run, { bricks: 1 });
    expect(canPerformAction(def, poor, LAMP_ACTION_ID)).toBe(false);
  });

  it("costs more for each lamp, and lights three of them", () => {
    let run = town(tall);
    const prices: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      prices.push(lampPrice(run));
      run = performAction(def, run, LAMP_ACTION_ID);
    }
    expect(prices[1]).toBeGreaterThan(prices[0]);
    expect(prices[2]).toBeGreaterThan(prices[1]);
    expect(canPerformAction(def, run, LAMP_ACTION_ID)).toBe(false);
  });

  it("is deeper on a night shift and lifted by Lantern Lou", () => {
    const run = town({ mason: 5, crane: 2, scaffolding: 1 });
    const night = withResources(run, { twDay: 2 });
    expect(dayNow(night).id).toBe("night");
    expect(darkness(night)).toBeGreaterThan(darkness(run));
    expect(
      darkness({ ...run, resources: { ...run.resources, tfH0: 4 } })
    ).toBeLessThan(darkness(run) * 0.5);
  });

  it("is something Night-owl Olly works in: he pays more in the dark and less in the light", () => {
    const olly = (run: RunState): number =>
      crewPay([5], darkness(run)) / crewPay([], darkness(run));
    expect(olly(town(tall))).toBeGreaterThan(olly(town({ mason: 3 })));
  });
});

describe("the day", () => {
  it("starts quiet, announces tomorrow, and changes on a clock of its own", () => {
    let run = town();
    expect(dayNow(run).id).toBe("quiet");
    const tomorrow = dayNext(run);
    expect(tomorrow.id).not.toBe("quiet");
    for (let t = 0; t < T.daySeconds + 2; t += 1) run = tick(def, run, 1);
    expect(dayNow(run).id).toBe(tomorrow.id);
    expect(dayNext(run).id).not.toBe(dayNow(run).id);
    expect(run.rng).toBe(runAtPhaseStart(1).rng);
  });

  it("moves the best answer: a windy day leans harder, a market day pays taps, a festival pays for light", () => {
    const base = town(tall);
    const on = (twDay: number): RunState => withResources(base, { twDay });
    const lean = (r: RunState): number =>
      incomePerSecond({ ...r, resources: { ...r.resources, sway: 1 } });
    expect(DAYS.map((d) => d.id)).toEqual([
      "quiet",
      "market",
      "night",
      "windy",
      "festival",
    ]);
    expect(manualPerTap(on(1))).toBeCloseTo(
      manualPerTap(on(0)) * T.marketTap,
      4
    );
    const lit = performAction(def, base, LAMP_ACTION_ID);
    const fest = withResources(lit, { twDay: 4 });
    expect(incomePerSecond(fest) / incomePerSecond(lit)).toBeCloseTo(
      1 + T.festivalPerLit,
      4
    );
    expect(incomePerSecond(on(4))).toBeCloseTo(incomePerSecond(on(0)), 4);
    expect(lean(on(3))).toBeGreaterThan(0);
  });
});

describe("the picture", () => {
  it("draws the crew, the shadow, the lamps and the day from a few flat numbers", () => {
    const run = withResources(town(tall), {
      tfH0: 1,
      tfH1: 2,
      tfH2: 0,
      twLamps: 2,
      twPark: 1,
      twDay: 3,
    });
    const info = sceneInfo(run);
    expect(info.crew).toBe("120");
    expect(info.lamps).toBe(2);
    expect(info.park).toBe(true);
    expect(info.day).toBe(3);
    expect(info.shade).toBeGreaterThan(0);
    expect(sceneInfo(town()).shade).toBeLessThanOrEqual(1);
  });

  it("shows a hat toss and an arrival for a swap, and the lights coming on", () => {
    let run = performAction(def, town(tall), foremanActionId(1, 3));
    let info = sceneInfo(run);
    expect(info.tossed).toBeGreaterThan(0);
    expect(info.tossHat).toBe(1);
    expect(info.waiting).toBe(2);
    for (let t = 0; t < T.shiftSeconds + 1; t += 1) run = tick(def, run, 1);
    info = sceneInfo(run);
    expect(info.arrived).toBe(3);
    expect(info.arriveHat).toBe(1);
    expect(info.crew[1]).toBe("3");
    run = performAction(def, run, LAMP_ACTION_ID);
    expect(sceneInfo(run).lit).toBe(true);
  });
});

jest.setTimeout(600_000);

describe("no one setting wins the town (foremen, lights and pace, played by the simulator)", () => {
  const base = genericBots(def).realistic;
  const seeds = [1];

  /** Minutes the realistic player takes to finish the Town with this style. */
  function minutes(style: TownStyle): number {
    const strategy: Strategy = {
      ...base,
      actions: together(
        takesFork(),
        placesLoad(15),
        footingPolicy(1, 20),
        holdsOvertime,
        playsPlayroom({ pace: "plan", bank: "reads" }, 1),
        playsTown(style, 1)
      ),
    };
    const times = seeds.map((seed) => {
      const result = simulate(def, {
        maxSeconds: 4 * 3600,
        step: 1,
        seed,
        stopWhen: (run) => run.phase > 1,
        strategy,
      });
      return (result.endTime - (result.phases[0]?.t ?? 0)) / 60;
    });
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  const adjusts = minutes({ pace: "plan", crew: "adjusts", lights: "adjusts" });

  it("beats every fixed trio of foremen (the best few of the twenty, and the lazy ones)", () => {
    const trios: number[][] = [
      [1, 3, 4],
      [1, 3, 5],
      [1, 4, 5],
      [1, 4, 6],
      [1, 5, 6],
      [2, 3, 4],
      [2, 4, 6],
      [4, 5, 6],
    ];
    for (const crew of trios)
      expect([
        crew.join(""),
        minutes({ pace: "plan", crew, lights: "adjusts" }) > adjusts * 1.04,
      ]).toEqual([crew.join(""), true]);
  });

  it("is not beaten by never lighting the town, or by lighting it all as soon as it can", () => {
    expect(
      minutes({ pace: "plan", crew: "adjusts", lights: "never" })
    ).toBeGreaterThanOrEqual(adjusts * 0.995);
    expect(
      minutes({ pace: "plan", crew: "adjusts", lights: "always" })
    ).toBeGreaterThanOrEqual(adjusts * 0.995);
  });

  it("beats every fixed pace, and doing nothing at all costs far more", () => {
    for (const pace of [0, 1, 2, 3])
      expect(
        minutes({ pace, crew: "adjusts", lights: "adjusts" })
      ).toBeGreaterThan(adjusts * 1.02);
    expect(minutes({ pace: 1, crew: "none", lights: "never" })).toBeGreaterThan(
      adjusts * 1.2
    );
  });
});
