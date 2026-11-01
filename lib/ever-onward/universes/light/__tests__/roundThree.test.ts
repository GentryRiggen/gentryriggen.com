import {
  greetVisitor,
  metVisitors,
  newRun,
  tick,
  visibleTeasers,
  waitingVisitors,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { lightCountdown } from "../visitors";

const idle = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

const withOwned = (run: RunState, owned: Record<string, number>): RunState => ({
  ...run,
  owned: { ...run.owned, ...owned },
});

describe("visitors", () => {
  it("arrive on a milestone, never on a timer", () => {
    const quiet = idle(newRun(def), 3 * 3600);
    expect(waitingVisitors(def, quiet)).toHaveLength(0);
    const grown = tick(def, withOwned(quiet, { keeper: 6 }), 1);
    expect(waitingVisitors(def, grown).map((v) => v.id)).toEqual([
      "visitor-mail",
    ]);
    // the line it arrives with is in the story
    expect(grown.story).toContain("visitor-mail");
  });

  it("wait as long as it takes, and give their gift once", () => {
    const here = tick(def, withOwned(newRun(def), { keeper: 6 }), 1);
    const waited = idle(here, 2 * 3600);
    expect(waitingVisitors(def, waited)).toHaveLength(1);
    const greeted = greetVisitor(def, waited, "visitor-mail");
    expect(greeted.resources.coins).toBeGreaterThan(waited.resources.coins);
    expect(waitingVisitors(def, greeted)).toHaveLength(0);
    expect(metVisitors(def, greeted).map((v) => v.id)).toEqual([
      "visitor-mail",
    ]);
    // a second hello is a no-op, so the gift can't be farmed
    expect(greetVisitor(def, greeted, "visitor-mail")).toBe(greeted);
  });

  it("only come in their own phase", () => {
    const run = tick(def, withOwned(newRun(def), { collector: 6 }), 1);
    expect(waitingVisitors(def, run)).toHaveLength(0);
  });

  it("bring a small gift: at most about 15 seconds of income", () => {
    const here = tick(def, withOwned(newRun(def), { keeper: 6 }), 1);
    const gift =
      greetVisitor(def, here, "visitor-mail").resources.coins -
      here.resources.coins;
    expect(gift).toBeGreaterThan(0);
    const perSecond = gift / 15;
    // a minute of the same play earns far more than the gift
    expect(perSecond * 60).toBeGreaterThan(gift * 2);
  });
});

describe("someday cards", () => {
  it("show a hint, and go away when the upgrade pops in", () => {
    const early = withOwned(newRun(def), { lens: 4 });
    expect(visibleTeasers(def, early).map((t) => t.upgradeId)).toContain(
      "lighthouse"
    );
    const popped = { ...early, revealed: [...early.revealed, "lighthouse"] };
    expect(visibleTeasers(def, popped).map((t) => t.upgradeId)).not.toContain(
      "lighthouse"
    );
  });

  it("only hint at upgrades that exist", () => {
    const ids = new Set(def.upgrades.map((u) => u.id));
    for (const teaser of def.teasers ?? [])
      expect(ids.has(teaser.upgradeId)).toBe(true);
  });
});

describe("the sky's star countdown", () => {
  it("is only in the sky, and ticks mark where the relays wake", () => {
    expect(lightCountdown(newRun(def))).toBeNull();
    const sky = { ...newRun(def), phase: 2 };
    const view = lightCountdown({
      ...sky,
      resources: { ...sky.resources, stars: 800 },
    });
    expect(view?.value).toBe(800);
    expect(view?.marks).toEqual([700, 350]);
    expect(view?.detail).toMatch(/700/);
  });
});
