import { scoreTrace, scorecard } from "../scorecard";
import { simulate, type SimEvent, type Trace } from "../simulate";

const trace = (events: SimEvent[]): Trace => ({
  bot: "hand",
  seed: 0,
  durationSec: 9000,
  events,
  planetsWrecked: 0,
  stars: [],
  allUnlockedSec: null,
});

describe("progression sim", () => {
  it("gives the same trace for the same seed", () => {
    const a = simulate({ bot: "casual", seed: 3, minutes: 5 });
    const b = simulate({ bot: "casual", seed: 3, minutes: 5 });
    expect(a).toEqual(b);
  });

  it("explorer unlocks the meteor shower within 10 minutes", () => {
    const t = simulate({ bot: "explorer", seed: 1, minutes: 10 });
    expect(
      t.events.some((e) => e.kind === "tool" && e.id === "meteorShower")
    ).toBe(true);
  });

  it("scores a 30 s first unlock and a 4 min gap in full", () => {
    // Events every 4 minutes for 90 minutes, first at 30 s.
    const events: SimEvent[] = [{ t: 30, kind: "tool", id: "meteorShower" }];
    for (let t = 270; t <= 90 * 60; t += 240)
      events.push({ t, kind: "trophy", id: "x" });
    const s = scoreTrace(trace(events));
    const get = (id: string) => s.metrics.find((m) => m.id === id)!;
    expect(get("firstUnlockSec").points).toBe(15);
    expect(get("maxGapMin").points).toBe(25);
  });

  it("caps the total at 59 when a gate fails", () => {
    const perfect: SimEvent[] = [];
    for (let t = 30; t <= 90 * 60; t += 60) {
      perfect.push({ t, kind: "trophy", id: "x" });
    }
    // Everything fine except no tools ever unlock: allToolsMin gate fails.
    const s = scoreTrace(trace(perfect));
    expect(s.metrics.find((m) => m.id === "allToolsMin")!.gateFailed).toBe(
      true
    );
    expect(s.total).toBeLessThanOrEqual(59);
    expect(scorecard([trace(perfect)]).mean).toBeLessThanOrEqual(59);
  });
});
