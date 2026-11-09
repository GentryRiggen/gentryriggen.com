import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { higherUniverse as def } from "../index";
import { higherBots } from "../bots";
import { descentShare } from "../descent";
import { packsFor, type PackStyle } from "../keepbots";
import {
  KEEPSAKES,
  carriedIndexes,
  endingWarmth,
  keepsakeShare,
  onTheStairs,
} from "../keepsakes";

jest.setTimeout(900_000);

/**
 * The Top is an ending: calm and kind. A full pack must cost a little (about
 * a tenth to a fifth more time), never a crawl, the first keepsake comes
 * in the first minute or so, and the choices come at an even pace.
 */

type Actions = NonNullable<Strategy["actions"]>;
const isKeep = (id: string): boolean =>
  id.startsWith("keep-") || id.startsWith("keepleave-");

/** A bot with its own packing swapped for `style`. */
function withPack(base: Strategy, style: PackStyle): Strategy {
  const inner = base.actions as Actions | undefined;
  return {
    ...base,
    actions: (run, available) => [
      ...(inner ? inner(run, available) : []).filter((id) => !isKeep(id)),
      ...packsFor(style, 5)(run, available),
    ],
  };
}

const bots = higherBots();
const STYLES: PackStyle[] = ["none", "late", "reads", "all", "warmest"];
const isDone = (run: RunState): boolean => (run.owned["set-down"] ?? 0) >= 1;

interface Result {
  minutes: number;
  warmth: number;
  carried: string[];
  brings: number;
}

let start: RunState;
const results: Record<string, Record<PackStyle, Result>> = {};

beforeAll(() => {
  start = simulate(def, {
    maxSeconds: 20 * 3600,
    step: 1,
    strategy: bots.realistic,
    stopWhen: (run) => run.phase >= 3,
  }).finalRun;
  for (const [name, bot] of [
    ["realistic", bots.realistic],
    ["dawdler", bots.dawdler],
  ] as const) {
    results[name] = {} as Record<PackStyle, Result>;
    for (const style of STYLES) {
      const sim = simulate(def, {
        maxSeconds: 72 * 3600,
        step: 1,
        startRun: start,
        strategy: withPack(bot, style),
        stopWhen: isDone,
      });
      const end = sim.finalRun;
      results[name][style] = {
        minutes: (end.time - start.time) / 60,
        warmth: endingWarmth(end),
        carried: carriedIndexes(end).map((i) => KEEPSAKES[i].id),
        brings: sim.actionsDone.filter((a) => a.id.startsWith("keep-")).length,
      };
    }
  }
});

describe.each(["realistic", "dawdler"])("%s player, uncapped", (name) => {
  it("pays about a tenth to a fifth more time for a full pack, never a crawl", () => {
    const empty = results[name].none.minutes;
    for (const style of ["late", "all", "warmest"] as const) {
      const extra = results[name][style].minutes / empty - 1;
      expect(extra).toBeGreaterThan(0.05);
      expect(extra).toBeLessThan(0.25);
    }
  });

  it("has no pack that is both the quickest to carry and the warmest", () => {
    const carrying = STYLES.filter((s) => s !== "none").map(
      (s) => [s, results[name][s]] as const
    );
    const quickest = Math.min(...carrying.map(([, r]) => r.minutes));
    const warmest = Math.max(...carrying.map(([, r]) => r.warmth));
    for (const [, r] of carrying)
      expect(r.minutes === quickest && r.warmth === warmest).toBe(false);
    expect(results[name].warmest.warmth).toBeGreaterThan(
      results[name].late.warmth
    );
  });

  it("carries something when it reads the cards, for real choices", () => {
    expect(results[name].reads.warmth).toBeGreaterThan(0);
    expect(results[name].reads.brings).toBeGreaterThan(0);
    expect(results[name].reads.minutes).toBeLessThan(results[name].all.minutes);
  });
});

describe("when the choices come", () => {
  const bot = (name: "realistic" | "tapper" | "dawdler"): Strategy =>
    withPack(bots[name], "none");

  for (const [name, firstBy, minGap] of [
    ["realistic", 75, 40],
    ["tapper", 75, 40],
    ["dawdler", 180, 40],
  ] as const) {
    it(`brings the first keepsake early and spreads them out for the ${name} player`, () => {
      const items = onTheStairs(start);
      const reached = new Map<number, number>();
      simulate(def, {
        maxSeconds: 30 * 3600,
        step: 1,
        startRun: start,
        strategy: bot(name),
        stopWhen: (run) => {
          for (const i of items)
            if (!reached.has(i) && descentShare(run) >= keepsakeShare(i))
              reached.set(i, run.time - start.time);
          return isDone(run);
        },
      });
      const times = items.map((i) => reached.get(i)!);
      expect(times[0]).toBeLessThanOrEqual(firstBy);
      for (let n = 1; n < times.length; n += 1)
        expect(times[n] - times[n - 1]).toBeGreaterThanOrEqual(minGap);
    });
  }
});
