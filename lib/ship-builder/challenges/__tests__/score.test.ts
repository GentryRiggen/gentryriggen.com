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
import { findTemplate, TEMPLATES } from "../../templates";
import { walkGridOf } from "../../walk";
import {
  CHALLENGE_STRIKE_FRACTION,
  NEVER_SINKS_MINUTES,
  NOT_SCORED,
} from "../definitions";
import {
  countSaved,
  scoreEvacuation,
  scoreOutlast,
  decidingSea,
  notScored,
  scoreShipshape,
  shipshapeRuns,
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
      isScored: true,
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

const run = (
  outcome: "steady" | "recovered" | "capsized",
  peakRollDeg: number,
  stabilityRatio = 0.03
) => ({ outcome, peakRollDeg, stabilityRatio });

describe("scoreShipshape", () => {
  const calm = run("steady", 1);
  const choppy = run("steady", 7);

  it("gives nothing for capsizing in calm or choppy seas", () => {
    expect(
      scoreShipshape({ calm: run("capsized", 90), choppy, stormy: choppy })
    ).toMatchObject({ stars: 0, sea: "calm" });
    expect(
      scoreShipshape({ calm, choppy: run("capsized", 90), stormy: choppy })
    ).toMatchObject({ stars: 0, sea: "choppy" });
  });

  it("gives one star for a choppy sea, decided by the stormy trial", () => {
    expect(
      scoreShipshape({ calm, choppy, stormy: run("capsized", 90) })
    ).toMatchObject({
      stars: 1,
      sea: "stormy",
      peakRollDeg: 90,
      hasCapsized: true,
    });
  });

  it("gives one star to a top-heavy ship that survives the storm", () => {
    expect(
      scoreShipshape({ calm, choppy, stormy: run("recovered", 39, 0.137) })
    ).toMatchObject({ stars: 1, hasCapsized: false });
  });

  it("gives two stars for a stormy sea ridden out with weight not low", () => {
    expect(
      scoreShipshape({ calm, choppy, stormy: run("recovered", 27.7, 0.109) })
    ).toMatchObject({ stars: 2, sea: "stormy" });
    expect(
      scoreShipshape({ calm, choppy, stormy: run("recovered", 39, 0.03) })
    ).toMatchObject({ stars: 2 });
  });

  it("gives three stars for a stormy sea with weight low and rolls steady", () => {
    expect(
      scoreShipshape({ calm, choppy, stormy: run("recovered", 27.7, 0.049) })
    ).toMatchObject({ id: "shipshape", value: 3, stars: 3, isScored: true });
  });

  it("is measured from the ship, not only the sea", () => {
    const ship = findTemplate("titanic")!.build();
    const runs = shipshapeRuns(inputOf(ship, "stormy", false));
    expect(runs.stormy.stabilityRatio).toBeCloseTo(0.109, 2);
  });

  it("names the sea that decided it", () => {
    expect(
      decidingSea({ calm, choppy: run("capsized", 90), stormy: choppy })
    ).toBe("choppy");
    expect(decidingSea({ calm, choppy, stormy: choppy })).toBe("stormy");
  });

  it("spreads the templates over one, two and three stars", () => {
    const starsOf = (id: string) => {
      const ship = findTemplate(id)!.build();
      return scoreShipshape(shipshapeRuns(inputOf(ship, "stormy", false)))
        .stars;
    };
    expect(starsOf("titanic")).toBe(2);
    expect(starsOf("wonder-of-the-seas")).toBe(1);
    expect(starsOf("arleigh-burke")).toBe(3);
    const spread = [0, 0, 0, 0];
    for (const t of Object.values(TEMPLATES).flat()) spread[starsOf(t.id)]++;
    expect(spread.slice(1).every((count) => count > 0)).toBe(true);
    expect(spread[0]).toBe(0);
  });
});

describe("the evacuation trial", () => {
  it("sinks every template, so none is a free three stars", () => {
    for (const template of Object.values(TEMPLATES).flat()) {
      const ship = template.build();
      const input = inputOf(ship, "calm", true);
      const wholeHull = {
        ...input,
        iceberg: { ...input.iceberg!, gashLength: input.length },
      };
      const timeline = extendWithDescent(buildTimeline(wholeHull), wholeHull);
      const last = timeline.states[timeline.states.length - 1];
      expect([template.id, last.outcome]).toEqual([template.id, "sank"]);
    }
  });

  it("is not scored when she stays afloat", () => {
    expect(notScored("evacuation")).toEqual({
      id: "evacuation",
      value: NOT_SCORED,
      stars: 0,
      isScored: false,
    });
  });
});
