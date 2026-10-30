import { analyzeShip } from "../../model/analysis";
import { gridLength } from "../../model/grid";
import type { Ship } from "../../model/types";
import { planCrowd } from "../../crowd/plan";
import { planEvacuation } from "../../crowd/evacuation";
import { compartmentSpecsOf } from "../../sim/compartments";
import { runTrial } from "../../sim/seaTrial";
import { simShipFromStats } from "../../sim/simShip";
import {
  buildTimeline,
  extendWithDescent,
  stateAt,
  timelineEnd,
} from "../../sim/timeline";
import { trialFunnelsOf } from "../../sim/trialFunnels";
import type { SimState, TrialInput } from "../../sim/types";
import { findTemplate } from "../../templates";
import { walkGridOf } from "../../walk";
import { CHALLENGE_STRIKE_FRACTION, NEVER_SINKS_MINUTES } from "../definitions";
import {
  countSaved,
  scoreEvacuation,
  scoreOutlast,
  scoreShipshape,
  shipshapeOutcomes,
} from "../score";

function inputOf(
  ship: Ship,
  sea: "calm" | "stormy",
  strike: boolean
): TrialInput {
  const length = gridLength(ship);
  return {
    ship: simShipFromStats(analyzeShip(ship).stats, ship.hull.beam),
    sea,
    length,
    funnels: trialFunnelsOf(ship),
    ...(strike
      ? {
          iceberg: {
            compartments: compartmentSpecsOf(ship.hull),
            length,
            impactX: length * CHALLENGE_STRIKE_FRACTION,
            breakMode: "real" as const,
          },
        }
      : {}),
  };
}

function icebergRun(id: string) {
  const ship = findTemplate(id)!.build();
  const input = inputOf(ship, "calm", true);
  const timeline = extendWithDescent(buildTimeline(input), input);
  const last: SimState = timeline.states[timeline.states.length - 1];
  return { ship, input, timeline, last };
}

describe("scoreOutlast", () => {
  it("gives the Titanic about one star (she sinks in under 2h 40m)", () => {
    const { last } = icebergRun("titanic");
    const score = scoreOutlast(last);
    expect(score.id).toBe("outlast");
    expect(score.value).toBeGreaterThanOrEqual(60);
    expect(score.value).toBeLessThan(160);
    expect(score.stars).toBe(1);
  });

  it("gives three stars to a ship that stays afloat", () => {
    const { last } = icebergRun("britannic");
    expect(last.outcome).toBe("afloat");
    expect(scoreOutlast(last)).toEqual({
      id: "outlast",
      value: NEVER_SINKS_MINUTES,
      stars: 3,
    });
  });

  it("gives a quick sinker no stars", () => {
    const { last } = icebergRun("small-sloop");
    expect(last.outcome).toBe("sank");
    expect(scoreOutlast(last).stars).toBe(0);
  });

  it("scores an unfinished or weather trial as nothing", () => {
    const ship = findTemplate("titanic")!.build();
    const waves = runTrial(inputOf(ship, "stormy", false));
    expect(scoreOutlast(waves)).toMatchObject({ value: 0, stars: 0 });
  });
});

describe("scoreEvacuation", () => {
  it.each([
    [24, 5, 0],
    [24, 6, 1],
    [24, 12, 1],
    [24, 18, 2],
    [24, 23, 2],
    [24, 24, 3],
  ])("%i people with %i saved earns %i stars", (people, saved, stars) => {
    expect(scoreEvacuation(people, saved).stars).toBe(stars);
  });

  it("scores a ship with nobody aboard as nothing", () => {
    expect(scoreEvacuation(0, 0)).toMatchObject({ value: 0, stars: 0 });
  });

  it("never goes over 100 percent", () => {
    expect(scoreEvacuation(2, 5).value).toBe(100);
  });

  it("counts the Titanic's boats as one star", () => {
    const { ship, input, timeline } = icebergRun("titanic");
    const grid = walkGridOf(ship);
    const crowd = planCrowd(ship, grid, analyzeShip(ship).stats);
    const plan = planEvacuation(ship, grid, crowd, {
      input,
      stateAt: (t) => stateAt(timeline, t),
      end: timelineEnd(timeline),
    })!;
    const saved = countSaved(plan, crowd.people.length, timelineEnd(timeline));
    expect(saved).toBeGreaterThan(0);
    expect(saved).toBeLessThan(crowd.people.length);
    expect(scoreEvacuation(crowd.people.length, saved).stars).toBe(1);
  });
});

describe("scoreShipshape", () => {
  it("counts the seas survived in order", () => {
    expect(
      scoreShipshape({
        calm: "capsized",
        choppy: "steady",
        stormy: "steady",
      }).stars
    ).toBe(0);
    expect(
      scoreShipshape({ calm: "steady", choppy: "capsized", stormy: "steady" })
        .stars
    ).toBe(1);
    expect(
      scoreShipshape({
        calm: "steady",
        choppy: "recovered",
        stormy: "capsized",
      }).stars
    ).toBe(2);
    expect(
      scoreShipshape({
        calm: "steady",
        choppy: "steady",
        stormy: "recovered",
      })
    ).toEqual({ id: "shipshape", value: 3, stars: 3 });
  });

  it("gives a stable template three stars", () => {
    const ship = findTemplate("titanic")!.build();
    const outcomes = shipshapeOutcomes(inputOf(ship, "stormy", false));
    expect(scoreShipshape(outcomes).stars).toBe(3);
  });
});
