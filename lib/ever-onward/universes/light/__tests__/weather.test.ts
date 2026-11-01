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
  isWeatherOpen,
  lastStorm,
  shieldActionId,
  shieldedCount,
  stormResultLine,
  weatherStage,
} from "../weather";
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
  const resources = { ...run.resources };
  for (let t = 0; t < TOWNS.length; t += 1)
    resources[`wxChance${t}`] = t === town ? 100 : 0;
  return { ...run, resources };
}

const shield = (run: RunState, town: number): RunState =>
  performAction(def, run, shieldActionId(town));

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

    const early = tick(def, nightRun({ gen2: 2 }), 1);
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

  it("lands storms where the forecast says, in proportion", () => {
    let run = stormWillHit(toForecast(tick(def, nightRun(), 1)), 2);
    run = {
      ...run,
      resources: {
        ...run.resources,
        wxChance0: 50,
        wxChance1: 0,
        wxChance2: 50,
      },
    };
    const hits = [0, 0, 0];
    for (let i = 0; i < 200; i += 1) {
      const forecast = {
        ...run,
        resources: { ...run.resources, wxStage: 1, wxTimer: 0.5 },
        flags: { ...run.flags },
      };
      const after = tick(def, forecast, 1);
      hits[lastStorm(after).town] += 1;
      run = {
        ...run,
        resources: { ...run.resources, wxSeed: after.resources.wxSeed },
      };
    }
    expect(hits[1]).toBe(0);
    expect(hits[0]).toBeGreaterThan(60);
    expect(hits[2]).toBeGreaterThan(60);
  });

  it("pays a bonus when the storm hits a shielded town", () => {
    const forecast = stormWillHit(toForecast(tick(def, nightRun(), 1)), 0);
    const shielded = shield(forecast, 0);
    expect(shieldedCount(shielded)).toBe(1);
    const after = idle(toLandfall(shielded), 30);
    const storm = lastStorm(after);
    expect(storm.kind).toBe("held");
    expect(storm.town).toBe(0);
    expect(storm.payout).toBeGreaterThan(0);
    expect(after.resources.wxHeld).toBe(1);
    expect(stormResultLine(after)).toMatch(
      /Storm hit Rivertown\. Your sandbags held: \+/
    );
    // the bonus flowed into the grid's power: more than the income alone
    const unshielded = idle(toLandfall(stormWillHit(forecast, 1)), 30);
    expect(after.resources.power).toBeGreaterThan(unshielded.resources.power);
  });

  it("costs nothing on a miss: the lights only flicker", () => {
    const forecast = stormWillHit(toForecast(tick(def, nightRun(), 1)), 0);
    const missed = toLandfall(shield(forecast, 1));
    const storm = lastStorm(missed);
    expect(storm.kind).toBe("flicker");
    expect(storm.payout).toBe(0);
    expect(missed.resources.power).toBeGreaterThanOrEqual(
      forecast.resources.power
    );
    expect(stormResultLine(missed)).toMatch(
      /Storm hit Rivertown\. The lights flickered/
    );
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

  it("forms a new front every three to four minutes of play", () => {
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
      expect(gap).toBeGreaterThanOrEqual(180);
      expect(gap).toBeLessThanOrEqual(240);
    }
  });

  it("only moves with the engine's time: a long gap is clamped", () => {
    const run = tick(def, nightRun(), 1);
    const jumped = tick(def, run, 3600);
    expect(jumped.resources.wxTimer).toBeGreaterThan(
      run.resources.wxTimer - 1.01
    );
  });

  it("lets storm crews shield two towns, and moves the oldest shield when full", () => {
    const one = toForecast(tick(def, nightRun(), 1));
    const a = shield(shield(one, 0), 1);
    expect(shieldedCount(a)).toBe(1);
    expect(a.resources.wxShield1).toBeGreaterThan(0);
    expect(a.resources.wxShield0).toBe(0);

    const two = toForecast(tick(def, nightRun({ "storm-crews": 1 }), 1));
    const b = shield(shield(two, 0), 1);
    expect(shieldedCount(b)).toBe(2);
    const c = shield(b, 2);
    expect(shieldedCount(c)).toBe(2);
    expect(c.resources.wxShield0).toBe(0);
    // tapping a shielded town lifts it
    expect(shieldedCount(shield(c, 2))).toBe(1);
  });

  it("can't be shielded outside a forecast", () => {
    const forming = tick(def, nightRun(), 1);
    expect(canPerformAction(def, forming, shieldActionId(0))).toBe(false);
  });

  it("is tended for you by the weather vane, at a lower payout", () => {
    const base = toForecast(tick(def, nightRun({ "weather-vane": 1 }), 1));
    const likeliest = [0, 1, 2].sort(
      (a, b) => chanceOf(base, b) - chanceOf(base, a)
    )[0];
    const sure = stormWillHit(base, likeliest);
    const byVane = toLandfall(sure);
    expect(lastStorm(byVane).kind).toBe("vane");

    const byHand = toLandfall(shield(sure, likeliest));
    expect(lastStorm(byHand).kind).toBe("held");
    expect(lastStorm(byVane).payout).toBeCloseTo(
      lastStorm(byHand).payout * 0.6,
      5
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

  it("sizes the bonus at about 45 seconds of income", () => {
    const forecast = stormWillHit(toForecast(tick(def, nightRun(), 1)), 0);
    const after = toLandfall(shield(forecast, 0));
    const seconds = lastStorm(after).payout / incomePerSecond(forecast);
    expect(seconds).toBeGreaterThan(30);
    expect(seconds).toBeLessThan(60);
  });

  it("survives a save round trip, mid-forecast", () => {
    const forecast = shield(toForecast(tick(def, nightRun(), 1)), 1);
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
    expect(shieldedCount(loaded)).toBe(1);
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
