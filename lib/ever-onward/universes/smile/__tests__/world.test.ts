import { genericBots } from "../../../engine/bots";
import {
  cloneRun,
  performAction,
  startProject,
  tick,
} from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { followsTheDay, holdsLevel, takesProjects, worldPlayer } from "../bots";
import { sceneInfo } from "../scene";
import { smileGauge } from "../gauge";
import { TUNING } from "../tuning";
import {
  DAY_FESTIVAL,
  DAY_GLOOM,
  DAY_WEARY,
  LEVEL_COUNT,
  LEVEL_LABELS,
  bandOf,
  dayKind,
  isRetuning,
  isWorldOpen,
  keptOf,
  levelActionId,
  levelCard,
  levelOf,
  netAt,
  payAt,
  paintAt,
  quietOpeningLine,
  realOf,
  worldPay,
} from "../world";
import { def, runAtPhaseStart } from "./fixtures";

const W = TUNING.world;

const advance = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

/** A world with a loudspeaker, so the dial is open. */
function openWorld(): RunState {
  const start = runAtPhaseStart(2);
  const run = {
    ...cloneRun(start),
    owned: { ...start.owned, poster: 4, loudspeaker: 2 },
  };
  return advance(run, 1);
}

const withDay = (run: RunState, kind: number): RunState => ({
  ...run,
  resources: { ...run.resources, wsDay: kind, wsDayLeft: 60 },
});

describe("The world's dial: real smiles and painted smiles", () => {
  it("opens with the first loudspeaker and starts with every smile real", () => {
    const start = runAtPhaseStart(2);
    expect(isWorldOpen(start)).toBe(false);
    expect(realOf(start)).toBe(1);
    const run = openWorld();
    expect(isWorldOpen(run)).toBe(true);
    expect(realOf(run)).toBe(1);
    expect(levelOf(run)).toBe(W.startLevel);
  });

  it("reads a save from before as every smile real", () => {
    const old = {
      ...runAtPhaseStart(2),
      resources: {} as Record<string, number>,
    };
    expect(realOf(old)).toBe(1);
    expect(worldPay(old)).toBe(1);
    expect(sceneInfo(old).real).toBe(10);
  });

  describe("every level shows its plus and its minus, and never says which is best", () => {
    it("pays more the louder it is, and paints more", () => {
      const run = openWorld();
      for (let level = 1; level < LEVEL_COUNT; level += 1) {
        expect(payAt(run, level)).toBeGreaterThan(payAt(run, level - 1));
        expect(netAt(run, level)).toBeLessThan(netAt(run, level - 1));
      }
      expect(netAt(run, 0)).toBeGreaterThan(0);
      expect(netAt(run, LEVEL_COUNT - 1)).toBeLessThan(0);
    });

    it("has a card with both lines, and no word that gives the answer away", () => {
      const run = openWorld();
      for (let level = 0; level < LEVEL_COUNT; level += 1) {
        const card = levelCard(run, level);
        const text = `${card.label} ${card.plus} ${card.minus}`;
        expect(card.plus.length).toBeGreaterThan(0);
        expect(card.minus.length).toBeGreaterThan(0);
        expect(text).toMatch(/Grins ×/);
        expect(text).toMatch(/Real smiles [+−]/);
        expect(text).not.toMatch(/best|recommend|should|better|worse|wrong/i);
      }
    });
  });

  describe("the dial is a commitment", () => {
    it("takes a moment to retune and pays half meanwhile", () => {
      let run = openWorld();
      const plain = worldPay(run);
      run = performAction(def, run, levelActionId(4));
      expect(isRetuning(run)).toBe(true);
      expect(levelOf(run)).toBe(W.startLevel);
      expect(worldPay(run)).toBeCloseTo(plain * W.retunePay);
      expect(performAction(def, run, levelActionId(0))).toBe(run);
      run = advance(run, W.retuneSeconds + 1);
      expect(isRetuning(run)).toBe(false);
      expect(levelOf(run)).toBe(4);
    });
  });

  describe("real smiles", () => {
    it("get painted over at a loud level and come back at a quiet one", () => {
      let run = openWorld();
      run = performAction(def, run, levelActionId(4));
      run = advance(run, W.retuneSeconds + 60);
      const low = realOf(run);
      expect(low).toBeLessThan(0.9);
      run = performAction(def, run, levelActionId(0));
      run = advance(run, W.retuneSeconds + 60);
      expect(realOf(run)).toBeGreaterThan(low);
    });

    it("never fall under the floor", () => {
      let run = openWorld();
      run = performAction(def, run, levelActionId(4));
      run = advance(run, 900);
      expect(realOf(run)).toBeCloseTo(W.floor);
      expect(bandOf(realOf(run))).toBe(0);
    });

    it("show on the HUD as a gauge that warns when most are painted", () => {
      const run = openWorld();
      expect(smileGauge(run)).toMatchObject({ label: "REAL", status: "" });
      const painted = { ...run, resources: { ...run.resources, wsReal: 0.2 } };
      expect(smileGauge(painted)).toMatchObject({
        label: "REAL",
        status: "PAINTED",
        isLow: true,
      });
    });
  });

  describe("the world moves the best level", () => {
    it("a festival pays loud more and paints it less", () => {
      const run = openWorld();
      const fest = withDay(run, DAY_FESTIVAL);
      expect(dayKind(fest)).toBe(DAY_FESTIVAL);
      expect(payAt(fest, 4)).toBeGreaterThan(payAt(run, 4));
      expect(payAt(fest, 1)).toBe(payAt(run, 1));
      expect(paintAt(fest, 4)).toBeLessThan(paintAt(run, 4));
    });

    it("a gloomy week paints twice as fast", () => {
      const run = openWorld();
      expect(paintAt(withDay(run, DAY_GLOOM), 3)).toBeCloseTo(
        paintAt(run, 3) * W.gloomPaint
      );
    });

    it("crowds tired of noise pay loud much less, and only loud", () => {
      const run = openWorld();
      const weary = withDay(run, DAY_WEARY);
      expect(payAt(weary, 4)).toBeLessThan(payAt(weary, 2));
      expect(payAt(weary, 2)).toBe(payAt(run, 2));
    });

    it("brings days of every kind, from its own random stream", () => {
      const seen = new Set<number>();
      let run = openWorld();
      for (let t = 0; t < 1200; t += 1) {
        run = tick(def, run, 1);
        seen.add(dayKind(run));
      }
      expect(seen).toEqual(new Set([0, DAY_FESTIVAL, DAY_GLOOM, DAY_WEARY]));
    });
  });

  describe("projects", () => {
    const rich = (run: RunState): RunState => ({
      ...run,
      owned: { ...run.owned, "cheer-tower": 1, poster: 5 },
      resources: { ...run.resources, knowhow: 1e6 },
      revealed: [...run.revealed],
    });

    it("HypnoDrones pay hugely and paint a lot of faces at once, for good", () => {
      const run = advance(rich(openWorld()), 1);
      const before = worldPay(run);
      const done = startProject(def, run, "hypno-drones");
      expect(done).not.toBe(run);
      expect(worldPay(done)).toBeGreaterThan(before * 2);
      expect(realOf(done)).toBeLessThanOrEqual(
        realOf(run) - W.dronesLoss + 1e-9
      );
      expect(paintAt(done, 0)).toBeGreaterThan(paintAt(run, 0));
      expect(sceneInfo(done).droneKey).toBeGreaterThan(0);
    });

    it("the Grin Guide and smile filters cost real smiles too", () => {
      const run = advance(rich(openWorld()), 1);
      const guide = startProject(def, run, "grin-guide");
      expect(realOf(guide)).toBeLessThan(realOf(run));
      const filters = startProject(def, run, "smile-filters");
      expect(worldPay(filters)).toBeGreaterThan(worldPay(run));
      expect(paintAt(filters, 0)).toBeGreaterThan(paintAt(run, 0));
    });

    it("quiet hours protect real smiles and listening benches bring them back, both for less pay", () => {
      const run = advance(rich(openWorld()), 1);
      const hours = startProject(def, run, "quiet-hours");
      expect(paintAt(hours, 3)).toBeLessThan(paintAt(run, 3));
      expect(worldPay(hours)).toBeLessThan(worldPay(run));
      const hurt = { ...run, resources: { ...run.resources, wsReal: 0.4 } };
      const benches = startProject(def, hurt, "listening-benches");
      expect(realOf(benches)).toBeCloseTo(0.4 + W.benchesGain);
      expect(netAt(benches, 2)).toBeGreaterThan(netAt(hurt, 2));
      expect(worldPay(benches)).toBeLessThan(worldPay(hurt));
      expect(sceneInfo(benches).healKey).toBeGreaterThan(0);
    });

    it("every project card shows a plus and a minus", () => {
      const run = advance(rich(openWorld()), 1);
      for (const id of [
        "quiet-hours",
        "smile-filters",
        "grin-guide",
        "hypno-drones",
        "listening-benches",
      ]) {
        const project = def.projects!.find((p) => p.id === id)!;
        const lines = (project.effectPreview!(run) ?? "").split("\n");
        expect(lines.some((l) => l.startsWith("+"))).toBe(true);
        expect(lines.some((l) => l.startsWith("−"))).toBe(true);
        expect(`${project.description} ${project.tradeOff}`).not.toMatch(
          /best|recommend/i
        );
      }
    });
  });

  describe("the Quiet opens with what you kept", () => {
    it("turns kept real smiles into trust from the first minute", () => {
      const start = runAtPhaseStart(2);
      const high = withKept(start, 1);
      const low = withKept(start, 0.1);
      expect(high.resources.trust).toBeGreaterThan(low.resources.trust * 4);
      expect(high.resources.trust).toBeCloseTo(W.quietHeadStart * 100);
      expect(keptOf(high)).toBe(1);
      expect(keptOf(low)).toBeCloseTo(0.1);
      expect(quietOpeningLine(high)).toMatch(/100% of the world's smiles/);
      expect(quietOpeningLine(low)).toMatch(/Only 10%/);
    });
  });
});

/** The run as it is when the world ends with `real` smiles left, and the Quiet opens. */
function withKept(start: RunState, real: number): RunState {
  const run = cloneRun(start);
  run.resources.wsReal = real;
  run.flags["world-open"] = true;
  const last = def.phases.length - 1;
  const next = cloneRun(run);
  next.phase = last;
  def.phases[last].onEnter?.(next);
  return next;
}

describe("The frontier: finishing fast costs real smiles, keeping them costs time", () => {
  const base = genericBots(def).tapper;
  const hard: Strategy = { ...base, tapRate: () => 6 };
  const entry = runAtPhaseStart(2);
  const SEEDS = [1, 2, 3];

  interface Outcome {
    world: number;
    kept: number;
    total: number;
  }

  function play(make: () => Strategy): Outcome {
    const outcomes = SEEDS.map((seed): Outcome => {
      const startRun = cloneRun(entry);
      startRun.rng = seed * 7919;
      let kept = -1;
      let leftAt = 0;
      const result = simulate(def, {
        maxSeconds: 8 * 3600,
        step: 1,
        startRun,
        strategy: make(),
        stopWhen: (run) => {
          if (run.phase >= 3 && kept < 0) {
            kept = keptOf(run);
            leftAt = run.time;
          }
          return run.complete;
        },
      });
      return {
        world: (leftAt - entry.time) / 60,
        kept,
        total: (result.endTime - entry.time) / 60,
      };
    });
    const mean = (pick: (o: Outcome) => number): number =>
      outcomes.reduce((sum, o) => sum + pick(o), 0) / outcomes.length;
    return {
      world: mean((o) => o.world),
      kept: mean((o) => o.kept),
      total: mean((o) => o.total),
    };
  }

  const DRONE_TASTE = [
    "hypno-drones",
    "listening-benches",
    "grin-guide",
    "every-language",
    "quiet-hours",
  ];
  /** A player who takes the drones' projects and plays the dial as `dial`. */
  function withProjects(
    dial: NonNullable<Strategy["actions"]>,
    taste: string[],
    worldSide?: 0 | 1
  ): Strategy {
    const strategy = worldPlayer(hard, dial, "greedy", worldSide);
    const fallback = takesProjects("greedy");
    strategy.projects = (run, shown) =>
      run.phase !== 2
        ? (fallback as (r: RunState, p: typeof shown) => string[])(run, shown)
        : taste.filter((id) => shown.some((p) => p.id === id));
    return strategy;
  }
  /** Loudest for `minutes` of the world, then Hushed to let them heal. */
  function greedyThenHushed(minutes: number): Strategy {
    const start = entry.time;
    return withProjects((run, available) => {
      if (!isWorldOpen(run) || isRetuning(run)) return [];
      const id = levelActionId((run.time - start) / 60 < minutes ? 4 : 0);
      return levelOf(run) !== Number(id.slice(3)) && available.includes(id)
        ? [id]
        : [];
    }, DRONE_TASTE);
  }

  const policies = {
    hushed: () => worldPlayer(hard, holdsLevel(0), "steady"),
    loudest: () => worldPlayer(hard, holdsLevel(4), "steady"),
    onTime: () =>
      worldPlayer(
        hard,
        followsTheDay({ base: 4, floor: 0, easesInGloom: false }),
        "steady"
      ),
    loud: () => worldPlayer(hard, holdsLevel(2), "steady"),
    keeper: () =>
      worldPlayer(hard, followsTheDay({ base: 2, floor: 0.7 }), "steady"),
    careful: () =>
      worldPlayer(hard, followsTheDay({ base: 2, floor: 0.4 }), "steady"),
    greedy: () => worldPlayer(hard, holdsLevel(4), "greedy"),
    // The ways round the cost: HypnoDrones, then sit at a quiet level and let
    // the real smiles heal (with or without the listening benches).
    hushedDrones: () => withProjects(holdsLevel(0), DRONE_TASTE),
    softDrones: () => withProjects(holdsLevel(1), DRONE_TASTE),
    // The same on the Listening boxes side, where the boxes heal as well.
    hushedBoxesDrones: () => withProjects(holdsLevel(0), DRONE_TASTE, 1),
    softBoxesDrones: () => withProjects(holdsLevel(1), DRONE_TASTE, 1),
    keeperBoxes: () =>
      worldPlayer(hard, followsTheDay({ base: 2, floor: 0.7 }), "steady", 1),
    greedyThenHushed8: () => greedyThenHushed(8),
    greedyThenHushed10: () => greedyThenHushed(10),
    greedyThenHushed12: () => greedyThenHushed(12),
  };

  const results = {} as Record<keyof typeof policies, Outcome>;
  beforeAll(() => {
    for (const key of Object.keys(policies) as (keyof typeof policies)[])
      results[key] = play(policies[key]);
    // The frontier, for the report: minutes in the world, real smiles kept.
    if (process.env.EO_FRONTIER)
      console.table(
        Object.fromEntries(
          Object.entries(results).map(([k, o]) => [
            k,
            {
              worldMin: Number(o.world.toFixed(1)),
              keptPct: Math.round(o.kept * 100),
              totalMin: Number(o.total.toFixed(1)),
            },
          ])
        )
      );
  }, 900_000);

  it("the loudest dial finishes the world fastest and keeps the fewest real smiles of the fixed ones", () => {
    expect(results.loudest.world).toBeLessThan(results.loud.world);
    expect(results.loud.world).toBeLessThan(results.hushed.world);
    expect(results.loudest.kept).toBeLessThan(0.1);
    expect(results.hushed.kept).toBeGreaterThan(0.95);
  });

  it("the quietest dial keeps everything and takes far longer", () => {
    expect(results.hushed.world).toBeGreaterThan(results.loudest.world * 1.8);
  });

  it("neither extreme beats a player who adjusts on time", () => {
    // Adjusting to the day finishes sooner than the loudest dial held for
    // good (the weary days halve its pay), and far sooner than the hushed one.
    expect(results.onTime.world).toBeLessThan(results.loudest.world * 0.99);
    expect(results.onTime.world).toBeLessThan(results.hushed.world * 0.6);
  });

  it("a player who adjusts and minds the real smiles keeps more of them and still beats Loud held for good", () => {
    expect(results.keeper.kept).toBeGreaterThan(results.loud.kept + 0.3);
    expect(results.keeper.world).toBeLessThan(results.loud.world * 1.05);
    expect(results.careful.kept).toBeGreaterThan(results.loud.kept);
  });

  it("the quickest way of all (HypnoDrones) costs every real smile, and saving them costs time", () => {
    expect(results.greedy.world).toBeLessThan(results.careful.world * 0.7);
    expect(results.greedy.kept).toBeLessThan(0.1);
    expect(results.careful.kept).toBeGreaterThan(0.3);
    const ordered = [
      results.greedy,
      results.loudest,
      results.careful,
      results.hushed,
    ];
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].kept).toBeGreaterThanOrEqual(
        ordered[i - 1].kept - 1e-9
      );
      expect(ordered[i].world).toBeGreaterThan(ordered[i - 1].world);
    }
  });

  it("HypnoDrones are not free: sitting at Hushed afterwards does not give the smiles back", () => {
    for (const key of [
      "hushedDrones",
      "softDrones",
      "hushedBoxesDrones",
      "softBoxesDrones",
      "greedyThenHushed8",
      "greedyThenHushed10",
      "greedyThenHushed12",
    ] as const) {
      expect(results[key].kept).toBeLessThan(0.15);
      // No way round: none of them finishes sooner than the player who minds
      // the real smiles and keeps most of them.
      expect(results[key].total).toBeGreaterThan(results.keeper.total + 1.5);
      expect(results[key].total).toBeGreaterThan(results.careful.total);
    }
  });

  it("on the Listening boxes side, HypnoDrones still beat nobody who keeps the smiles", () => {
    for (const key of ["hushedBoxesDrones", "softBoxesDrones"] as const) {
      expect(results[key].total).toBeGreaterThan(results.keeperBoxes.total);
      expect(results[key].total).toBeGreaterThan(results.keeper.total);
    }
  });

  it("keeping the smiles pays off in the Quiet: the minder finishes sooner overall than the greedy player", () => {
    expect(results.keeper.total).toBeLessThan(results.greedy.total);
    expect(results.careful.total).toBeLessThan(results.greedy.total);
    expect(results.keeper.total).toBeLessThan(results.hushed.total);
  });

  it("the Quiet takes longer when the real smiles are gone", () => {
    const quiet = (o: Outcome): number => o.total - o.world;
    expect(quiet(results.greedy)).toBeGreaterThan(quiet(results.hushed));
  });
});

describe("Level names", () => {
  it("has a label for every level", () => {
    expect(LEVEL_LABELS).toHaveLength(LEVEL_COUNT);
    expect(new Set(LEVEL_LABELS).size).toBe(LEVEL_COUNT);
  });
});
