import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
} from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { lightBots } from "../bots";
import { LAMP_STEPS, lampActionId } from "../lamps";
import {
  demandMW,
  isLampsOpen,
  knowhowPerSecond,
  lampStep,
  powerPerSecond,
  strainPerSecond,
} from "../tick";

jest.setTimeout(120_000);

const nightRun = (resources: Record<string, number> = {}): RunState => {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 3 },
    resources: { ...base.resources, night: 99, ...resources },
  });
};

describe("the streetlights", () => {
  it("opens with the grid, at Bright, and old saves read as Bright", () => {
    const run = nightRun();
    expect(isLampsOpen(run)).toBe(true);
    expect(lampStep(run)).toBe(2);
    const old = { ...run, resources: { ...run.resources } };
    delete old.resources.lamps;
    expect(lampStep(reconcileRun(def, old))).toBe(2);
    expect(isLampsOpen(newRun(def))).toBe(false);
  });

  it("trades pay against know-how, strain and the towns' demand", () => {
    const at = (step: number) =>
      performAction(def, nightRun(), lampActionId(step));
    const soft = at(0);
    const dazzling = at(3);
    const bright = nightRun();
    expect(powerPerSecond(soft)).toBeLessThan(powerPerSecond(bright));
    expect(powerPerSecond(dazzling)).toBeGreaterThan(powerPerSecond(bright));
    expect(knowhowPerSecond(soft)).toBeGreaterThan(knowhowPerSecond(bright));
    expect(knowhowPerSecond(dazzling)).toBeLessThan(knowhowPerSecond(bright));
    expect(strainPerSecond(soft)).toBeLessThan(strainPerSecond(dazzling));
    expect(demandMW(soft)).toBeLessThan(demandMW(dazzling));
  });

  it("is a radio group: the chosen step can't be chosen again", () => {
    const run = nightRun();
    expect(canPerformAction(def, run, lampActionId(2))).toBe(false);
    expect(canPerformAction(def, run, lampActionId(0))).toBe(true);
    expect(LAMP_STEPS).toHaveLength(4);
  });

  describe("over a whole night", () => {
    const bot = lightBots().realistic;
    const entry = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      strategy: bot,
      stopWhen: (r) => r.phase >= 1,
    }).finalRun;
    const held = (step: number): Strategy => ({
      ...bot,
      actions: (run, available) => {
        const others = (bot.actions?.(run, available) ?? []).filter(
          (id) => !id.startsWith("streetlights")
        );
        const id = lampActionId(step);
        return isLampsOpen(run) &&
          lampStep(run) !== step &&
          available.includes(id)
          ? [...others, id]
          : others;
      },
    });
    const minutes = (strategy: Strategy): number => {
      const r = simulate(def, {
        maxSeconds: 3 * 3600,
        step: 1,
        strategy,
        startRun: entry,
        stopWhen: (run) => run.phase > 1,
      });
      return (r.endTime - entry.time) / 60;
    };
    const policy = minutes(bot);
    const fixed = [0, 1, 2, 3].map((step) => minutes(held(step)));

    it("rewards changing it as the night goes", () => {
      for (const time of fixed) expect(policy).toBeLessThanOrEqual(time);
    });

    it("has no trap: even the worst step held all night is fine", () => {
      expect(Math.max(...fixed)).toBeLessThanOrEqual(policy * 1.25);
    });
  });
});
