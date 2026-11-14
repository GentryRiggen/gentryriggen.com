import { genericBots } from "../../../engine/bots";
import {
  canPerformAction,
  newRun,
  performAction,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { smilePlayer } from "../bots";
import {
  FORKS,
  FORK_ACTION_IDS,
  chooseSide,
  forkActionId,
  forkCost,
  forkResultLine,
  forkSide,
  isForkChosen,
  isForkOpen,
  type ForkSide,
} from "../forks";
import { def, runAtPhaseStart } from "./fixtures";

jest.setTimeout(120_000);

/** The number of minutes the realistic bot spends in each part on one side. */
function minutesPerPhase(side: ForkSide): number[] {
  const base = genericBots(def);
  const r = simulate(def, {
    strategy: smilePlayer(base.realistic, { side }),
    maxSeconds: 8 * 3600,
    step: 1,
  });
  const starts = [0, ...r.phases.map((p) => p.t)];
  const end = r.finishTime ?? r.endTime;
  return def.phases.map((_, i) => ((starts[i + 1] ?? end) - starts[i]) / 60);
}

describe("Smile forks", () => {
  it("has one fork per part, each with two sides, a catch and a blurb", () => {
    expect(FORKS.map((f) => f.phase)).toEqual(def.phases.map((p) => p.id));
    for (const fork of FORKS) {
      expect(fork.sides).toHaveLength(2);
      for (const side of fork.sides) {
        expect(side.name.length).toBeGreaterThan(3);
        expect(side.blurb.length).toBeGreaterThan(20);
        expect(side.catchLine.length).toBeGreaterThan(10);
      }
      expect(fork.sides[0].name).not.toBe(fork.sides[1].name);
    }
  });

  it("registers an action for every side of every fork", () => {
    for (const id of FORK_ACTION_IDS)
      expect(def.actions?.some((a) => a.id === id)).toBe(true);
    expect(FORK_ACTION_IDS).toHaveLength(8);
  });

  it("locks the other side once one is bought, in every part", () => {
    for (const fork of FORKS) {
      const index = def.phases.findIndex((p) => p.id === fork.phase);
      const start = runAtPhaseStart(index);
      const rich: RunState = {
        ...start,
        owned: { ...start.owned, ...openingPurchases(fork.id) },
        resources: {
          ...start.resources,
          [fork.currency]: forkCost(fork.id) * 10,
        },
      };
      expect(isForkOpen(rich, fork.id)).toBe(true);
      expect(isForkChosen(rich, fork.id)).toBe(false);
      const first = performAction(def, rich, forkActionId(fork.id, 1));
      expect(forkSide(first, fork.id)).toBe(1);
      expect(canPerformAction(def, first, forkActionId(fork.id, 0))).toBe(
        false
      );
      const second = performAction(def, first, forkActionId(fork.id, 0));
      expect(forkSide(second, fork.id)).toBe(1);
    }
  });

  it("is only ever chosen once, even by direct call", () => {
    const run = newRun(def);
    chooseSide(run, "friend", 0);
    chooseSide(run, "friend", 1);
    expect(forkSide(run, "friend")).toBe(0);
    expect(forkResultLine(run, "friend")).toMatch(/Tell jokes/);
  });

  it("reads an unchosen fork in an old save as not chosen", () => {
    expect(forkSide(newRun(def), "world")).toBeNull();
  });

  it("keeps both sides of every fork within 20% of each other on the sim", () => {
    const first = minutesPerPhase(0);
    const second = minutesPerPhase(1);
    const gaps = first.map(
      (m, i) => Math.abs(m - second[i]) / Math.min(m, second[i])
    );
    for (const g of gaps) expect(g).toBeLessThanOrEqual(0.2);
  });
});

/** The purchases that open each fork. */
function openingPurchases(id: string): Record<string, number> {
  return (
    {
      friend: { balloon: 3 },
      town: { band: 2 },
      world: { loudspeaker: 2 },
      quiet: { tea: 2 },
    } as Record<string, Record<string, number>>
  )[id];
}
