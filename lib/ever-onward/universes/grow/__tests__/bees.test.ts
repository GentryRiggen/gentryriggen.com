import { newRun, performAction, tick } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growBots } from "../bots";
import {
  BEE_ACTION_IDS,
  BEE_KEEPER_ID,
  PATCHES,
  beeResultLine,
  danceHint,
  dancesSoFar,
  followActionId,
  isBeesOpen,
  isDancing,
  keeperShown,
  patchPays,
} from "../bees";
import { growIncomeView } from "../hooks";
import { incomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { def } from "./fixtures";

const B = TUNING.bees;

/** A yard run that owns a hive, so the dances open on the first tick. */
const hived = (owned: Record<string, number> = {}): RunState => {
  const base = newRun(def);
  return {
    ...base,
    owned: { sprinkler: 6, "bee-hive": 1, ...owned },
    resources: { ...base.resources, seeds: 100 },
  };
};

const run = (from: RunState, seconds: number): RunState => {
  let next = from;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

/** Ticks until the bees dance (or `limit` seconds pass). */
function toDance(from: RunState, limit = 400): RunState {
  let next = from;
  for (let t = 0; t < limit && !isDancing(next); t += 1)
    next = tick(def, next, 1);
  return next;
}

const follow = (from: RunState, patch: number): RunState =>
  performAction(def, from, followActionId(patch));

describe("the bee dances", () => {
  it("opens on the first hive with a story-free flag, never on a timer", () => {
    const waited = run({ ...newRun(def), owned: { sprinkler: 6 } }, 600);
    expect(isBeesOpen(waited)).toBe(false);
    expect(waited.resources.beDances ?? 0).toBe(0);
    expect(isBeesOpen(tick(def, hived(), 0.1))).toBe(true);
  });

  it("points honestly: following the dance pays the most of any patch", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const dancing = toDance(tick(def, { ...hived(), rng: seed * 7919 }, 0.1));
      expect(isDancing(dancing)).toBe(true);
      const hint = danceHint(dancing);
      const income = incomePerSecond(dancing);
      const pays = PATCHES.map((_, i) => patchPays(dancing, i, income));
      expect(pays[hint]).toBe(Math.max(...pays));
      expect(pays.filter((p) => p === pays[hint])).toHaveLength(1);
      // the dance really does point at the patch the hint names
      const angle = dancing.resources.beAngle;
      const raw = Math.abs(PATCHES[hint].angle - angle) % 360;
      const turn = raw > 180 ? 360 - raw : raw;
      expect(turn).toBeLessThanOrEqual(B.angleJitter + 0.01);
    }
  });

  it("offers one decision every couple of minutes", () => {
    expect(B.forageSeconds).toBeGreaterThanOrEqual(90);
    let r = toDance(tick(def, hived(), 0.1));
    r = follow(r, danceHint(r));
    expect(isDancing(r)).toBe(false);
    let waited = 0;
    while (!isDancing(r) && waited < 400) {
      r = tick(def, r, 1);
      waited += 1;
    }
    expect(waited).toBeGreaterThanOrEqual(90);
    expect(waited).toBeLessThanOrEqual(130);
  });

  it("waits for the player and loses nothing when ignored", () => {
    const dancing = toDance(tick(def, hived(), 0.1));
    const later = run(dancing, 2000);
    expect(isDancing(later)).toBe(true);
    expect(later.resources.beDances).toBe(1);
    expect(later.resources.seeds).toBeGreaterThanOrEqual(
      dancing.resources.seeds
    );
    expect(danceHint(later)).toBe(danceHint(dancing));
  });

  it("lets the bee keeper add to hand play, never replace it", () => {
    const base = tick(def, hived({ [BEE_KEEPER_ID]: 1 }), 0.1);
    const income = incomePerSecond(base);
    const dancing = toDance(base);
    const hint = danceHint(dancing);
    const hand = patchPays(dancing, hint, income);
    // the keeper alone follows after a wait, at a lower payout
    const kept = run(dancing, B.keeperDelay + 1);
    expect(isDancing(kept)).toBe(false);
    const keeperPay = kept.resources.beLastPays;
    expect(kept.resources.beBy).toBe(1);
    expect(keeperPay).toBeGreaterThan(0);
    // hand play alone beats the keeper alone
    expect(hand).toBeGreaterThan(keeperPay);
    // a hand follow within the wait takes the dance, and pays the full amount
    const tended = follow(run(dancing, 5), hint);
    expect(tended.resources.beBy).toBe(0);
    expect(tended.resources.beLastPays).toBeGreaterThan(keeperPay);
    // so hand plus keeper over a long stretch beats the keeper alone
    const sum = (r: RunState) => r.resources.beEarned;
    let withHand = dancing;
    let keeperOnly = dancing;
    for (let t = 0; t < 900; t += 1) {
      withHand = tick(def, withHand, 1);
      if (isDancing(withHand) && withHand.resources.beTime >= 2)
        withHand = follow(withHand, danceHint(withHand));
      keeperOnly = tick(def, keeperOnly, 1);
    }
    expect(sum(withHand)).toBeGreaterThan(sum(keeperOnly));
    expect(sum(keeperOnly)).toBeGreaterThan(0);
  });

  it("shows the bee keeper mid-life, after two dances", () => {
    let r = toDance(tick(def, hived(), 0.1));
    expect(dancesSoFar(r)).toBe(1);
    expect(keeperShown(r)).toBe(false);
    r = toDance(follow(r, danceHint(r)));
    expect(dancesSoFar(r)).toBe(2);
    expect(keeperShown(r)).toBe(true);
    const shown = def.upgrades.find((u) => u.id === BEE_KEEPER_ID);
    expect(shown?.visibleWhen?.(r)).toBe(true);
  });

  it("finishes a pollination in flight when the yard ends", () => {
    const dancing = toDance(tick(def, hived(), 0.1));
    const followed = follow(dancing, danceHint(dancing));
    const pending = followed.resources.bePending;
    expect(pending).toBeGreaterThan(0);
    // a big pollination, so the settled harvest is a whole number worth reading
    const big: RunState = {
      ...followed,
      resources: { ...followed.resources, bePending: 5000, beSurgeRate: 1250 },
    };
    const ended: RunState = { ...big, phase: 1 };
    const after = run(ended, B.surgeSeconds + 2);
    expect(after.resources.bePending).toBe(0);
    // seeds mean nothing on the farm: the rest is settled as harvest
    expect(after.resources.seeds).toBe(followed.resources.seeds);
    // whole units: floor(5000 * 0.004)
    expect(
      (after.resources.harvest ?? 0) - (followed.resources.harvest ?? 0)
    ).toBe(20);
  });

  it("uses its own random stream", () => {
    const start = tick(def, hived(), 0.1);
    let r = start;
    const seen = new Set<number>();
    for (let i = 0; i < 6; i += 1) {
      r = toDance(r);
      seen.add(danceHint(r));
      r = follow(r, danceHint(r));
    }
    expect(r.resources.beDances).toBe(6);
    expect(r.rng).toBe(start.rng);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("keeps result copy kind", () => {
    const dancing = toDance(tick(def, hived({ [BEE_KEEPER_ID]: 1 }), 0.1));
    const hint = danceHint(dancing);
    const lines = [
      beeResultLine(follow(dancing, hint)),
      beeResultLine(follow(dancing, (hint + 1) % PATCHES.length)),
      beeResultLine(run(dancing, B.keeperDelay + 1)),
    ];
    for (const line of lines) {
      expect(line).toEqual(expect.any(String));
      expect(line).not.toMatch(/lose|fail|wrong|bad/i);
    }
    expect(lines[0]).toMatch(/right/);
    expect(lines[2]).toMatch(/keeper/);
    expect(beeResultLine(dancing)).toBeNull();
  });

  it("reads a pollination as no income for the simulator's probes", () => {
    const dancing = toDance(tick(def, hived(), 0.1));
    const followed = follow(dancing, danceHint(dancing));
    expect(growIncomeView(followed).resources.bePending).toBe(0);
    expect(followed.resources.bePending).toBeGreaterThan(0);
  });

  it("gets the bots to follow the dance, and the idle bot never", () => {
    expect(BEE_ACTION_IDS).toHaveLength(PATCHES.length);
    const bots = growBots();
    const play = (strategy: typeof bots.tapper) =>
      simulate(def, {
        maxSeconds: 20 * 60,
        step: 1,
        strategy,
        stopWhen: (r) => r.phase >= 1,
      }).finalRun;
    expect(play(bots.tapper).resources.beFollows).toBeGreaterThan(0);
    expect(play(bots.idle).resources.beFollows ?? 0).toBe(0);
  });
});
