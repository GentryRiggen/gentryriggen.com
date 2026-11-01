import { performAction, tick } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growBots } from "../bots";
import {
  FAIR_ACTION_IDS,
  FAIR_HAND_ID,
  PUMPKIN_COUNT,
  enterActionId,
  expectedSeconds,
  fairResultLine,
  fairsSoFar,
  handShown,
  isFairOn,
  isFairOpen,
  likeliestPumpkin,
  placeChances,
  ribbonPays,
  ribbonSeconds,
} from "../fair";
import { growIncomeView } from "../hooks";
import { incomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const F = TUNING.fair;

let farm: RunState | undefined;
/** A farm run that owns a tractor, so the fair opens on the first tick. */
const fairy = (owned: Record<string, number> = {}): RunState => {
  farm ??= runAtPhaseStart(1);
  return {
    ...farm,
    owned: { scarecrow: 6, tractor: 1, ...owned },
    resources: { ...farm.resources, harvest: 100 },
    flags: { ...farm.flags },
  };
};

const run = (from: RunState, seconds: number): RunState => {
  let next = from;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

function toFair(from: RunState, limit = 400): RunState {
  let next = from;
  for (let t = 0; t < limit && !isFairOn(next); t += 1)
    next = tick(def, next, 1);
  return next;
}

const enter = (from: RunState, pick: number): RunState =>
  performAction(def, from, enterActionId(pick));

/** Enters and waits out the judges. */
const judged = (from: RunState, pick: number): RunState =>
  run(enter(from, pick), F.judgeSeconds + 1);

describe("the county fair", () => {
  it("opens on the first tractor, never on a timer", () => {
    const base = fairy();
    const waited = run({ ...base, owned: { scarecrow: 6 } }, 600);
    expect(isFairOpen(waited)).toBe(false);
    expect(waited.resources.frShown ?? 0).toBe(0);
    expect(isFairOpen(tick(def, base, 0.1))).toBe(true);
  });

  it("shows odds that add up and match 2,000 seeded judgings within 3 points", () => {
    const on = toFair(tick(def, fairy(), 0.1));
    expect(isFairOn(on)).toBe(true);
    for (let pick = 0; pick < PUMPKIN_COUNT; pick += 1) {
      const chances = placeChances(on, pick);
      expect(chances.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      const counts = [0, 0, 0];
      for (let i = 0; i < 2000; i += 1) {
        const seeded = {
          ...on,
          resources: { ...on.resources, frRng: i * 7919 + pick * 31 + 1 },
        };
        counts[judged(seeded, pick).resources.frPlace] += 1;
      }
      chances.forEach((c, ribbon) =>
        expect(Math.abs(counts[ribbon] / 2000 - c)).toBeLessThan(0.03)
      );
    }
  });

  it("pays something for every ribbon, and better pumpkins pay more on average", () => {
    const on = toFair(tick(def, fairy(), 0.1));
    const income = incomePerSecond(on);
    for (let ribbon = 0; ribbon < 3; ribbon += 1)
      expect(ribbonPays(ribbon, income)).toBeGreaterThan(0);
    expect(ribbonSeconds(0)).toBeGreaterThan(ribbonSeconds(1));
    expect(ribbonSeconds(1)).toBeGreaterThan(ribbonSeconds(2));
    const best = likeliestPumpkin(on);
    for (let i = 0; i < PUMPKIN_COUNT; i += 1)
      expect(expectedSeconds(on, best)).toBeGreaterThanOrEqual(
        expectedSeconds(on, i)
      );
    for (let seed = 1; seed <= 40; seed += 1) {
      const s = toFair(tick(def, { ...fairy(), rng: seed * 7919 }, 0.1));
      const after = judged(s, 0);
      expect(after.resources.frLastPays).toBeGreaterThan(0);
    }
  });

  it("offers one decision every couple of minutes", () => {
    expect(F.waitSeconds).toBeGreaterThanOrEqual(90);
    let r = judged(toFair(tick(def, fairy(), 0.1)), 0);
    let waited = 0;
    while (!isFairOn(r) && waited < 400) {
      r = tick(def, r, 1);
      waited += 1;
    }
    expect(waited).toBeGreaterThanOrEqual(90);
    expect(waited).toBeLessThanOrEqual(130);
  });

  it("waits for the player and loses nothing when ignored", () => {
    const on = toFair(tick(def, fairy(), 0.1));
    const later = run(on, 2000);
    expect(isFairOn(later)).toBe(true);
    expect(later.resources.frShown).toBe(1);
    expect(later.resources.harvest).toBeGreaterThanOrEqual(
      on.resources.harvest
    );
    expect(placeChances(later, 0)).toEqual(placeChances(on, 0));
  });

  it("lets the fair helper add to hand play, never replace it", () => {
    const base = tick(def, fairy({ [FAIR_HAND_ID]: 1 }), 0.1);
    const on = toFair(base);
    const helped = run(on, F.handDelay + F.judgeSeconds + 1);
    expect(helped.resources.frBy).toBe(1);
    expect(fairsSoFar(helped)).toBe(1);
    expect(helped.resources.frLastPays).toBeGreaterThan(0);
    const tended = enter(run(on, 5), likeliestPumpkin(on));
    expect(tended.resources.frBy).toBe(0);
    // over a long stretch, hand plus helper beats the helper alone
    let withHand = on;
    let helperOnly = on;
    for (let t = 0; t < 1200; t += 1) {
      withHand = tick(def, withHand, 1);
      if (isFairOn(withHand) && withHand.resources.frTime >= 2)
        withHand = enter(withHand, likeliestPumpkin(withHand));
      helperOnly = tick(def, helperOnly, 1);
    }
    expect(withHand.resources.frEarned).toBeGreaterThan(
      helperOnly.resources.frEarned
    );
    expect(helperOnly.resources.frEarned).toBeGreaterThan(0);
  });

  it("shows the fair helper once the first fair is judged", () => {
    let r = toFair(tick(def, fairy(), 0.1));
    expect(handShown(r)).toBe(false);
    r = judged(r, 0);
    expect(handShown(r)).toBe(true);
    expect(
      def.upgrades.find((u) => u.id === FAIR_HAND_ID)?.visibleWhen?.(r)
    ).toBe(true);
  });

  it("counts one fair per judging, and pays in flight after the farm ends", () => {
    const on = toFair(tick(def, fairy(), 0.1));
    const sent = enter(on, 0);
    expect(fairsSoFar(sent)).toBe(0);
    // the farm ends while the judges are still walking the row
    const ended: RunState = { ...sent, phase: 2 };
    const after = run(ended, F.judgeSeconds + F.surgeSeconds + 2);
    expect(fairsSoFar(after)).toBe(1);
    expect(after.resources.frPending).toBe(0);
    expect(after.resources.green).toBeGreaterThan(ended.resources.green ?? 0);
  });

  it("uses its own random stream", () => {
    const start = tick(def, fairy(), 0.1);
    let r = start;
    for (let i = 0; i < 5; i += 1) r = judged(toFair(r), 1);
    expect(r.resources.frFairs).toBe(5);
    expect(r.resources.frShown).toBe(5);
    expect(r.rng).toBe(start.rng);
  });

  it("keeps result copy kind", () => {
    const on = toFair(tick(def, fairy({ [FAIR_HAND_ID]: 1 }), 0.1));
    const lines: (string | null)[] = [];
    for (let seed = 1; seed <= 30; seed += 1)
      lines.push(
        fairResultLine(
          judged({ ...on, resources: { ...on.resources, frRng: seed } }, 0)
        )
      );
    lines.push(fairResultLine(run(on, F.handDelay + F.judgeSeconds + 1)));
    for (const line of lines) {
      expect(line).toEqual(expect.any(String));
      expect(line).not.toMatch(/lose|lost|fail|wrong|bad/i);
    }
    expect(fairResultLine(on)).toBeNull();
  });

  it("reads a payout in flight as no income for the simulator's probes", () => {
    const on = toFair(tick(def, fairy(), 0.1));
    const done = enter(on, 0);
    const r = run(done, F.judgeSeconds);
    expect(r.resources.frPending).toBeGreaterThan(0);
    expect(growIncomeView(r).resources.frPending).toBe(0);
  });

  it("gets the bots to enter, and the idle bot never", () => {
    expect(FAIR_ACTION_IDS).toHaveLength(PUMPKIN_COUNT);
    const bots = growBots();
    const start = runAtPhaseStart(1);
    const play = (strategy: typeof bots.tapper) =>
      simulate(def, {
        strategy,
        startRun: start,
        maxSeconds: 20 * 60,
        stopWhen: (r) => r.phase >= 2,
      }).finalRun;
    expect(play(bots.tapper).resources.frFairs).toBeGreaterThan(0);
    expect(play(bots.idle).resources.frFairs ?? 0).toBe(0);
  });
});
