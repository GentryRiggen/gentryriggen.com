import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import { newSave, parseSave } from "../../../engine/save";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import {
  TOWNS,
  chanceOf,
  drawChances,
  forecastStep,
  hasCrew,
  isOut,
  isWeatherOpen,
  outageLeft,
  outageFactor,
  POST_BUILD,
  POST_SCHOOL,
  POST_WATCH,
  buildMult,
  crewCount,
  crewPostActionId,
  crewsHeaded,
  crewsPlaced,
  isThere,
  postOf,
  readiness,
  schoolMult,
  setPost,
  isCommitted,
  moveFee,
  sizeMult,
  stormSize,
  townWorth,
  stageSecondsLeft,
  lastStorm,
  stormResultLine,
  travelLeft,
  weatherStage,
} from "../weather";
import { TUNING } from "../tuning";
import { incomePerSecond } from "../tick";

const nightRun = (owned: Record<string, number> = {}): RunState => {
  const base = newRun(def);
  return {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 3, ...owned },
    resources: { ...base.resources, night: 80, power: 1000 },
  };
};

const idle = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

/** Ticks until the forecast stands. */
function toForecast(run: RunState): RunState {
  let next = run;
  for (let t = 0; t < 600 && weatherStage(next) !== "forecast"; t += 1)
    next = tick(def, next, 1);
  return next;
}

/** Fixes the forecast so the storm can only land in `town`. */
function stormWillHit(run: RunState, town: number): RunState {
  const resources: Record<string, number> = {
    ...run.resources,
    wxTarget: town,
  };
  for (let t = 0; t < TOWNS.length; t += 1) {
    resources[`wxChance${t}`] = t === town ? 100 : 0;
    resources[`wxBase${t}`] = t === town ? 100 : 0;
  }
  return { ...run, resources };
}

/** A crew that has been at `town` long enough to be fully ready. */
const readyCrew = (run: RunState, town: number): RunState => {
  const sent = shield(run, town);
  return {
    ...sent,
    resources: {
      ...sent.resources,
      crewTravel0: 0,
      [`wxReady${town}`]: 1,
    },
  };
};

/** Crew 1 goes on watch at `town` (it spends a while on the road first). */
const shield = (run: RunState, town: number): RunState =>
  performAction(def, run, crewPostActionId(0, POST_WATCH + town));

/** Crew 1 has arrived but only just. */
const justThere = (run: RunState, town: number): RunState => {
  const sent = shield(run, town);
  return {
    ...sent,
    resources: { ...sent.resources, crewTravel0: 0 },
  };
};

/** Plays out the forecast; returns the run just after landfall. */
function toLandfall(run: RunState): RunState {
  let next = run;
  for (let t = 0; t < 600 && weatherStage(next) === "forecast"; t += 1)
    next = tick(def, next, 1);
  return next;
}

describe("the weather desk", () => {
  it("opens on a milestone with a story line, never on a timer", () => {
    const waited = idle(newRun(def), 600);
    expect(isWeatherOpen(waited)).toBe(false);

    const early = tick(def, nightRun({ gen2: 1 }), 1);
    expect(isWeatherOpen(early)).toBe(false);

    const opened = tick(def, nightRun(), 1);
    expect(isWeatherOpen(opened)).toBe(true);
    expect(weatherStage(opened)).toBe("forming");
    expect(opened.story).toContain("night-weather");
  });

  it("is not there for a save from before it existed", () => {
    const run = nightRun();
    const old: RunState = {
      ...run,
      resources: Object.fromEntries(
        Object.entries(run.resources).filter(([id]) => !id.startsWith("wx"))
      ),
      flags: {},
    };
    const loaded = reconcileRun(def, { ...old, owned: { gen2: 1 } });
    expect(weatherStage(loaded)).toBe("closed");
    expect(() => idle(loaded, 5)).not.toThrow();
  });

  it("forecasts three honest chances that add up to 100", () => {
    const run = { rng: 12345 } as unknown as RunState;
    run.resources = { wxSeed: 99 };
    for (let i = 0; i < 300; i += 1) {
      const chances = drawChances(run);
      expect(chances).toHaveLength(3);
      expect(chances.reduce((a, b) => a + b, 0)).toBe(100);
      for (const c of chances) expect(c).toBeGreaterThanOrEqual(5);
    }
    const forecast = toForecast(tick(def, nightRun(), 1));
    const shown = [0, 1, 2].map((t) => chanceOf(forecast, t));
    expect(shown.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("lands storms in proportion to the first, honest forecast", () => {
    let run = tick(def, nightRun(), 1);
    let favourite = 0;
    let fronts = 0;
    let firstChances: number[] = [];
    let was = weatherStage(run);
    for (let t = 0; t < 4 * 3600; t += 1) {
      run = tick(def, run, 1);
      const now = weatherStage(run);
      if (now === "forecast" && was !== "forecast")
        firstChances = [0, 1, 2].map((town) => chanceOf(run, town));
      if (now !== "forecast" && was === "forecast") {
        fronts += 1;
        const landed = lastStorm(run).town;
        if (firstChances[landed] === Math.max(...firstChances)) favourite += 1;
        expect(firstChances[landed]).toBeGreaterThanOrEqual(5);
      }
      was = now;
    }
    expect(fronts).toBeGreaterThan(60);
    // the favourite is hit about as often as its chance says (often, not always)
    expect(favourite / fronts).toBeGreaterThan(0.5);
    expect(favourite / fronts).toBeLessThan(0.9);
  });

  it("firms up over three steps toward where it will land", () => {
    let run = toForecast(tick(def, nightRun(), 1));
    const target = run.resources.wxTarget;
    const seen: number[] = [];
    while (weatherStage(run) === "forecast") {
      if (forecastStep(run) > seen.length) seen.push(chanceOf(run, target));
      run = tick(def, run, 1);
    }
    expect(seen).toHaveLength(3);
    expect(seen[1]).toBeGreaterThanOrEqual(seen[0]);
    expect(seen[2]).toBeGreaterThan(seen[1]);
    expect(seen[2]).toBeGreaterThanOrEqual(80);
    expect(lastStorm(run).town).toBe(target);
  });

  it("pays a bonus when the storm lands on a ready crew, and less on one just there", () => {
    const forecast = stormWillHit(toForecast(tick(def, nightRun(), 1)), 0);
    const ready = readyCrew(forecast, 0);
    expect(crewsPlaced(ready)).toBe(1);
    const after = idle(toLandfall(ready), 30);
    const storm = lastStorm(after);
    expect(storm.kind).toBe("held");
    expect(storm.town).toBe(0);
    expect(storm.payout).toBeGreaterThan(0);
    expect(after.resources.wxHeld).toBe(1);
    expect(stormResultLine(after)).toMatch(
      /The storm hit Rivertown, and your crew was ready: \+/
    );
    // a crew that has only just arrived still earns a share
    let late = forecast;
    while (stageSecondsLeft(late) > 1.5) late = tick(def, late, 1);
    const rushed = toLandfall(justThere(late, 0));
    expect(lastStorm(rushed).payout).toBeGreaterThan(storm.payout * 0.25);
    expect(lastStorm(rushed).payout).toBeLessThan(storm.payout * 0.4);
    // one still on the road when it lands has missed it
    const onTheRoad = toLandfall(shield(late, 0));
    expect(lastStorm(onTheRoad).kind).toBe("flicker");
    // the bonus flowed into the grid's power: more than the income alone
    const unmet = idle(toLandfall(stormWillHit(forecast, 1)), 30);
    expect(after.resources.power).toBeGreaterThan(unmet.resources.power);
  });

  it("puts a town's lights out on a miss, for a while, and takes nothing", () => {
    const forecast = stormWillHit(toForecast(tick(def, nightRun(), 1)), 0);
    const missed = toLandfall(shield(forecast, 1));
    const storm = lastStorm(missed);
    expect(storm.kind).toBe("flicker");
    expect(storm.payout).toBe(0);
    expect(isOut(missed, 0)).toBe(true);
    expect(outageFactor(missed)).toBeCloseTo(0.9);
    expect(missed.resources.power).toBeGreaterThanOrEqual(
      forecast.resources.power
    );
    expect(stormResultLine(missed)).toMatch(
      /The storm hit Rivertown and its lights went out for a while/
    );
    // left alone it comes back on its own, a second at a time
    expect(outageLeft(idle(missed, 60), 0)).toBeCloseTo(
      outageLeft(missed, 0) - 60,
      0
    );
    // a crew fixes it fast, and learns from it
    const fixing = justThere(missed, 0);
    const fixed = idle(fixing, 15);
    expect(isOut(fixed, 0)).toBe(false);
    expect(fixed.resources.wxFixes).toBe(1);
    expect(fixed.resources.knowhow).toBeGreaterThan(
      idle(missed, 15).resources.knowhow
    );
  });

  it("keeps crews where they are after a storm, and caps the dip at a fifth", () => {
    const forecast = stormWillHit(toForecast(tick(def, nightRun(), 1)), 0);
    const landed = toLandfall(readyCrew(forecast, 0));
    expect(hasCrew(landed, 0)).toBe(true);
    // the sandbags are used up: the next front needs a crew to get ready afresh
    expect(readiness(landed, 0)).toBe(0);
    const allDark = {
      ...landed,
      resources: { ...landed.resources, wxOut0: 60, wxOut1: 60, wxOut2: 60 },
    };
    expect(outageFactor(allDark)).toBeCloseTo(0.8);
  });

  it("never takes anything from a player who ignores it", () => {
    let run = tick(def, nightRun(), 1);
    let lowest = run.resources.power;
    for (let t = 0; t < 1200; t += 1) {
      run = tick(def, run, 1);
      lowest = Math.min(lowest, run.resources.power);
    }
    expect(run.resources.wxFronts).toBeGreaterThanOrEqual(4);
    expect(run.resources.wxHeld).toBe(0);
    // power only ever climbed
    expect(lowest).toBeGreaterThanOrEqual(1000);
  });

  it("forms a new storm about every two and a half minutes of play", () => {
    let run = tick(def, nightRun(), 1);
    const forecastAt: number[] = [];
    let was = weatherStage(run);
    for (let t = 0; t < 1800; t += 1) {
      run = tick(def, run, 1);
      const now = weatherStage(run);
      if (now === "forecast" && was !== "forecast") forecastAt.push(run.time);
      was = now;
    }
    const gaps = forecastAt.slice(1).map((t, i) => t - forecastAt[i]);
    expect(gaps.length).toBeGreaterThan(3);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(125);
      expect(gap).toBeLessThanOrEqual(185);
    }
  });

  it("only moves with the engine's time: a long gap is clamped", () => {
    const run = tick(def, nightRun(), 1);
    const jumped = tick(def, run, 3600);
    expect(jumped.resources.wxTimer).toBeGreaterThan(
      run.resources.wxTimer - 1.01
    );
  });

  it("has two crews, three with the third crew, each building, at school or on watch", () => {
    const two = tick(def, nightRun(), 1);
    expect(crewCount(two)).toBe(2);
    expect(crewCount(tick(def, nightRun({ "storm-crews": 1 }), 1))).toBe(3);
    // every crew starts out building
    expect([0, 1].map((c) => postOf(two, c))).toEqual([POST_BUILD, POST_BUILD]);
    expect(buildMult(two)).toBeCloseTo(1 + 2 * TUNING.crews.buildBoost);
    // a crew at the school learns instead, and stops building
    const school = performAction(def, two, crewPostActionId(1, POST_SCHOOL));
    expect(travelLeft(school, 1)).toBe(TUNING.grid.moveSeconds);
    expect(isThere(school, 1)).toBe(false);
    // nothing changes while it is on the road
    expect(buildMult(school)).toBeCloseTo(1 + TUNING.crews.buildBoost);
    expect(schoolMult(school)).toBe(1);
    const arrived = idle(school, TUNING.grid.moveSeconds + 1);
    expect(isThere(arrived, 1)).toBe(true);
    expect(schoolMult(arrived)).toBeCloseTo(1 + TUNING.crews.schoolBoost);
    expect(buildMult(arrived)).toBeCloseTo(1 + TUNING.crews.buildBoost);
    // a crew that is already there cannot be sent there again
    expect(
      canPerformAction(def, arrived, crewPostActionId(1, POST_SCHOOL))
    ).toBe(false);
    // the third crew is not on the list until it is hired
    expect(canPerformAction(def, two, crewPostActionId(2, POST_SCHOOL))).toBe(
      false
    );
  });

  it("only opens the watch posts with the weather desk", () => {
    const nothing = nightRun({ gen2: 1 });
    const early = tick(
      def,
      { ...nothing, owned: { ...nothing.owned, gen1: 3 } },
      1
    );
    expect(isWeatherOpen(early)).toBe(false);
    setPost(early, 0, POST_WATCH);
    expect(postOf(early, 0)).toBe(POST_BUILD);
    const open = tick(def, nightRun(), 1);
    setPost(open, 0, POST_WATCH + 2);
    expect(postOf(open, 0)).toBe(POST_WATCH + 2);
    // an odd post is ignored
    setPost(open, 1, 99);
    expect(postOf(open, 1)).toBe(POST_BUILD);
  });

  it("makes a move a commitment: the crew builds nothing on the road, and starts over there", () => {
    const forming = tick(def, nightRun(), 1);
    const sent = shield(forming, 0);
    expect(buildMult(sent)).toBeCloseTo(1 + TUNING.crews.buildBoost);
    expect(crewsHeaded(sent, 0)).toBe(1);
    expect(crewsPlaced(sent)).toBe(0);
    // sandbags are only filled for a storm that is on its way
    const waiting = idle(sent, TUNING.grid.moveSeconds + 20);
    expect(readiness(waiting, 0)).toBe(0);
    // called away again, it goes back on the road and its readiness resets
    const there = idle(toForecast(waiting), 20);
    expect(readiness(there, 0)).toBeGreaterThan(0.2);
    const away = performAction(def, there, crewPostActionId(0, POST_BUILD));
    expect(readiness(idle(away, 1), 0)).toBe(0);
  });

  it("plays on from a save made mid-forecast before the forecast had steps", () => {
    const forecast = shield(toForecast(tick(def, nightRun(), 1)), 1);
    const flags = { ...forecast.flags };
    delete flags["weather-steps"];
    const old = { ...forecast, flags };
    const after = toLandfall(reconcileRun(def, old));
    expect(["held", "flicker"]).toContain(lastStorm(after).kind);
  });

  it("is tended for you by the weather vane, at a lower payout", () => {
    const base = toForecast(tick(def, nightRun({ "weather-vane": 1 }), 1));
    const likeliest = [0, 1, 2].sort(
      (a, b) => chanceOf(base, b) - chanceOf(base, a)
    )[0];
    const sure = stormWillHit(base, likeliest);
    const byVane = toLandfall(sure);
    expect(lastStorm(byVane).kind).toBe("vane");

    const sentByHand = readyCrew(sure, likeliest);
    const byHand = toLandfall(sentByHand);
    expect(lastStorm(byHand).kind).toBe("held");
    // the same share of a minute of the income each had at the time (a crew
    // on watch is not building, so its income is a little lower)
    expect(lastStorm(byVane).payout / incomePerSecond(sure)).toBeCloseTo(
      (lastStorm(byHand).payout / incomePerSecond(sentByHand)) * 0.6,
      2
    );
    // without the vane an untended storm just flickers
    const noVane = toLandfall(
      stormWillHit(toForecast(tick(def, nightRun(), 1)), 0)
    );
    expect(lastStorm(noVane).kind).toBe("flicker");

    // shielding a different town by hand never loses the vane's cover
    const other = (likeliest + 1) % 3;
    const mixed = toLandfall(shield(sure, other));
    expect(lastStorm(mixed).kind).toBe("vane");
  });

  it("sizes the bonus by how big the storm is and how big the town", () => {
    const forecast = stormWillHit(toForecast(tick(def, nightRun(), 1)), 0);
    const after = toLandfall(readyCrew(forecast, 0));
    const seconds = lastStorm(after).payout / incomePerSecond(forecast);
    // a ready crew earns the whole bonus: so many seconds of income, times how
    // big this front is and how much the town pays (income grows a little
    // while the forecast plays out)
    const expected =
      TUNING.weather.bonusSeconds *
      sizeMult(stormSize(forecast)) *
      townWorth(0);
    expect(seconds).toBeGreaterThan(expected * 0.7);
    expect(seconds).toBeLessThan(expected * 1.6);
  });

  it("tells the forecast how big the storm is, from the draw, and the sizes all turn up", () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const base = newRun(def, undefined, seed * 7919);
      const run = toForecast(
        tick(
          def,
          {
            ...base,
            phase: 1,
            owned: { gen1: 5, gen2: 3 },
            resources: { ...base.resources, night: 80, power: 1000 },
          },
          1
        )
      );
      sizes.add(stormSize(run));
    }
    expect([...sizes].sort()).toEqual([0, 1, 2]);
    expect(TUNING.weather.sizes[0]).toBeLessThan(1);
    expect(TUNING.weather.sizes[2]).toBeGreaterThan(1);
  });

  it("holds a crew sent in the forecast until the storm lands, but not one that was already waiting", () => {
    const forecast = toForecast(tick(def, nightRun(), 1));
    const sent = shield(forecast, 1);
    expect(isCommitted(sent, 0)).toBe(true);
    // it cannot be called back, and nothing else can move it
    expect(canPerformAction(def, sent, crewPostActionId(0, POST_BUILD))).toBe(
      false
    );
    expect(canPerformAction(def, sent, crewPostActionId(0, POST_WATCH))).toBe(
      false
    );
    // the other crew is free
    expect(canPerformAction(def, sent, crewPostActionId(1, POST_SCHOOL))).toBe(
      true
    );
    // the storm lands: it is free again
    const landed = toLandfall(sent);
    expect(isCommitted(landed, 0)).toBe(false);
    expect(canPerformAction(def, landed, crewPostActionId(0, POST_BUILD))).toBe(
      true
    );
    // a crew sent while the storm is still forming is not committed
    const forming = tick(def, nightRun(), 1);
    expect(isCommitted(shield(forming, 1), 0)).toBe(false);
  });

  it("charges for going out on storm duty, and nothing for coming home", () => {
    const run = {
      ...toForecast(tick(def, nightRun(), 1)),
    };
    run.resources.power = 1e9;
    const out = shield(run, 0);
    const fee = moveFee(incomePerSecond(run));
    expect(fee).toBeGreaterThan(0);
    expect(run.resources.power - out.resources.power).toBeCloseTo(fee, 4);
    const landed = toLandfall(out);
    const before = landed.resources.power;
    const home = performAction(def, landed, crewPostActionId(0, POST_BUILD));
    expect(home.resources.power).toBe(before);
  });

  it("survives a save round trip, mid-forecast", () => {
    const forecast = justThere(toForecast(tick(def, nightRun(), 1)), 1);
    const save = newSave();
    save.universes.light = {
      run: forecast,
      best: null,
      completions: 0,
      embers: 0,
      prestigeUpgrades: {},
    };
    const parsed = parseSave(JSON.parse(JSON.stringify(save)));
    const loaded = reconcileRun(def, parsed!.universes.light.run);
    expect(weatherStage(loaded)).toBe("forecast");
    expect(crewsPlaced(loaded)).toBe(1);
    expect([0, 1, 2].map((t) => chanceOf(loaded, t))).toEqual(
      [0, 1, 2].map((t) => chanceOf(forecast, t))
    );
    // and the next landfall comes out the same either way
    expect(lastStorm(toLandfall(loaded))).toEqual(
      lastStorm(toLandfall(forecast))
    );
  });

  it("is deterministic for a seed", () => {
    const a = idle(tick(def, nightRun(), 1), 900);
    const b = idle(tick(def, nightRun(), 1), 900);
    expect(a.resources).toEqual(b.resources);
  });

  it("does not disturb the rest of the run's randomness", () => {
    const withDesk = tick(def, nightRun(), 1);
    expect(withDesk.rng).toBe(tick(def, nightRun({ gen2: 2 }), 1).rng);
    const later = idle(withDesk, 600);
    expect(later.rng).toBe(withDesk.rng);
  });
});
