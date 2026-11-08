import {
  canPerformAction,
  manualAction,
  performAction,
  tick,
  upgradeCost,
  visibleActions,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { playsSky, type SkyStyle } from "../skybots";
import {
  NC_START_ACTION_ID,
  NC_STOP_ACTION_ID,
  STRAINS,
  TIE_ACTION_ID,
  canStartNoCrane,
  forecastOf,
  gustIn,
  gustInExact,
  hookOf,
  isBlowing,
  isIdle,
  isNoCrane,
  isSkyMomentBusy,
  isSkyOpen,
  isStrongGust,
  strainStep,
  ncWins,
  skyPay,
  strainActionId,
  tieState,
} from "../sky";
import { sceneInfo } from "../scene";
import { incomePerSecond, manualPerTap } from "../tick";
import { TUNING } from "../tuning";
import { UPGRADES } from "../upgrades";
import { def, runAtPhaseStart, withResources } from "./fixtures";

const K = TUNING.sky;

jest.setTimeout(600_000);

/** A sky with a crew in, the dials open and a cloud crane up. */
function sky(extra: Record<string, number> = {}): RunState {
  const base = runAtPhaseStart(2);
  return tick(
    def,
    {
      ...base,
      owned: { "sky-crew": 5, "cloud-crane": 3, "cable-spinner": 1, alloy: 2 },
      resources: { ...base.resources, beams: 1e9, ...extra },
    },
    0.1
  );
}

/** Ticks until `done` is true (or a limit passes). */
function until(
  run: RunState,
  done: (r: RunState) => boolean,
  limit = 600
): RunState {
  let r = run;
  for (let t = 0; t < limit && !done(r); t += 0.5) r = tick(def, r, 0.5);
  return r;
}

describe("the forecast", () => {
  it("opens with a calm sky and moves clouds, then a sure gust, and shows how long", () => {
    let run = sky();
    expect(forecastOf(run)).toBe(0);
    run = until(run, (r) => forecastOf(r) === 2);
    expect(forecastOf(run)).toBe(2);
    expect(gustIn(run)).toBeGreaterThan(0);
    expect(gustIn(run)).toBeLessThanOrEqual(K.stepSeconds);
    expect(sceneInfo(run).wx).toBe(2);
  });

  it("goes calm, clouds, gust in order, and sometimes clears or stays calm", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed += 1) {
      let run = { ...sky(), rng: seed * 31 + 1 };
      let last = 0;
      for (let t = 0; t < 600; t += 1) {
        run = tick(def, run, 1);
        const wx = forecastOf(run);
        if (wx !== last) seen.add(`${last}>${wx}`);
        last = wx;
      }
    }
    expect(seen.has("0>1")).toBe(true);
    expect(seen.has("1>2")).toBe(true);
    expect(seen.has("1>0")).toBe(true);
    expect(seen.has("0>2")).toBe(false);
  });

  it("knows if the sure gust is light or strong, and the scene says so", () => {
    const strong = until(
      { ...sky(), rng: 5 },
      (r) => forecastOf(r) === 2 && sceneInfo(r).strong
    );
    const light = until(
      { ...sky(), rng: 5 },
      (r) => forecastOf(r) === 2 && !sceneInfo(r).strong,
      2000
    );
    expect(forecastOf(strong)).toBe(2);
    expect(forecastOf(light)).toBe(2);
  });
});

describe("tying down", () => {
  it("takes a moment, earns nothing while tied, and takes a moment to undo", () => {
    let run = sky();
    expect(skyPay(run)).toBeGreaterThan(0);
    run = performAction(def, run, TIE_ACTION_ID);
    expect(tieState(run)).toBe("tying");
    expect(incomePerSecond(run)).toBe(0);
    expect(manualPerTap(run)).toBe(0);
    expect(canPerformAction(def, run, TIE_ACTION_ID)).toBe(false);
    run = until(run, (r) => tieState(r) === "tied", 10);
    expect(tieState(run)).toBe("tied");
    expect(sceneInfo(run).tie).toBe(2);
    expect(incomePerSecond(run)).toBe(0);
    run = performAction(def, run, TIE_ACTION_ID);
    expect(tieState(run)).toBe("untying");
    expect(isIdle(run)).toBe(true);
    run = until(run, (r) => tieState(r) === "free", 10);
    expect(incomePerSecond(run)).toBeGreaterThan(0);
  });

  it("keeps a tied tower safe in a gust, and a loose one can lose its load", () => {
    const outcome = (tied: boolean, seed: number): number => {
      let run = {
        ...withResources(sky(), { skStrain: 3, skEff: 3 }),
        rng: seed,
      };
      run = until(run, (r) => forecastOf(r) === 2);
      run = until(run, (r) => forecastOf(r) === 2 && gustIn(r) <= 3);
      const lost = (r: RunState): number =>
        (r.resources.skDrops ?? 0) + (r.resources.skSnaps ?? 0);
      if (tied) {
        run = performAction(def, run, TIE_ACTION_ID);
        // The moment of tying is still loose; the tower is safe once tied.
        run = until(run, (r) => tieState(r) === "tied", 10);
      }
      const before = lost(run);
      run = until(run, (r) => isBlowing(r), 20);
      run = until(run, (r) => !isBlowing(r), 20);
      return lost(run) - before;
    };
    let tiedHits = 0;
    let looseHits = 0;
    for (let seed = 1; seed <= 24; seed += 1) {
      tiedHits += outcome(true, seed);
      looseHits += outcome(false, seed);
    }
    expect(tiedHits).toBe(0);
    expect(looseHits).toBeGreaterThan(8);
  });
});

describe("cable strain", () => {
  it("pays more as it tightens, and a gust snaps a tight cable far more often", () => {
    const pays = STRAINS.map((_, i) =>
      skyPay(withResources(sky(), { skStrain: i, skEff: i }))
    );
    for (let i = 1; i < pays.length; i += 1)
      expect(pays[i]).toBeGreaterThan(pays[i - 1]);
    const snaps = (strain: number): number => {
      let count = 0;
      for (let seed = 1; seed <= 30; seed += 1) {
        let run = {
          ...withResources(sky(), { skStrain: strain, skEff: strain }),
          rng: seed,
        };
        run = until(run, (r) => isBlowing(r), 900);
        run = until(run, (r) => !isBlowing(r), 20);
        count += run.resources.skSnaps ?? 0;
      }
      return count;
    };
    expect(snaps(3)).toBeGreaterThan(snaps(0) + 6);
  });

  it("takes a moment to change, and has a card for every step", () => {
    let run = performAction(def, sky(), strainActionId(3));
    expect(run.resources.skStrain).toBe(3);
    expect(run.resources.skEff).toBeCloseTo(1, 5);
    run = tick(def, run, 1);
    expect(run.resources.skEff).toBeGreaterThan(1);
    expect(run.resources.skEff).toBeLessThan(3);
    expect(canPerformAction(def, run, strainActionId(3))).toBe(false);
    expect(canPerformAction(def, run, strainActionId(0))).toBe(true);
  });

  it("loses the load and the pay for a moment when the cable snaps", () => {
    let run = withResources(sky({ beams: 1e6 }), {
      skHook: 5e5,
      skStrain: 3,
      skEff: 3,
    });
    run = until(
      run,
      (r) => (r.resources.skSnaps ?? 0) > 0 || (r.resources.skDrops ?? 0) > 0,
      3000
    );
    expect(hookOf(run)).toBe(0);
    expect(incomePerSecond(run)).toBe(0);
    expect(sceneInfo(run).snapped || sceneInfo(run).dropped).toBe(true);
  });
});

describe("the no-crane climb", () => {
  it("opens with the first cloud crane", () => {
    expect(canStartNoCrane(sky())).toBe(true);
    const noCrane = tick(
      def,
      { ...sky(), owned: { "sky-crew": 5 } } as RunState,
      0.1
    );
    expect(canStartNoCrane(noCrane)).toBe(false);
  });

  it("pays far less while it lasts, and a clear minute earns a permanent badge", () => {
    let run = sky();
    const before = incomePerSecond(run);
    run = performAction(def, run, NC_START_ACTION_ID);
    expect(isNoCrane(run)).toBe(true);
    expect(incomePerSecond(run)).toBeCloseTo(before * K.ncPay, 3);
    expect(canPerformAction(def, run, TIE_ACTION_ID)).toBe(false);
    // Hold the sky clear so nothing interrupts it.
    for (let t = 0; t < K.ncSeconds + 1; t += 1) {
      run = withResources(tick(def, run, 1), {
        skWx: 0,
        skWxAt: run.time + 100,
        skStrain: 0,
        skEff: 0,
      });
    }
    expect(isNoCrane(run)).toBe(false);
    expect(ncWins(run)).toBe(1);
    expect(sceneInfo(run).badges).toBe(1);
    expect(
      incomePerSecond(withResources(run, { skStrain: 1, skEff: 1 }))
    ).toBeGreaterThan(before);
  });

  it("fails when a gust arrives, and the crew rests", () => {
    let run = performAction(def, sky(), NC_START_ACTION_ID);
    run = until(run, (r) => !isNoCrane(r), 400);
    if (ncWins(run) === 0) {
      expect(run.resources.skNcFails).toBe(1);
      expect(incomePerSecond(run)).toBe(0);
      expect(canStartNoCrane(run)).toBe(false);
    }
  });

  it("can be given up, and stops at the badge limit", () => {
    let run = performAction(def, sky(), NC_START_ACTION_ID);
    run = performAction(def, run, NC_STOP_ACTION_ID);
    expect(isNoCrane(run)).toBe(false);
    run = withResources(run, { skNcWins: K.ncMax });
    expect(canStartNoCrane(run)).toBe(false);
  });
});

describe("a gust moves the best answer: the simulator plays the sky", () => {
  const OWNED = {
    "sky-crew": 5,
    "cloud-crane": 3,
    "cable-spinner": 1,
    alloy: 2,
  };
  const end = UPGRADES.find((u) => u.id === "space-elevator");
  const base = runAtPhaseStart(2);
  const SEEDS = 20;
  const LEFT = 1500;

  const step = (
    run: RunState,
    strategy: ReturnType<typeof playsSky>
  ): RunState => {
    let next = tick(def, run, 0.5);
    const taps = Math.floor(next.time * 0.75) - Math.floor(run.time * 0.75);
    for (let i = 0; i < taps; i += 1) next = manualAction(def, next);
    const available = visibleActions(def, next)
      .map((a) => a.id)
      .filter((id) => canPerformAction(def, next, id));
    for (const id of strategy(next, available).filter((id) =>
      available.includes(id)
    ))
      next = performAction(def, next, id);
    return next;
  };

  const start = (): RunState => ({
    ...base,
    owned: { ...OWNED },
    resources: { ...base.resources, beams: 0 },
  });

  /** Beams a second at a taut cable (the yardstick for how far the part is). */
  const rate = (() => {
    let run = start();
    const s = playsSky({ strain: 1, tie: "never", crane: "never" }, 1);
    for (let t = 0; t < 120; t += 0.5) run = step(run, s);
    return run.resources.beams / 120;
  })();

  /** Mean seconds to finish a sky that is `left` seconds from its end at a taut cable. */
  const seconds = (style: SkyStyle, left = LEFT): number =>
    secondsOf(playsSky(style, 1), left);

  const reads: SkyStyle = { strain: "reads", tie: "reads", crane: "reads" };
  const best = seconds(reads);

  /**
   * A player who sets one strain and only ties down when the banner says a
   * strong gust is sure (the best fixed plan a reader could copy).
   */
  const fixedStrongTie =
    (strain: number): ReturnType<typeof playsSky> =>
    (run, available) => {
      const out = playsSky(
        { strain: "reads", tie: "never", crane: "reads" },
        1
      )(run, available).filter((id) => id.startsWith("sky-nocrane"));
      if (!isSkyOpen(run)) return out;
      const t = tieState(run);
      const wx = forecastOf(run);
      if (
        t === "free" &&
        wx === 2 &&
        isStrongGust(run) &&
        gustInExact(run) <= 3 &&
        !isNoCrane(run)
      )
        out.push(TIE_ACTION_ID);
      else if (t === "tied" && !isBlowing(run) && wx !== 2)
        out.push(TIE_ACTION_ID);
      if (t === "free" && strainStep(run) !== strain)
        out.push(strainActionId(strain));
      return out;
    };

  function secondsOf(
    strategy: ReturnType<typeof playsSky>,
    left = LEFT
  ): number {
    const cost = upgradeCost(start(), end!);
    let total = 0;
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      let run: RunState = {
        ...start(),
        rng: seed * 7919 + 1,
        resources: { ...start().resources, beams: cost - left * rate },
      };
      let t = 0;
      while (run.resources.beams < cost && t < 6000) {
        run = step(run, strategy);
        t += 0.5;
      }
      total += t;
    }
    return total / SEEDS;
  }

  it("beats every fixed cable strain by 5% (reading the clouds is what pays)", () => {
    for (const strain of [0, 1, 2, 3]) {
      const plans: [string, number][] = [
        [`s${strain} strong-banner tie`, secondsOf(fixedStrongTie(strain))],
        [
          `s${strain} gust tie`,
          seconds({ strain, tie: "gust", crane: "reads" }),
        ],
        [
          `s${strain} never tie`,
          seconds({ strain, tie: "never", crane: "reads" }),
        ],
      ];
      for (const [name, secs] of plans)
        expect([name, secs > best * 1.05]).toEqual([name, true]);
    }
  });

  it("beats tying at the sure gust every time and tying at the first clouds", () => {
    for (const tie of ["gust", "clouds"] as const)
      expect([
        tie,
        seconds({ strain: "reads", tie, crane: "reads" }) > best * 1.01,
      ]).toEqual([tie, true]);
  });

  it("beats never trying the no-crane climb (a long way from the end) and trying it every time it can (near the end)", () => {
    expect(
      seconds({ strain: "reads", tie: "reads", crane: "never" })
    ).toBeGreaterThan(best * 1.02);
    expect(
      seconds({ strain: "reads", tie: "reads", crane: "always" }, 600)
    ).toBeGreaterThan(seconds(reads, 600) * 1.05);
  });
});

describe("sky fixes: weather of its own, honest rests, moments held", () => {
  const timeline = (strain: number, seed: number): string => {
    let run = { ...sky({ skStrain: strain, skEff: strain }), rng: seed };
    const seen: string[] = [];
    for (let t = 0; t < 400; t += 1) {
      run = tick(def, run, 1);
      seen.push(`${forecastOf(run)}${isBlowing(run) ? "g" : ""}`);
    }
    return seen.join("");
  };

  it("never lets your cable change the weather", () => {
    for (const seed of [3, 11, 29])
      expect(timeline(3, seed)).toBe(timeline(0, seed));
  });

  it("will not start a no-crane climb while a gust is sure", () => {
    const run = withResources(sky(), {
      skWx: 2,
      skWxAt: sky().time + 20,
    });
    expect(forecastOf(run)).toBe(2);
    expect(canStartNoCrane(run)).toBe(false);
  });

  it("makes giving up a climb cost a short rest", () => {
    let run = performAction(def, sky(), NC_START_ACTION_ID);
    run = performAction(def, run, NC_STOP_ACTION_ID);
    expect(isNoCrane(run)).toBe(false);
    expect(isIdle(run)).toBe(true);
    expect(canStartNoCrane(run)).toBe(false);
    expect(skyPay(run)).toBe(0);
  });

  it("lets a hand on the rope pay in full while the crane is off", () => {
    const calm = withResources(sky(), { skWx: 0 });
    const climbing = performAction(def, calm, NC_START_ACTION_ID);
    expect(manualPerTap(climbing)).toBeCloseTo(manualPerTap(calm), 6);
    expect(incomePerSecond(climbing)).toBeLessThan(incomePerSecond(calm));
  });

  it("holds story toasts while a drop, a snap or a win is on screen", () => {
    expect(isSkyMomentBusy(sky())).toBe(false);
    for (const key of ["skDropAt", "skSnapAt", "skNcWinAt", "skNcFailAt"]) {
      const base = sky();
      expect(isSkyMomentBusy(withResources(base, { [key]: base.time }))).toBe(
        true
      );
    }
  });

  it("ranks a drop or a snap over a ended climb on the banner", () => {
    const base = sky();
    const info = sceneInfo(
      withResources(base, {
        skDropAt: base.time,
        skNcFailAt: base.time,
        skDrops: 1,
        skNcFails: 1,
      })
    );
    expect(info.phase === "sky" && info.dropped && info.ncLost).toBe(true);
  });
});
