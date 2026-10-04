import {
  SINK_DEPTH,
  TRIAL_DURATION_S,
  createTrial,
  runTrial,
  stepTrial,
} from "../seaTrial";
import type { SimSea, SimState, TrialOutcome, TrialInput } from "../types";
import { SIM_STEP_S } from "../types";

const DEG = Math.PI / 180;

function trialOf(
  stabilityRatio: number,
  listDegrees: number,
  sea: SimSea
): TrialInput {
  return {
    ship: { stabilityRatio, listAngle: listDegrees * DEG, beam: 4 },
    sea,
  };
}

/** Ratios chosen well inside each stability class, bar the edges. */
const STABLE = [-0.2, 0, 0.06, 0.12];
const TOP_HEAVY = [0.18, 0.22, 0.27];
const DANGEROUS = [0.33, 0.45, 0.7];
/** Resting lists clear of the 8 degree threshold: level, then lopsided. */
const LEVEL_LISTS = [0, 3, 6, -3, -6];
const LOPSIDED_LISTS = [9, 12, 16, -9, -16];
const HEAVY_LISTS = [19, 25, -19, -25];

const SEAS: SimSea[] = ["calm", "choppy", "stormy"];

type Row = [SimSea, TrialOutcome];

const LEVEL_TABLE: Record<string, Row[]> = {
  stable: [
    ["calm", "steady"],
    ["choppy", "steady"],
    ["stormy", "recovered"],
  ],
  "top-heavy": [
    ["calm", "steady"],
    ["choppy", "recovered"],
    ["stormy", "capsized"],
  ],
  dangerous: [
    ["calm", "recovered"],
    ["choppy", "capsized"],
    ["stormy", "capsized"],
  ],
};

/** One step worse than the level table. */
const LOPSIDED_TABLE: Record<string, Row[]> = {
  stable: LEVEL_TABLE["top-heavy"],
  "top-heavy": LEVEL_TABLE.dangerous,
  dangerous: [
    ["calm", "capsized"],
    ["choppy", "capsized"],
    ["stormy", "capsized"],
  ],
};

const CLASSES: Record<string, number[]> = {
  stable: STABLE,
  "top-heavy": TOP_HEAVY,
  dangerous: DANGEROUS,
};

function check(table: Record<string, Row[]>, lists: number[]): void {
  for (const [name, ratios] of Object.entries(CLASSES)) {
    for (const ratio of ratios) {
      for (const list of lists) {
        for (const [sea, expected] of table[name]) {
          const result = runTrial(trialOf(ratio, list, sea));
          expect([name, ratio, list, sea, result.outcome]).toEqual([
            name,
            ratio,
            list,
            sea,
            expected,
          ]);
        }
      }
    }
  }
}

describe("sea trial outcomes", () => {
  it("follows the level table", () => {
    check(LEVEL_TABLE, LEVEL_LISTS);
  });

  it("counts a lopsided ship one step worse", () => {
    check(LOPSIDED_TABLE, LOPSIDED_LISTS);
  });

  it("capsizes a heavily listing ship in any sea", () => {
    for (const ratio of [...STABLE, ...TOP_HEAVY, ...DANGEROUS]) {
      for (const list of HEAVY_LISTS) {
        for (const sea of SEAS) {
          expect(runTrial(trialOf(ratio, list, sea)).outcome).toBe("capsized");
        }
      }
    }
  });

  it("blames the list when the list tipped her", () => {
    expect(runTrial(trialOf(0.06, 12, "stormy")).reason).toBe("lopsided");
    expect(runTrial(trialOf(0.22, 12, "calm")).reason).toBe("lopsided");
    expect(runTrial(trialOf(0.06, 20, "calm")).reason).toBe("lopsided");
  });

  it("blames the stability class otherwise", () => {
    expect(runTrial(trialOf(0.06, 0, "calm")).reason).toBe("stable");
    expect(runTrial(trialOf(0.22, 0, "stormy")).reason).toBe("top-heavy");
    expect(runTrial(trialOf(0.45, 0, "choppy")).reason).toBe("dangerous");
    expect(runTrial(trialOf(0.22, 0, "choppy")).reason).toBe("top-heavy");
  });

  it("calls a stable ship's stormy roll rough-sea", () => {
    const result = runTrial(trialOf(0.06, 0, "stormy"));
    expect(result.outcome).toBe("recovered");
    expect(result.reason).toBe("rough-sea");
  });
});

describe("sea trial run", () => {
  it("is identical every run", () => {
    const input = trialOf(0.22, 2, "choppy");
    expect(runTrial(input)).toEqual(runTrial(input));
  });

  it("lets a steady trial run about 9 seconds, then end done", () => {
    const result = runTrial(trialOf(0.06, 0, "calm"));
    expect(result.phase).toBe("done");
    expect(result.time).toBeGreaterThanOrEqual(TRIAL_DURATION_S);
    expect(result.time).toBeLessThan(TRIAL_DURATION_S + 0.1);
    expect(result.events).toEqual([]);
    expect(Math.abs(result.pose.roll)).toBeLessThan(0.1);
    expect(result.pose.sink).toBe(0);
  });

  it("records a big roll and a recovery for a rough but safe trial", () => {
    const kinds = runTrial(trialOf(0.06, 0, "stormy")).events.map(
      (e) => e.kind
    );
    expect(kinds).toEqual(["big-roll", "recovered"]);
  });

  it("capsizes, sinks, then ends with sunk", () => {
    const input = trialOf(0.45, 0, "stormy");
    let state: SimState = createTrial(input);
    const phases: string[] = [];
    let maxPitchDown = 0;
    while (state.phase !== "done" && state.time < 60) {
      state = stepTrial(input, state);
      if (phases[phases.length - 1] !== state.phase) phases.push(state.phase);
      maxPitchDown = Math.min(maxPitchDown, state.pose.pitch);
    }
    expect(phases).toEqual(["sailing", "capsizing", "sinking", "done"]);
    expect(state.outcome).toBe("capsized");
    expect(Math.abs(state.pose.roll)).toBeGreaterThan(160 * DEG);
    expect(Math.abs(state.pose.roll)).toBeLessThanOrEqual(170 * DEG + 1e-9);
    expect(state.pose.sink).toBe(SINK_DEPTH);
    expect(maxPitchDown).toBeLessThan(0);
    expect(state.events.map((e) => e.kind)).toContain("capsized");
    expect(state.events[state.events.length - 1].kind).toBe("sunk");
    expect(state.time).toBeLessThan(30);
  });

  it("sets the outcome the moment she capsizes, before she sinks", () => {
    const input = trialOf(0.45, 0, "stormy");
    let state = createTrial(input);
    while (state.phase === "sailing") state = stepTrial(input, state);
    expect(state.phase).toBe("capsizing");
    expect(state.outcome).toBe("capsized");
    expect(state.reason).toBe("dangerous");
  });

  it("rolls over toward the side she was listing to", () => {
    const starboard = runTrial(trialOf(0.22, 12, "stormy"));
    const port = runTrial(trialOf(0.22, -12, "stormy"));
    expect(starboard.pose.roll).toBeGreaterThan(0);
    expect(port.pose.roll).toBeLessThan(0);
  });

  it("plays a port-listing ship as the exact mirror of a starboard one", () => {
    const starboard = runTrial(trialOf(0.22, 12, "choppy"));
    const port = runTrial(trialOf(0.22, -12, "choppy"));
    expect(port.pose.roll).toBeCloseTo(-starboard.pose.roll, 10);
    expect(port.outcome).toBe(starboard.outcome);
  });

  it("starts at her resting list, not upright", () => {
    expect(createTrial(trialOf(0.06, 5, "calm")).pose.roll).toBeCloseTo(
      5 * DEG
    );
  });

  it("does not change a finished state", () => {
    const input = trialOf(0.06, 0, "calm");
    const done = runTrial(input);
    expect(stepTrial(input, done)).toBe(done);
  });

  it("ignores actions for now and keeps compartments empty", () => {
    const input = trialOf(0.22, 0, "choppy");
    const state = createTrial(input);
    expect(stepTrial(input, state, [])).toEqual(stepTrial(input, state));
    expect(runTrial(input).compartments).toEqual([]);
  });

  it("advances time by one fixed step", () => {
    const input = trialOf(0.06, 0, "calm");
    expect(stepTrial(input, createTrial(input)).time).toBeCloseTo(SIM_STEP_S);
  });
});
