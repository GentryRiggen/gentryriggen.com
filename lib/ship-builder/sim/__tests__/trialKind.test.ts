import { floodOf, isTimelineTrial, trialKindOf } from "../trialKind";
import type { CompartmentSpec, TrialInput } from "../types";

const specs: CompartmentSpec[] = [
  { id: "c0", fromX: 0, toX: 12, bowWall: 1, sternWall: 0.75 },
  { id: "c1", fromX: 12, toX: 30, bowWall: 0.75, sternWall: 1 },
];

const waves: TrialInput = {
  ship: { stabilityRatio: 0.06, listAngle: 0, beam: 6 },
  sea: "stormy",
  funnels: [],
  length: 30,
};
const storm: TrialInput = {
  ...waves,
  sea: "wild",
  storm: { compartments: specs, length: 30 },
};
const iceberg: TrialInput = {
  ...waves,
  iceberg: { compartments: specs, length: 30, impactX: 5, breakMode: "never" },
};

describe("trialKindOf", () => {
  it("tells the three trials apart", () => {
    expect(trialKindOf(waves)).toBe("waves");
    expect(trialKindOf(storm)).toBe("storm");
    expect(trialKindOf(iceberg)).toBe("iceberg");
  });

  it("only the storm and the iceberg are timeline trials", () => {
    expect(isTimelineTrial(waves)).toBe(false);
    expect(isTimelineTrial(storm)).toBe(true);
    expect(isTimelineTrial(iceberg)).toBe(true);
  });
});

describe("floodOf", () => {
  it("is null for a waves trial", () => {
    expect(floodOf(waves)).toBeNull();
  });

  it("gives the storm's compartments, breaking the real way by default", () => {
    expect(floodOf(storm)).toEqual({
      compartments: specs,
      length: 30,
      breakMode: "real",
    });
    expect(
      floodOf({ ...storm, storm: { ...storm.storm!, breakMode: "always" } })
    ).toEqual({ compartments: specs, length: 30, breakMode: "always" });
  });

  it("gives the iceberg's compartments and break mode", () => {
    expect(floodOf(iceberg)).toEqual({
      compartments: specs,
      length: 30,
      breakMode: "never",
    });
    const { breakMode: _unused, ...plain } = iceberg.iceberg!;
    void _unused;
    expect(floodOf({ ...iceberg, iceberg: plain })?.breakMode).toBe("real");
  });
});
