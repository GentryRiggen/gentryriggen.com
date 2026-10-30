import { createSail } from "../../sail/step";
import type { SailImpact, SailState } from "../../sail/types";
import { SMOOTH_FINISH_CELLS } from "../definitions";
import { describeSailEnd, describeGoal, describeValue } from "../format";
import { scoreSmooth } from "../score";
import {
  giveUpSmooth,
  NEW_SMOOTH_RUN,
  trackSmooth,
  type SmoothRun,
} from "../smooth";

function at(x: number, z = 0, impact: SailImpact | null = null): SailState {
  return { ...createSail(), x, z, impact };
}

const rockHit: SailImpact = {
  obstacleId: "r",
  kind: "rock",
  impactX: 3,
  part: "bow",
  closingSpeed: 2,
  at: 10,
};

describe("trackSmooth", () => {
  it("follows the farthest distance from the start", () => {
    let run = trackSmooth(NEW_SMOOTH_RUN, at(30, 40));
    expect(run).toEqual({ reach: 50, status: "sailing" });
    run = trackSmooth(run, at(10, 0));
    expect(run.reach).toBe(50);
  });

  it("keeps the same object while nothing changes", () => {
    const run = trackSmooth(NEW_SMOOTH_RUN, at(10));
    expect(trackSmooth(run, at(5))).toBe(run);
  });

  it("ends on a hard hit and remembers what it was", () => {
    const run = trackSmooth(NEW_SMOOTH_RUN, at(120, 0, rockHit));
    expect(run).toEqual({ reach: 120, status: "hit", hitKind: "rock" });
    expect(trackSmooth(run, at(400))).toBe(run);
  });

  it("ends at the finish line", () => {
    const run = trackSmooth(NEW_SMOOTH_RUN, at(SMOOTH_FINISH_CELLS + 1));
    expect(run.status).toBe("finished");
  });

  it("counts a hit on the line as a finish", () => {
    const run = trackSmooth(
      NEW_SMOOTH_RUN,
      at(SMOOTH_FINISH_CELLS, 0, rockHit)
    );
    expect(run.status).toBe("finished");
  });

  it("gives up only while sailing", () => {
    expect(giveUpSmooth({ reach: 40, status: "sailing" }).status).toBe(
      "gave-up"
    );
    const hit: SmoothRun = { reach: 40, status: "hit", hitKind: "ship" };
    expect(giveUpSmooth(hit)).toBe(hit);
  });
});

describe("scoreSmooth", () => {
  const stars = (reach: number) =>
    scoreSmooth({ reach, status: "hit", hitKind: "rock" }).stars;

  it("earns stars by distance", () => {
    expect([0, 149, 150, 299, 300, 499, 500].map(stars)).toEqual([
      0, 0, 1, 1, 2, 2, 3,
    ]);
  });

  it("rounds and caps the stored value", () => {
    expect(scoreSmooth({ reach: 150.6, status: "gave-up" }).value).toBe(151);
    expect(scoreSmooth({ reach: 900, status: "finished" })).toMatchObject({
      value: SMOOTH_FINISH_CELLS,
      stars: 3,
      isScored: true,
    });
  });

  it("carries how it ended", () => {
    expect(
      scoreSmooth({ reach: 80, status: "hit", hitKind: "ship" })
    ).toMatchObject({ sailEnd: "hit", hitKind: "ship" });
  });
});

describe("Smooth sailing words", () => {
  it("names the distance and the next target", () => {
    expect(describeValue("smooth", 120)).toBe("Sailed 120 cells clear");
    expect(describeValue("smooth", 500)).toBe("Sailed the whole course");
    expect(describeGoal("smooth", 0)).toBe("Sail 150 cells without a bump");
    expect(describeGoal("smooth", 300)).toBe(
      "Sail the whole 500-cell course without a bump"
    );
    expect(describeGoal("smooth", 500)).toBeNull();
  });

  it("says how the sail ended", () => {
    expect(describeSailEnd("hit", "rock")).toBe("She ran into a rock.");
    expect(describeSailEnd("hit", "ship")).toBe("She ran into another ship.");
    expect(describeSailEnd("hit", "iceberg")).toBe("She ran into an iceberg.");
    expect(describeSailEnd("finished", undefined)).toMatch(/finish line/);
    expect(describeSailEnd("gave-up", undefined)).toMatch(/early/);
  });
});
