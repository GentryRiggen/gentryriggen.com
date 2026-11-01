import { performAction, tick } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growBots } from "../bots";
import { growIncomeView } from "../hooks";
import {
  FLOCK_LEADER_ID,
  MIGRATION_ACTION_IDS,
  REGIONS,
  REGION_COUNT,
  flightsSoFar,
  isFlockReady,
  isMigrationOpen,
  leaderShown,
  migrationResultLine,
  mostWelcoming,
  regionWelcome,
  sendActionId,
} from "../migration";
import { incomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const M = TUNING.migration;

let world: RunState | undefined;
/** A world run that owns a rover, so the migration opens on the first tick. */
const flocky = (owned: Record<string, number> = {}): RunState => {
  world ??= runAtPhaseStart(2);
  return {
    ...world,
    owned: { windbreak: 4, "planting-rover": 1, ...owned },
    resources: { ...world.resources, green: 100 },
    flags: { ...world.flags },
  };
};

const run = (from: RunState, seconds: number): RunState => {
  let next = from;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

function toFlock(from: RunState, limit = 400): RunState {
  let next = from;
  for (let t = 0; t < limit && !isFlockReady(next); t += 1)
    next = tick(def, next, 1);
  return next;
}

const send = (from: RunState, region: number): RunState =>
  performAction(def, from, sendActionId(region));

/** Sends and waits out the flight and the landing. */
const landed = (from: RunState, region: number): RunState =>
  run(send(from, region), REGIONS[region].hop + M.surgeSeconds + 1);

describe("seed migration", () => {
  it("opens on the first rover, never on a timer", () => {
    const base = flocky();
    const waited = run({ ...base, owned: { windbreak: 4 } }, 600);
    expect(isMigrationOpen(waited)).toBe(false);
    expect(waited.resources.mgShown ?? 0).toBe(0);
    expect(isMigrationOpen(tick(def, base, 0.1))).toBe(true);
  });

  it("shows a welcome for every region that is what the landing pays", () => {
    const on = toFlock(tick(def, flocky(), 0.1));
    expect(isFlockReady(on)).toBe(true);
    const income = Math.max(1, incomePerSecond(on));
    for (let region = 0; region < REGION_COUNT; region += 1) {
      const welcome = regionWelcome(on, region);
      expect(welcome).toBeGreaterThan(0);
      const sent = send(on, region);
      const expected = welcome * income;
      expect(sent.resources.mgLastPays).toBeCloseTo(expected, 5);
    }
  });

  it("makes a meadow raise the welcome everywhere", () => {
    const on = toFlock(tick(def, flocky(), 0.1));
    const withMeadow: RunState = {
      ...on,
      resources: { ...on.resources, bmMeadow: 1 },
    };
    for (let region = 0; region < REGION_COUNT; region += 1)
      expect(regionWelcome(withMeadow, region)).toBeGreaterThan(
        regionWelcome(on, region) * 1.5
      );
  });

  it("welcomes a flock less where the green already is, so the flock goes round", () => {
    const on = toFlock(tick(def, flocky(), 0.1));
    const before = regionWelcome(on, 0);
    const after = landed(on, 0);
    const next = toFlock(after);
    expect(next.resources.mgGreen0).toBeGreaterThan(0);
    // same weather, less room: compare the room factor alone
    const sameWeather: RunState = {
      ...next,
      resources: { ...next.resources, mgRoll0: on.resources.mgRoll0 },
    };
    expect(regionWelcome(sameWeather, 0)).toBeLessThan(before);
  });

  it("offers one decision every couple of minutes", () => {
    expect(M.waitSeconds).toBeGreaterThanOrEqual(90);
    let r = landed(toFlock(tick(def, flocky(), 0.1)), 1);
    let waited = 0;
    while (!isFlockReady(r) && waited < 400) {
      r = tick(def, r, 1);
      waited += 1;
    }
    expect(waited).toBeGreaterThanOrEqual(90);
    expect(waited).toBeLessThanOrEqual(130);
  });

  it("waits for the player and loses nothing when ignored", () => {
    const on = toFlock(tick(def, flocky(), 0.1));
    const later = run(on, 2000);
    expect(isFlockReady(later)).toBe(true);
    expect(later.resources.mgShown).toBe(1);
    expect(later.resources.green).toBeGreaterThanOrEqual(on.resources.green);
    expect(regionWelcome(later, 2)).toBe(regionWelcome(on, 2));
  });

  it("shows the flock leader after two flights, which is mid-machine-life", () => {
    let r = toFlock(tick(def, flocky(), 0.1));
    expect(leaderShown(r)).toBe(false);
    r = landed(r, 0);
    expect(leaderShown(r)).toBe(false);
    r = landed(toFlock(r), 0);
    expect(flightsSoFar(r)).toBe(2);
    expect(leaderShown(r)).toBe(true);
    expect(
      def.upgrades.find((u) => u.id === FLOCK_LEADER_ID)?.visibleWhen?.(r)
    ).toBe(true);
  });

  it("lets the flock leader add to hand play, never replace it", () => {
    const on = toFlock(tick(def, flocky({ [FLOCK_LEADER_ID]: 1 }), 0.1));
    const helped = run(on, M.leaderDelay + 30);
    expect(helped.resources.mgBy).toBe(1);
    expect(flightsSoFar(helped)).toBe(1);
    const tended = send(run(on, 5), mostWelcoming(on));
    expect(tended.resources.mgBy).toBe(0);
    // the leader's send pays less than the same send by hand
    expect(helped.resources.mgLastPays).toBeLessThan(
      tended.resources.mgLastPays
    );
    let withHand = on;
    let leaderOnly = on;
    for (let t = 0; t < 1500; t += 1) {
      withHand = tick(def, withHand, 1);
      if (isFlockReady(withHand) && withHand.resources.mgTime >= 2)
        withHand = send(withHand, mostWelcoming(withHand));
      leaderOnly = tick(def, leaderOnly, 1);
    }
    expect(withHand.resources.mgEarned).toBeGreaterThan(
      leaderOnly.resources.mgEarned
    );
    expect(leaderOnly.resources.mgEarned).toBeGreaterThan(0);
  });

  it("lands a flock in flight after the world ends, paid by the world's income", () => {
    const big = { windbreak: 10, "planting-rover": 10 };
    const on = toFlock(tick(def, flocky(big), 0.1));
    const worldIncome = incomePerSecond(on);
    const sent = send(on, 4);
    const ended: RunState = { ...sent, phase: 3, owned: {} };
    const after = run(ended, REGIONS[4].hop + M.surgeSeconds + 2);
    expect(flightsSoFar(after)).toBe(1);
    expect(after.resources.mgPending).toBe(0);
    const pays = regionWelcome(on, 4) * Math.max(1, worldIncome);
    expect(after.resources.mgLastPays).toBeCloseTo(pays, 5);
    expect((after.resources.care ?? 0) - (ended.resources.care ?? 0)).toBe(
      Math.floor(pays * M.greenToCare)
    );
    expect(after.resources.care).toBeGreaterThan(0);
  });

  it("uses its own random stream", () => {
    const start = tick(def, flocky(), 0.1);
    let r = start;
    for (let i = 0; i < 5; i += 1) r = landed(toFlock(r), 2);
    expect(r.resources.mgFlights).toBe(5);
    expect(r.resources.mgShown).toBe(5);
    expect(r.rng).toBe(start.rng);
  });

  it("keeps result copy kind", () => {
    const on = toFlock(tick(def, flocky({ [FLOCK_LEADER_ID]: 1 }), 0.1));
    const lines: (string | null)[] = [];
    for (let region = 0; region < REGION_COUNT; region += 1)
      lines.push(migrationResultLine(landed(on, region)));
    lines.push(migrationResultLine(run(on, M.leaderDelay + 30)));
    for (const line of lines) {
      expect(line).toEqual(expect.any(String));
      expect(line).not.toMatch(/lose|lost|fail|wrong|bad/i);
    }
    expect(migrationResultLine(on)).toBeNull();
  });

  it("reads a landing in flight as no income for the simulator's probes", () => {
    const on = toFlock(tick(def, flocky(), 0.1));
    const r = run(send(on, 0), REGIONS[0].hop);
    expect(r.resources.mgPending).toBeGreaterThan(0);
    expect(growIncomeView(r).resources.mgPending).toBe(0);
  });

  it("gets the bots to send, and the idle bot never", () => {
    expect(MIGRATION_ACTION_IDS).toHaveLength(REGION_COUNT);
    const bots = growBots();
    const start = runAtPhaseStart(2);
    const play = (strategy: typeof bots.tapper) =>
      simulate(def, {
        strategy,
        startRun: start,
        maxSeconds: 20 * 60,
        stopWhen: (r) => r.phase >= 3,
      }).finalRun;
    expect(play(bots.tapper).resources.mgFlights).toBeGreaterThan(0);
    expect(play(bots.idle).resources.mgFlights ?? 0).toBe(0);
  });
});
