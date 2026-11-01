import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import { newSave, parseSave } from "../../../engine/save";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { lightBots } from "../bots";
import { lightPlates } from "../hooks";
import {
  MISSION_CONTROL_ID,
  RACING_FINS_ID,
  ROUTES,
  cometCloseness,
  isProbeOut,
  isProbesOpen,
  launchActionId,
  progressOf,
  resultLine,
  routeSeconds,
  scoutRoute,
  runsHome,
  haulSeconds,
} from "../probes";
import { sceneInfo } from "../scene";
import { calmSkyIncomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { def } from "./fixtures";

const P = TUNING.probes;
const SHORT = 0;
const LONG = 1;
const COMET = 2;

/** A sky run that has just bought the star charts (the races are not open yet). */
const skyRun = (owned: Record<string, number> = {}): RunState => {
  const base = newRun(def);
  return {
    ...base,
    phase: 2,
    owned: { collector: 5, probe: 1, "copy-1": 1, "nav-1": 1, ...owned },
    resources: {
      ...base.resources,
      energy: 5000,
      collectors: 5,
      probes: 20,
      stars: 900,
    },
  };
};

const open = (owned: Record<string, number> = {}): RunState =>
  tick(def, skyRun(owned), 0.1);

const idle = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

const launch = (run: RunState, route: number): RunState =>
  performAction(def, run, launchActionId(route));

/** Ticks until the probe is back at the dock and its haul has flowed in. */
function toHome(run: RunState, limit = 400): RunState {
  let next = run;
  for (let t = 0; t < limit && isProbeOut(next); t += 1)
    next = tick(def, next, 1);
  return idle(next, 6);
}

/** Waits (the comet moves) until it is as close as `at least`. */
function whenCometIs(run: RunState, atLeast: number): RunState {
  let next = run;
  for (let t = 0; t < 400 && cometCloseness(next) < atLeast; t += 1)
    next = tick(def, next, 1);
  return next;
}

/** Waits until the comet is as far as `at most`. */
function whenCometFar(run: RunState, atMost: number): RunState {
  let next = run;
  for (let t = 0; t < 400 && cometCloseness(next) > atMost; t += 1)
    next = tick(def, next, 1);
  return next;
}

const income = (run: RunState): number => calmSkyIncomePerSecond(run);

describe("probe races", () => {
  it("opens on the star charts purchase with a story line later, never on a timer", () => {
    const base = newRun(def);
    const waited = idle(
      { ...base, phase: 2, owned: { collector: 5, probe: 1 } },
      600
    );
    expect(isProbesOpen(waited)).toBe(false);

    const opened = open();
    expect(isProbesOpen(opened)).toBe(true);
    expect(opened.story).not.toContain("sky-races");
    expect(idle(opened, 40).story).toContain("sky-races");
  });

  it("is not there for a save from before it existed", () => {
    const run = open();
    const old: RunState = {
      ...run,
      resources: Object.fromEntries(
        Object.entries(run.resources).filter(([id]) => !id.startsWith("pr"))
      ),
      flags: {},
      owned: { collector: 5 },
    };
    const loaded = reconcileRun(def, old);
    expect(isProbesOpen(loaded)).toBe(false);
    expect(() => idle(loaded, 5)).not.toThrow();
    // an old save that already owns the charts gets the races on its next tick
    expect(
      isProbesOpen(tick(def, { ...loaded, owned: { "nav-1": 1 } }, 1))
    ).toBe(true);
  });

  it("shows honest route numbers: the time and the haul it will bring", () => {
    const run = open();
    // trips last a minute or more: a launch is a choice every couple of
    // minutes, not a button to keep pressing
    expect(routeSeconds(run, SHORT)).toBe(P.short.seconds);
    expect(routeSeconds(run, LONG)).toBe(P.long.seconds);
    expect(routeSeconds(run, COMET)).toBe(P.comet.seconds);
    for (let route = 0; route < ROUTES.length; route += 1)
      expect(routeSeconds(run, route)).toBeGreaterThanOrEqual(60);

    const perMinute = (route: number, closeness: number): number =>
      (haulSeconds(route, closeness) / routeSeconds(run, route)) * 60;
    // every route brings home about 20 to 60 seconds of income per minute
    // (the comet's average, 36, is in the 30 to 60)
    for (const [route, closeness] of [
      [SHORT, 0],
      [LONG, 0],
      [COMET, 0],
      [COMET, 1],
    ]) {
      expect(perMinute(route, closeness)).toBeGreaterThanOrEqual(20);
      expect(perMinute(route, closeness)).toBeLessThanOrEqual(60);
    }
    // the long loop pays more in total but no more per second than the short hop
    expect(haulSeconds(LONG, 0)).toBeGreaterThan(haulSeconds(SHORT, 0));
    expect(perMinute(LONG, 0)).toBeLessThanOrEqual(perMinute(SHORT, 0));

    // and the haul that is brought home is the one the card promised
    const flying = launch(run, LONG);
    const promised = flying.resources.prPay;
    expect(promised).toBeCloseTo(haulSeconds(LONG, 0) * income(run), 6);
    const home = toHome(flying);
    expect(home.resources.prLastPayout).toBeCloseTo(promised, 6);
  });

  it("flies a route and pays the haul when the probe is home", () => {
    const run = open();
    const flying = launch(run, SHORT);
    expect(isProbeOut(flying)).toBe(true);
    expect(canPerformAction(def, flying, launchActionId(SHORT))).toBe(false);
    expect(progressOf(flying)).toBe(0);

    const half = Math.round(P.short.seconds / 2);
    const halfway = idle(flying, half);
    expect(progressOf(halfway)).toBeCloseTo(half / P.short.seconds, 5);
    expect(runsHome(halfway)).toBe(0);

    const home = toHome(flying);
    expect(isProbeOut(home)).toBe(false);
    expect(runsHome(home)).toBe(1);
    expect(home.resources.prPending).toBe(0);
    expect(home.resources.prLastPayout).toBeGreaterThan(0);
    expect(home.resources.prEarned).toBe(home.resources.prLastPayout);
    expect(resultLine(home)).toMatch(
      /^The probe is home from the short hop: \+/
    );
    // the energy really arrived (the sky earned a little besides)
    expect(home.resources.energy).toBeGreaterThan(
      flying.resources.energy + home.resources.prLastPayout * 0.99
    );
    expect(canPerformAction(def, home, launchActionId(LONG))).toBe(true);
  });

  it("makes the comet haul depend on how close the comet is, as a bar anyone can read", () => {
    const run = open();
    const close = whenCometIs(run, 0.95);
    const far = whenCometFar(close, 0.05);
    const closeHaul = launch(close, COMET).resources.prPay;
    const farHaul = launch(far, COMET).resources.prPay;
    expect(closeHaul).toBeGreaterThan(farHaul);
    expect(farHaul / income(far)).toBeGreaterThanOrEqual(P.comet.haulMin);
    expect(closeHaul / income(close)).toBeLessThanOrEqual(
      P.comet.haulMax + 0.01
    );

    const nice = toHome(launch(close, COMET));
    expect(resultLine(nice)).toMatch(/^Nice catch!/);
    const kind = toHome(launch(far, COMET));
    // never scolds
    expect(resultLine(kind)).toMatch(/^The probe is home with \+/);
    expect(resultLine(kind)).not.toMatch(/better|should|wrong|miss/i);
  });

  it("pays the comet haul in coarse steps, so the card holds still", () => {
    const seen = new Set<number>();
    let run = open();
    for (let t = 0; t < P.cometCycleSeconds; t += 1) {
      seen.add(haulSeconds(COMET, cometCloseness(run)));
      run = tick(def, run, 1);
    }
    expect(seen.size).toBeLessThanOrEqual(16);
    for (const v of seen) expect(v % 4).toBe(0);
  });

  it("moves the comet in one slow, smooth pass", () => {
    let run = open();
    const seen: number[] = [];
    for (let t = 0; t < P.cometCycleSeconds * 2; t += 1) {
      seen.push(cometCloseness(run));
      run = tick(def, run, 1);
    }
    expect(Math.min(...seen)).toBeLessThan(0.05);
    expect(Math.max(...seen)).toBeGreaterThan(0.95);
    for (let i = 1; i < seen.length; i += 1)
      expect(Math.abs(seen[i] - seen[i - 1])).toBeLessThan(0.1);
  });

  it("waits at the dock for as long as it takes, and ignoring it is safe", () => {
    const run = open();
    const waited = idle(run, 600);
    expect(waited.phase).toBe(2);
    expect(isProbeOut(waited)).toBe(false);
    expect(runsHome(waited)).toBe(0);
    expect(waited.resources.prLaunches ?? 0).toBe(0);
    // nothing taken, nothing spent: the energy only ever went up
    expect(waited.resources.energy).toBeGreaterThanOrEqual(
      run.resources.energy
    );
    // and a probe launched after all that pays exactly as it would have at once
    const late = launch(waited, SHORT).resources.prPay / income(waited);
    expect(late).toBeCloseTo(P.short.haulSeconds, 6);
  });

  it("lets a returned probe sit at the dock until the next launch", () => {
    const home = toHome(launch(open(), SHORT));
    const later = idle(home, 200);
    expect(later.phase).toBe(2);
    expect(isProbeOut(later)).toBe(false);
    expect(runsHome(later)).toBe(1);
    expect(later.resources.prEarned).toBe(home.resources.prEarned);
    expect(canPerformAction(def, later, launchActionId(SHORT))).toBe(true);
  });

  it("makes racing fins shorten every run without changing the haul", () => {
    const plain = open();
    const finned = open({ [RACING_FINS_ID]: 1 });
    for (let route = 0; route < ROUTES.length; route += 1) {
      expect(routeSeconds(finned, route)).toBeCloseTo(
        routeSeconds(plain, route) * P.finsTimeFactor,
        6
      );
      expect(routeSeconds(finned, route)).toBeLessThan(
        routeSeconds(plain, route)
      );
    }
    const a = launch(plain, LONG).resources.prPay;
    const b = launch(finned, LONG).resources.prPay;
    expect(b).toBeCloseTo(a, 6);
    // a finned probe is home first
    const finnedTrip = P.long.seconds * P.finsTimeFactor + 1;
    expect(isProbeOut(idle(launch(finned, LONG), finnedTrip))).toBe(false);
    expect(isProbeOut(idle(launch(plain, LONG), finnedTrip))).toBe(true);
  });

  it("lets mission control add to hand play, never replace it", () => {
    const plain = open();
    const control = open({ [MISSION_CONTROL_ID]: 1 });

    // no hand launch yet, so there is no last route and the scout stays home
    const untouched = idle(control, 300);
    expect(untouched.resources.prAutoRuns ?? 0).toBe(0);

    // after one hand launch, the scout flies that route again and again
    const handFirst = launch(control, SHORT);
    const flown = idle(handFirst, P.short.seconds * 6);
    expect(flown.resources.prAutoRuns).toBeGreaterThanOrEqual(5);
    expect(flown.resources.prAutoEarned).toBeGreaterThan(0);

    // it flies the route it launched with, even after the hand route changes
    const switched = launch(toHome(handFirst), LONG);
    expect(scoutRoute(idle(switched, 1))).toBe(SHORT);

    // the scout's haul is a smaller share of the same route
    const scoutSecs =
      flown.resources.prAutoEarned / flown.resources.prAutoRuns / income(flown);
    expect(scoutSecs).toBeLessThan(P.short.haulSeconds);
    expect(scoutSecs).toBeGreaterThan(0);

    // the hand-flown haul is exactly the same with or without it
    const byHand = (r: RunState) => toHome(launch(r, SHORT));
    expect(byHand(control).resources.prLastPayout).toBeCloseTo(
      byHand(plain).resources.prLastPayout,
      6
    );
    // and the hand probe can still go out while the scout is flying
    const scouting = idle(launch(control, SHORT), 5);
    expect(isProbeOut(scouting)).toBe(true);
    expect(canPerformAction(def, toHome(scouting), launchActionId(LONG))).toBe(
      true
    );

    // tending by hand plus the scout always pays more than the scout alone
    let both = launch(control, SHORT);
    let scoutOnly = launch(control, SHORT);
    for (let t = 0; t < 600; t += 1) {
      both = tick(def, both, 1);
      scoutOnly = tick(def, scoutOnly, 1);
      if (!isProbeOut(both)) both = launch(both, SHORT);
    }
    expect(both.resources.energy).toBeGreaterThan(scoutOnly.resources.energy);
    expect(runsHome(both)).toBeGreaterThan(runsHome(scoutOnly));
  });

  it("never pays less for tending by hand than for leaving it alone", () => {
    const base = open({ [MISSION_CONTROL_ID]: 1 });
    const ignored = idle(launch(base, SHORT), 400);
    let tended = launch(base, SHORT);
    for (let t = 0; t < 400; t += 1) {
      tended = tick(def, tended, 1);
      if (!isProbeOut(tended)) tended = launch(tended, SHORT);
    }
    expect(tended.resources.energy).toBeGreaterThan(ignored.resources.energy);
  });

  it("finishes a haul that is still flowing in, and a probe still away, when the sky ends", () => {
    const flying = launch(open(), SHORT);
    const justHome = idle(flying, P.short.seconds + 1);
    expect(runsHome(justHome)).toBe(1);
    expect(justHome.resources.prPending).toBeGreaterThan(0);
    const before = justHome.resources.energy;
    const gone: RunState = { ...justHome, phase: 3 };
    const after = idle(gone, 20);
    expect(after.resources.prPending).toBe(0);
    expect(after.resources.energy).toBeGreaterThan(before);
    expect(isProbesOpen(after)).toBe(false);

    // a probe still out when the sky ends comes home and pays too
    const away: RunState = { ...launch(open(), LONG), phase: 3 };
    const awayAfter = idle(away, P.long.seconds + 30);
    expect(runsHome(awayAfter)).toBe(1);
    expect(awayAfter.resources.prPending).toBe(0);
    expect(awayAfter.resources.energy).toBeGreaterThan(away.resources.energy);
  });

  it("survives a save round trip with a probe out", () => {
    const run = idle(launch(open({ [MISSION_CONTROL_ID]: 1 }), LONG), 25);
    const save = newSave();
    save.universes.light = {
      run,
      best: null,
      completions: 0,
      embers: 0,
      prestigeUpgrades: {},
    };
    const parsed = parseSave(JSON.parse(JSON.stringify(save)));
    const loaded = reconcileRun(def, parsed!.universes.light.run);
    expect(isProbeOut(loaded)).toBe(true);
    expect(progressOf(loaded)).toBeCloseTo(progressOf(run), 6);
    expect(cometCloseness(loaded)).toBeCloseTo(cometCloseness(run), 6);
    expect(toHome(loaded, 200).resources.prLastPayout).toBeCloseTo(
      toHome(run, 200).resources.prLastPayout,
      6
    );
  });

  it("is deterministic and leaves the run's own random stream alone", () => {
    const a = idle(launch(open(), SHORT), 400);
    const b = idle(launch(open(), SHORT), 400);
    expect(a.resources).toEqual(b.resources);

    // the same sky with and without the races: the flares (which draw from
    // the run's stream) come out identical
    const withRaces = idle(open(), 300);
    const without = idle(
      tick(def, { ...skyRun(), owned: { collector: 5, probe: 1 } }, 0.1),
      300
    );
    expect(isProbesOpen(withRaces)).toBe(true);
    expect(isProbesOpen(without)).toBe(false);
    expect(withRaces.rng).toBe(without.rng);
  });

  it("offers the race plate once the first probe is home, not before", () => {
    const run = open();
    expect(lightPlates(run)).not.toContain("race");
    expect(lightPlates(launch(run, SHORT))).not.toContain("race");
    const one = toHome(launch(run, SHORT));
    expect(lightPlates(one)).toContain("race");
  });

  it("keeps the scene's racing fields to a few steady numbers", () => {
    const run = open();
    const info = sceneInfo(run);
    expect(info.raceOpen).toBe(1);
    expect(info.raceOut).toBe(0);
    expect(sceneInfo(launch(run, SHORT)).raceOut).toBe(1);
    const dressed = open({ [RACING_FINS_ID]: 1, [MISSION_CONTROL_ID]: 1 });
    expect(sceneInfo(dressed).raceFins).toBe(1);
    expect(sceneInfo(dressed).raceControl).toBe(1);
    // none of them move while a probe flies
    const during = new Set<string>();
    let flying = launch(run, LONG);
    for (let t = 0; t < 60; t += 1) {
      flying = tick(def, flying, 1);
      const s = sceneInfo(flying);
      during.add(`${s.raceOpen}${s.raceOut}${s.raceFins}${s.raceControl}`);
    }
    expect(during.size).toBe(1);
  });

  describe("in the simulator", () => {
    const launches = (who: "tapper" | "realistic" | "dawdler" | "idle") =>
      simulate(def, {
        strategy: lightBots()[who],
        maxSeconds: 3 * 3600,
        step: 0.5,
        stopWhen: (run) => run.phase >= 3,
      }).actionsDone.filter((a) => a.id.startsWith("probe-go-")).length;

    it("is flown by the tapper and realistic bots, sometimes by the dawdler, never by the idle bot", () => {
      const tapper = launches("tapper");
      const realistic = launches("realistic");
      const dawdler = launches("dawdler");
      expect(tapper).toBeGreaterThanOrEqual(10);
      expect(realistic).toBeGreaterThanOrEqual(5);
      expect(dawdler).toBeGreaterThan(0);
      expect(dawdler).toBeLessThan(tapper);
      expect(launches("idle")).toBe(0);
    });
  });
});
