import { createSail } from "../../sail/step";
import type { SailImpact, SailState } from "../../sail/types";
import { NOT_SCORED, SMOOTH_FINISH_CELLS } from "../definitions";
import {
  CANNOT_SAIL_TEXT,
  describeGoal,
  describeSailEnd,
  describeValue,
} from "../format";
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
    expect([0, 99, 100, 199, 200, 349, 350].map(stars)).toEqual([
      0, 0, 1, 1, 2, 2, 3,
    ]);
  });

  it("rounds and caps the stored value", () => {
    expect(scoreSmooth({ reach: 100.6, status: "gave-up" }).value).toBe(101);
    expect(scoreSmooth({ reach: 600, status: "finished" })).toMatchObject({
      value: SMOOTH_FINISH_CELLS,
      stars: 3,
      isScored: true,
    });
  });

  it("is not scored for a ship that cannot sail", () => {
    expect(scoreSmooth({ reach: 0, status: "cannot-sail" })).toEqual({
      id: "smooth",
      value: NOT_SCORED,
      stars: 0,
      isScored: false,
    });
    expect(describeValue("smooth", NOT_SCORED)).toBe(CANNOT_SAIL_TEXT);
  });

  it("carries how it ended", () => {
    expect(
      scoreSmooth({ reach: 80, status: "hit", hitKind: "ship" })
    ).toMatchObject({ sailEnd: "hit", hitKind: "ship" });
  });
});

describe("Smooth sailing words", () => {
  it("names the distance and the next target", () => {
    expect(describeValue("smooth", 120)).toBe(
      "Got 120 cells from the start without a bump"
    );
    expect(describeValue("smooth", 350)).toBe(
      "Reached the finish line without a bump"
    );
    expect(describeGoal("smooth", 0)).toBe(
      "Get 100 cells from the start without a bump"
    );
    expect(describeGoal("smooth", 200)).toBe(
      "Reach the finish line, 350 cells from the start, without a bump"
    );
    expect(describeGoal("smooth", 350)).toBeNull();
  });

  it("says how the sail ended", () => {
    expect(describeSailEnd("hit", "rock")).toBe("She ran into a rock.");
    expect(describeSailEnd("hit", "ship")).toBe("She ran into another ship.");
    expect(describeSailEnd("hit", "iceberg")).toBe("She ran into an iceberg.");
    expect(describeSailEnd("finished", undefined)).toMatch(/finish line/);
    expect(describeSailEnd("gave-up", undefined)).toMatch(/early/);
  });
});
