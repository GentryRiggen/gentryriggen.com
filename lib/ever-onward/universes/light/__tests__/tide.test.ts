import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import { newSave, parseSave } from "../../../engine/save";
import type { RunState } from "../../../engine/types";
import { simulate } from "../../../engine/sim";
import { lightBots } from "../bots";
import { def } from "./fixtures";
import {
  HAUL_ACTION,
  SET_NETS_ACTION,
  catchSeconds,
  haulResultLine,
  haulsSoFar,
  highTidesSoFar,
  isTideOpen,
  netState,
  secondsToHighTide,
  tideLevel,
} from "../tide";
import { calmIncomePerSecond } from "../tick";
import { TUNING } from "../tuning";

const CYCLE = TUNING.tide.cycleSeconds;

/** A coast run that has just bought the fish market (the tide is not open yet). */
const coastRun = (owned: Record<string, number> = {}): RunState => {
  const base = newRun(def);
  return {
    ...base,
    owned: { keeper: 5, "dock-1": 1, ...owned },
    resources: { ...base.resources, coins: 1000 },
  };
};

const open = (owned: Record<string, number> = {}): RunState =>
  tick(def, coastRun(owned), 0.1);

const idle = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

const setNets = (run: RunState): RunState =>
  performAction(def, run, SET_NETS_ACTION);
const haul = (run: RunState): RunState => performAction(def, run, HAUL_ACTION);

/** Ticks until the nets are full (or `limit` seconds pass). */
function toFull(run: RunState, limit = 400): RunState {
  let next = run;
  for (let t = 0; t < limit && netState(next) !== "full"; t += 1)
    next = tick(def, next, 1);
  return next;
}

describe("the tide clock", () => {
  it("opens on the fish market purchase with a story line, never on a timer", () => {
    const base = newRun(def);
    const waited = idle({ ...base, owned: { keeper: 5 } }, 600);
    expect(isTideOpen(waited)).toBe(false);

    const opened = open();
    expect(isTideOpen(opened)).toBe(true);
    expect(opened.story).toContain("coast-tide");
  });

  it("is not there for a save from before it existed", () => {
    const run = open();
    const old: RunState = {
      ...run,
      resources: Object.fromEntries(
        Object.entries(run.resources).filter(([id]) => !id.startsWith("td"))
      ),
      flags: {},
      owned: { keeper: 5 },
    };
    const loaded = reconcileRun(def, old);
    expect(isTideOpen(loaded)).toBe(false);
    expect(() => idle(loaded, 5)).not.toThrow();
    // an old save that already owns the market gets the clock on its next tick
    expect(
      isTideOpen(tick(def, { ...loaded, owned: { "dock-1": 1 } }, 1))
    ).toBe(true);
  });

  it("rises and falls in one slow wave, about every three minutes", () => {
    let run = open();
    const levels: number[] = [];
    for (let t = 0; t < CYCLE * 2; t += 1) {
      levels.push(tideLevel(run));
      run = tick(def, run, 1);
    }
    expect(CYCLE).toBeGreaterThanOrEqual(150);
    expect(CYCLE).toBeLessThanOrEqual(180);
    expect(Math.min(...levels)).toBeLessThan(0.01);
    expect(Math.max(...levels)).toBeGreaterThan(0.99);
    // the highest water is half a cycle in, and again a cycle later
    const high = levels.indexOf(Math.max(...levels));
    expect(Math.abs(high - CYCLE / 2)).toBeLessThanOrEqual(2);
    expect(highTidesSoFar(run)).toBe(2);
    // smooth: never a jump of more than a few percent a second
    for (let i = 1; i < levels.length; i += 1)
      expect(Math.abs(levels[i] - levels[i - 1])).toBeLessThan(0.05);
  });

  it("counts down to high tide and starts the count again right after one", () => {
    const run = open();
    expect(secondsToHighTide(run)).toBeCloseTo(CYCLE / 2, 5);
    const after = idle(run, CYCLE / 2 + 5);
    expect(secondsToHighTide(after)).toBeGreaterThan(CYCLE - 10);
  });

  it("fills set nets at high tide and pays a haul", () => {
    const set = setNets(open());
    expect(netState(set)).toBe("set");
    expect(canPerformAction(def, set, HAUL_ACTION)).toBe(false);
    expect(canPerformAction(def, set, SET_NETS_ACTION)).toBe(false);
    const full = toFull(set);
    expect(netState(full)).toBe("full");
    expect(canPerformAction(def, full, HAUL_ACTION)).toBe(true);

    const hauled = haul(full);
    expect(netState(hauled)).toBe("empty");
    expect(haulsSoFar(hauled)).toBe(1);
    const payout = hauled.resources.tdLastPayout;
    expect(payout).toBeGreaterThan(0);
    const after = idle(hauled, 20);
    expect(after.resources.coins).toBeGreaterThan(
      full.resources.coins + payout * 0.99
    );
    expect(after.resources.tdPending).toBe(0);
    expect(haulResultLine(after)).toMatch(/^Nets full! You set them early: \+/);
  });

  it("pays about 30 to 45 seconds of coast income", () => {
    const full = toFull(setNets(open()));
    const seconds =
      haul(full).resources.tdLastPayout / calmIncomePerSecond(full);
    expect(seconds).toBeGreaterThanOrEqual(30);
    expect(seconds).toBeLessThanOrEqual(45.001);
  });

  it("pays more for nets set early than for nets set late, and never less than 30 seconds", () => {
    const early = toFull(setNets(open()));
    // the same clock, but the nets go out just before high tide
    const late = toFull(setNets(idle(open(), CYCLE / 2 - 5)));
    const earlyPay =
      haul(early).resources.tdLastPayout / calmIncomePerSecond(early);
    const latePay =
      haul(late).resources.tdLastPayout / calmIncomePerSecond(late);
    expect(earlyPay).toBeGreaterThan(latePay);
    expect(latePay).toBeGreaterThanOrEqual(30);
    expect(late.resources.tdEarly).toBeLessThan(0.1);
    expect(haulResultLine(haul(late))).toMatch(/catch even more/);
    // nets set while the tide is going out catch the whole next rise
    const falling = setNets(idle(open(), CYCLE / 2 + 10));
    expect(falling.resources.tdEarly).toBe(1);
  });

  it("keeps full nets waiting, full and unspoiled, for as long as it takes", () => {
    const full = toFull(setNets(open()));
    const payout = haul(full).resources.tdLastPayout;
    const waited = idle(full, CYCLE * 6);
    expect(netState(waited)).toBe("full");
    // a later haul pays exactly what the same nets would have paid at once
    // (the same income, as no upgrade was bought in between)
    expect(haul(waited).resources.tdLastPayout).toBeCloseTo(payout, 3);
  });

  it("is safe to ignore: nothing is lost and no coins are taken", () => {
    let run = open();
    let lowest = run.resources.coins;
    for (let t = 0; t < CYCLE * 4; t += 1) {
      run = tick(def, run, 1);
      lowest = Math.min(lowest, run.resources.coins);
    }
    expect(highTidesSoFar(run)).toBe(4);
    expect(haulsSoFar(run)).toBe(0);
    expect(netState(run)).toBe("empty");
    expect(run.resources.tdEarned ?? 0).toBe(0);
    expect(lowest).toBeGreaterThanOrEqual(1000 - 1);
  });

  it("makes bigger nets catch more", () => {
    const run = open();
    const bigger = open({ "nets-1": 1 });
    expect(catchSeconds(bigger, 1)).toBeCloseTo(
      catchSeconds(run, 1) * TUNING.tide.biggerNetsFactor,
      6
    );
    expect(catchSeconds(bigger, 0)).toBeGreaterThanOrEqual(
      catchSeconds(run, 1)
    );
  });

  it("lets the tide mill add to hand play, never replace it", () => {
    const plain = open();
    const milled = open({ "tide-mill": 1 });

    // ignored, the mill alone pays
    const mill = idle(milled, CYCLE + 5);
    const none = idle(plain, CYCLE + 5);
    expect(mill.resources.tdMilled).toBeGreaterThan(0);
    expect(mill.resources.coins).toBeGreaterThan(none.resources.coins);

    // tended by hand, the hand catch is the same with or without the mill
    const byHandMill = haul(toFull(setNets(milled)));
    const byHandPlain = haul(toFull(setNets(plain)));
    expect(byHandMill.resources.tdLastPayout).toBeCloseTo(
      byHandPlain.resources.tdLastPayout,
      3
    );
    // and tending plus the mill always pays more than the mill alone
    let tended = setNets(milled);
    for (let t = 0; t < 150; t += 1) {
      tended = tick(def, tended, 1);
      if (netState(tended) === "full") tended = haul(tended);
    }
    expect(haulsSoFar(tended)).toBe(1);
    expect(tended.resources.coins).toBeGreaterThan(
      idle(milled, 150).resources.coins
    );

    // the mill's share is smaller than a hand catch
    const handSeconds =
      byHandPlain.resources.tdLastPayout / calmIncomePerSecond(plain);
    expect(TUNING.tide.millSeconds).toBeLessThan(handSeconds);
  });

  it("finishes a catch that is still flowing in when the coast ends", () => {
    const hauled = haul(toFull(setNets(open())));
    expect(hauled.resources.tdPending).toBeGreaterThan(0);
    const before = hauled.resources.coins;
    const gone: RunState = { ...hauled, phase: 1 };
    const after = idle(gone, 20);
    expect(after.resources.tdPending).toBe(0);
    expect(after.resources.coins).toBeGreaterThan(before);
    expect(isTideOpen(after)).toBe(false);
  });

  it("survives a save round trip with nets set, and with nets full", () => {
    for (const run of [setNets(open()), toFull(setNets(open()))]) {
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
      expect(netState(loaded)).toBe(netState(run));
      expect(secondsToHighTide(loaded)).toBeCloseTo(secondsToHighTide(run), 5);
      expect(idle(loaded, 200).resources.tdNets).toBe(
        idle(run, 200).resources.tdNets
      );
    }
  });

  it("is deterministic and leaves the run's own random stream alone", () => {
    const a = idle(open(), 400);
    const b = idle(open(), 400);
    expect(a.resources).toEqual(b.resources);

    // the same coast with and without the clock: the oil market and the
    // storms (which draw from the run's stream) come out identical
    const withClock = idle(tick(def, coastRun(), 1), 300);
    const without = idle(
      tick(def, { ...coastRun(), owned: { keeper: 5 } }, 1),
      300
    );
    expect(isTideOpen(withClock)).toBe(true);
    expect(isTideOpen(without)).toBe(false);
    expect(withClock.rng).toBe(without.rng);
  });

  describe("in the simulator", () => {
    const hauls = (who: "tapper" | "realistic" | "dawdler" | "idle"): number =>
      simulate(def, {
        strategy: lightBots()[who],
        maxSeconds: 3 * 3600,
        step: 0.5,
        stopWhen: (run) => run.phase >= 1,
      }).actionsDone.filter((a) => a.id === HAUL_ACTION).length;

    it("is tended by the tapper and realistic bots, sometimes by the dawdler, never by the idle bot", () => {
      const tapper = hauls("tapper");
      const realistic = hauls("realistic");
      const dawdler = hauls("dawdler");
      expect(tapper).toBeGreaterThanOrEqual(5);
      expect(realistic).toBeGreaterThanOrEqual(2);

      expect(dawdler).toBeGreaterThan(0);
      expect(dawdler).toBeLessThan(tapper);
      expect(hauls("idle")).toBe(0);
    });
  });
});
