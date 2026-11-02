import {
  canPerformAction,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growBots, keepsSeed } from "../bots";
import {
  BANK_SHARES,
  bankActionId,
  bankStep,
  bankStock,
  isBankOpen,
  savedShare,
  settledGain,
} from "../seedbank";
import { bankGain, incomePerSecond, manualPerTap } from "../tick";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

/** A farm with a few scarecrows and the bank set to `step`. */
function farm(step: number): RunState {
  const run = runAtPhaseStart(1);
  return {
    ...run,
    owned: { ...run.owned, scarecrow: 3 },
    resources: { ...run.resources, sbStep: step, sbStock: 0 },
  };
}

describe("the seed bank", () => {
  it("opens with two scarecrows and starts a new farm at a quarter", () => {
    const fresh = runAtPhaseStart(1);
    expect(bankStep(fresh)).toBe(1);
    expect(isBankOpen(fresh)).toBe(false);
    expect(isBankOpen(farm(1))).toBe(true);
  });

  it("keeping nothing pays every sack and fills nothing", () => {
    const run = farm(0);
    expect(savedShare(run)).toBe(0);
    const after = tick(def, run, 1);
    expect(bankStock(after)).toBe(0);
    expect(bankGain(after)).toBe(0);
  });

  it("keeping a share costs that share of the harvest now", () => {
    const plain = farm(0);
    const keeps = farm(2);
    expect(incomePerSecond(keeps)).toBeCloseTo(incomePerSecond(plain) * 0.5, 6);
    expect(manualPerTap(keeps)).toBeCloseTo(manualPerTap(plain) * 0.5, 6);
  });

  it("fills with the kept share and pays it back as a richer harvest", () => {
    let run = farm(1);
    const before = incomePerSecond(run) / (1 - savedShare(run));
    for (let i = 0; i < 300; i += 1) run = tick(def, run, 1);
    expect(bankStock(run)).toBeGreaterThan(0);
    expect(bankGain(run)).toBeGreaterThan(0.3);
    // After a while the quarter kept back is outweighed by the richer field.
    expect(incomePerSecond(run)).toBeGreaterThan(before * 0.75 * 1.3);
  });

  it("is capped and settles: the gain never passes the most it can give", () => {
    for (const share of BANK_SHARES)
      expect(settledGain(share)).toBeLessThan(TUNING.farm.bank.maxGain);
    expect(settledGain(0)).toBe(0);
    expect(settledGain(0.5)).toBeGreaterThan(settledGain(0.25));
  });

  it("spoils: seed left alone shrinks once nothing is kept", () => {
    let run = farm(1);
    for (let i = 0; i < 200; i += 1) run = tick(def, run, 1);
    const full = bankStock(run);
    run = {
      ...run,
      resources: { ...run.resources, sbStep: 0 },
    };
    for (let i = 0; i < 120; i += 1) run = tick(def, run, 1);
    expect(bankStock(run)).toBeLessThan(full);
  });

  it("is set by actions, one step at a time", () => {
    const run = farm(0);
    expect(canPerformAction(def, run, bankActionId(0))).toBe(false);
    expect(canPerformAction(def, run, bankActionId(2))).toBe(true);
    expect(bankStep(performAction(def, run, bankActionId(2)))).toBe(2);
  });

  it("is best at the middle step: a quarter beats keeping nothing or half", () => {
    const bot = growBots().realistic;
    const base = bot.actions!;
    const farmSeconds = (step: number): number => {
      const result = simulate(def, {
        maxSeconds: 8 * 3600,
        step: 1,
        strategy: {
          ...bot,
          actions: (run, available) => [
            ...base(
              run,
              available.filter((id) => !id.startsWith("seedbank-"))
            ).filter((id) => !id.startsWith("seedbank-")),
            ...keepsSeed(step)(run, available),
          ],
        },
        stopWhen: (run) => run.phase >= 2,
      });
      const farmStart = result.phases.find((p) => p.id === "farm")!.t;
      const worldStart = result.phases.find((p) => p.id === "world")!.t;
      return worldStart - farmStart;
    };
    const [none, quarter, half] = [0, 1, 2].map(farmSeconds);
    expect(quarter).toBeLessThan(none * 0.9);
    expect(quarter).toBeLessThan(half);
  });
});

describe("a save from before the seed bank", () => {
  it("loads with the bank off and plays exactly as before", () => {
    const run = farm(1);
    const old: RunState = {
      ...run,
      resources: Object.fromEntries(
        Object.entries(run.resources).filter(
          ([id]) => !id.startsWith("sb") && !id.startsWith("fk")
        )
      ),
    };
    const loaded = reconcileRun(def, old);
    expect(bankStep(loaded)).toBe(0);
    expect(bankStock(loaded)).toBe(0);
    expect(bankGain(loaded)).toBe(0);
    const next = tick(def, loaded, 1);
    expect(next.resources.harvest).toBeGreaterThan(loaded.resources.harvest);
    expect(bankStock(next)).toBe(0);
  });
});
