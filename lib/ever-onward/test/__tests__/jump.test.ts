import { SCORED_UNIVERSES } from "../../universes/scored";
import { PLAYABLE_UNIVERSES } from "../../universes";
import { IN_SECONDS, jumpRun } from "../jump";
import { jumpTo } from "../bots";

describe("Test mode jumps", () => {
  it("covers every playable universe", () => {
    for (const u of PLAYABLE_UNIVERSES)
      expect(Object.keys(SCORED_UNIVERSES)).toContain(u.id);
  });

  for (const [id, { def, bots }] of Object.entries(SCORED_UNIVERSES)) {
    it(`${id}: every part's start, 3 min in and near the end land in that part`, () => {
      def.phases.forEach((_, phase) => {
        const start = jumpRun(def, bots(), phase, "start");
        const inRun = jumpRun(def, bots(), phase, "in");
        const late = jumpRun(def, bots(), phase, "late");
        for (const run of [start, inRun, late]) {
          expect(run.phase).toBe(phase);
          expect(run.complete).toBe(false);
        }
        expect(inRun.time - start.time).toBeCloseTo(IN_SECONDS, -1);
        expect(late.time).toBeGreaterThan(inRun.time);
      });
    });
  }

  it("returns null for an unknown universe", () => {
    expect(jumpTo("nowhere", 0, "start")).toBeNull();
  });
});
