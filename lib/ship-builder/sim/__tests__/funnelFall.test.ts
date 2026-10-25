import { Euler, Vector3, Object3D } from "three";
import { applyHalfPose } from "@/components/ship-builder/scene/halfTransform";
import { computeStats } from "../../model/stats";
import { CELLS_PER_SEGMENT } from "../../model/grid";
import type { Ship } from "../../model/types";
import { findTemplate } from "../../templates";
import { compartmentSpecsOf } from "../compartments";
import { DESCENT_SPEED, FLOOR_DEPTH, startDescent } from "../descent";
import {
  FLOAT_S,
  SECOND_FALL_GAP_S,
  TOPPLE_S,
  fallingFunnelPose,
  poseWorldPoint,
  stepFunnelFalls,
} from "../funnelFall";
import { createTrial, runTrial, stepTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import { trialFunnelsOf } from "../trialFunnels";
import {
  type BreakMode,
  type FunnelFall,
  type SimState,
  type TrialFunnel,
  type TrialInput,
} from "../types";

const DEG = Math.PI / 180;

function templateShip(id: string): Ship {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.build();
}

function icebergInput(
  ship: Ship,
  impactX: number,
  breakMode?: BreakMode,
  funnels = trialFunnelsOf(ship)
): TrialInput {
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    funnels,
    length,
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length,
      impactX,
      ...(breakMode ? { breakMode } : {}),
    },
  };
}

/** Runs to the sea floor, keeping every state. */
function statesOf(input: TrialInput): SimState[] {
  let state = createTrial(input);
  const states = [state];
  for (let i = 0; i < 60 * 400; i++) {
    state = stepTrial(input, state);
    if (state.phase === "done") {
      const next = startDescent(state);
      if (next === state) {
        states.push(state);
        break;
      }
      state = next;
    }
    states.push(state);
  }
  return states;
}

function funnel(id: string, cellX: number): TrialFunnel {
  return { id, cellX, baseY: 2.2, baseZ: 0, height: 3.2 };
}

describe("poseWorldPoint", () => {
  const length = 60;
  const point = { x: 7, y: 2.2, z: -1.5 };

  it("matches three for a whole ship", () => {
    for (const [roll, pitch, sink] of [
      [0.3, -0.2, 4],
      [-2.1, 0.5, 0],
      [3, -0.35, 12],
    ]) {
      const expected = new Vector3(point.x, point.y, point.z)
        .applyEuler(new Euler(roll, 0, pitch))
        .add(new Vector3(0, -sink, 0));
      const got = poseWorldPoint({ roll, pitch, sink }, length, point);
      expect(got.x).toBeCloseTo(expected.x, 9);
      expect(got.y).toBeCloseTo(expected.y, 9);
      expect(got.z).toBeCloseTo(expected.z, 9);
    }
  });

  it("matches applyHalfPose for a half", () => {
    const pose = {
      roll: 0.4,
      pitch: -0.9,
      sink: 7,
      pivotX: 21,
      driftX: -1.3,
    };
    const target = new Object3D();
    applyHalfPose(target, pose, length);
    target.updateMatrix();
    const expected = new Vector3(point.x, point.y, point.z).applyMatrix4(
      target.matrix
    );
    const got = poseWorldPoint(pose, length, point);
    expect(got.x).toBeCloseTo(expected.x, 9);
    expect(got.y).toBeCloseTo(expected.y, 9);
    expect(got.z).toBeCloseTo(expected.z, 9);
  });

  it("pins the sign: positive roll sinks the +Z side", () => {
    const high = poseWorldPoint({ roll: 0.3, pitch: 0, sink: 0 }, length, {
      x: 0,
      y: 0,
      z: 2,
    });
    expect(high.y).toBeLessThan(0);
  });

  it("pins the sign: negative pitch drops the bow (+X)", () => {
    const bow = poseWorldPoint({ roll: 0, pitch: -0.3, sink: 0 }, length, {
      x: 20,
      y: 0,
      z: 0,
    });
    expect(bow.y).toBeLessThan(0);
  });
});

describe("funnels breaking in an iceberg sinking", () => {
  const titanic = templateShip("titanic");

  it("breaks two off a Titanic, the bow-most first", () => {
    const funnels = trialFunnelsOf(titanic);
    expect(funnels.length).toBeGreaterThanOrEqual(3);
    const input = icebergInput(titanic, 5);
    expect(runTrial(input).outcome).toBe("sank");
    const bowMost = [...funnels].sort((a, b) => a.cellX - b.cellX)[0];
    const last = statesOf(input).at(-1) as SimState;
    expect(last.funnelFalls).toHaveLength(2);
    expect(last.funnelFalls[0].funnelId).toBe(bowMost.id);
    expect(last.funnelFalls[1].at - last.funnelFalls[0].at).toBeGreaterThan(
      SECOND_FALL_GAP_S - 1e-9
    );
    expect(last.events.filter((e) => e.kind === "funnel-broke")).toEqual(
      last.funnelFalls.map((f) => ({
        at: f.at,
        kind: "funnel-broke",
        funnelId: f.funnelId,
      }))
    );
  });

  it("waits for her to tip before choosing the sinking end", () => {
    // With no walls she settles level first, so the first sinking step has
    // no pitch yet: the bow still goes down first after a hit near the bow.
    const ship: Ship = {
      ...titanic,
      hull: { ...titanic.hull, bulkheads: [] },
    };
    const input = icebergInput(ship, 12);
    const bowMost = [...trialFunnelsOf(ship)].sort(
      (a, b) => a.cellX - b.cellX
    )[0];
    const last = statesOf(input).at(-1) as SimState;
    expect(last.funnelEnd).toBe("bow");
    expect(last.funnelFalls[0].funnelId).toBe(bowMost.id);
  });

  it("breaks none when she stays afloat", () => {
    const ship = templateShip("britannic");
    expect(trialFunnelsOf(ship).length).toBeGreaterThan(0);
    const state = runTrial(icebergInput(ship, 5, "never"), 200);
    expect(state.outcome).toBe("afloat");
    expect(state.funnelFalls).toHaveLength(0);
  });

  it("breaks one off a one-funnel ship and one off a two-funnel ship", () => {
    for (const funnels of [
      [funnel("a", 20)],
      [funnel("a", 20), funnel("b", 30)],
    ]) {
      const last = statesOf(icebergInput(titanic, 5, "never", funnels)).at(
        -1
      ) as SimState;
      expect(last.funnelFalls).toHaveLength(1);
    }
  });

  it("breaks none with no funnels", () => {
    const last = statesOf(icebergInput(titanic, 5, "never", [])).at(
      -1
    ) as SimState;
    expect(last.funnelFalls).toHaveLength(0);
  });

  it("is deterministic", () => {
    const input = icebergInput(titanic, 5);
    const a = statesOf(input).at(-1) as SimState;
    const b = statesOf(input).at(-1) as SimState;
    expect(a.funnelFalls).toEqual(b.funnelFalls);
  });

  it("records each fall with the carrying half's pose when broken", () => {
    const funnels = [funnel("bow", 10), funnel("mid", 25), funnel("aft", 50)];
    const input = icebergInput(titanic, 5, "always", funnels);
    const states = statesOf(input);
    const last = states.at(-1) as SimState;
    expect(last.breakup).not.toBeNull();
    expect(last.funnelFalls.length).toBeGreaterThan(0);
    const atX = (last.breakup as { atX: number }).atX;
    for (const fall of last.funnelFalls) {
      const at = states.find((s) => Math.abs(s.time - fall.at) < 1e-9);
      expect(at).toBeDefined();
      const state = at as SimState;
      const cellX = funnels.find((f) => f.id === fall.funnelId)!.cellX;
      const body =
        state.halves && state.breakup
          ? cellX < atX
            ? state.halves.bow
            : state.halves.stern
          : state.pose;
      expect(fall.roll).toBe(body.roll);
      expect(fall.pitch).toBe(body.pitch);
    }
  });

  it("topples toward the low side (+Z for positive roll)", () => {
    const state = {
      ...createTrial(icebergInput(titanic, 5)),
      outcome: "capsized" as const,
      phase: "sinking" as const,
      pose: { roll: 2, pitch: 0, sink: 0 },
    };
    const input: TrialInput = {
      ...icebergInput(titanic, 5, undefined, [funnel("a", 20)]),
      iceberg: undefined,
    };
    const hit = stepFunnelFalls(state, input);
    expect(hit.funnelFalls[0].side).toBe(1);
    const left = stepFunnelFalls(
      { ...state, pose: { roll: -2, pitch: 0, sink: 0 } },
      input
    );
    expect(left.funnelFalls[0].side).toBe(-1);
  });
});

describe("funnels breaking in a weather capsize", () => {
  it("snaps one off once she has rolled over, or at sunk", () => {
    const funnels = [funnel("a", 20), funnel("b", 30), funnel("c", 40)];
    const input: TrialInput = {
      ship: { stabilityRatio: 0.35, listAngle: 0, beam: 4 },
      sea: "stormy",
      funnels,
      length: 60,
    };
    const last = statesOf(input).at(-1) as SimState;
    expect(last.outcome).toBe("capsized");
    expect(last.funnelFalls.length).toBeGreaterThanOrEqual(1);
    const states = statesOf(input);
    const first = last.funnelFalls[0];
    const at = states.find((s) => Math.abs(s.time - first.at) < 1e-9)!;
    const sunkAt = last.events.find((e) => e.kind === "sunk")?.at ?? Infinity;
    expect(
      Math.abs(at.pose.roll) >= 100 * DEG || first.at >= sunkAt - 1e-9
    ).toBe(true);
  });
});

describe("fallingFunnelPose", () => {
  const fall: FunnelFall = {
    funnelId: "a",
    at: 10,
    origin: { x: 3, y: 0.8, z: 1 },
    roll: 0.5,
    pitch: -0.3,
    side: 1,
  };

  it("starts at the origin with the body's tilt", () => {
    const pose = fallingFunnelPose(fall, 0);
    expect(pose.position).toEqual(fall.origin);
    expect(pose.rotation.x).toBeCloseTo(fall.roll, 9);
    expect(pose.rotation.z).toBeCloseTo(fall.pitch, 9);
  });

  it("lies flat on the water at TOPPLE_S", () => {
    const pose = fallingFunnelPose(fall, TOPPLE_S);
    expect(pose.position.y).toBeCloseTo(0, 9);
    expect(pose.rotation.x).toBeCloseTo(Math.PI / 2, 9);
    expect(
      fallingFunnelPose({ ...fall, side: -1 }, TOPPLE_S).rotation.x
    ).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("bobs, then sinks at DESCENT_SPEED to the floor and stays", () => {
    const mid = fallingFunnelPose(fall, TOPPLE_S + FLOAT_S / 2);
    expect(Math.abs(mid.position.y)).toBeLessThanOrEqual(0.05 + 1e-9);
    const sinking = fallingFunnelPose(fall, TOPPLE_S + FLOAT_S + 2);
    expect(sinking.position.y).toBeCloseTo(-2 * DESCENT_SPEED, 9);
    expect(fallingFunnelPose(fall, 1e4).position.y).toBe(-FLOOR_DEPTH);
  });

  it("never rises from under the water: it sinks from where it broke", () => {
    const deep = { ...fall, origin: { x: 3, y: -4, z: 1 } };
    for (let t = 0; t < 60; t += 0.25) {
      const pose = fallingFunnelPose(deep, t);
      expect(pose.position.y).toBeLessThanOrEqual(-4 + 1e-9);
      expect(pose.position.y).toBeGreaterThanOrEqual(-FLOOR_DEPTH);
    }
    expect(fallingFunnelPose(deep, TOPPLE_S).rotation.x).toBeCloseTo(
      Math.PI / 2,
      9
    );
    expect(fallingFunnelPose(deep, 1e4).position.y).toBe(-FLOOR_DEPTH);
  });

  it("drifts about 1.5 toward its side", () => {
    const end = fallingFunnelPose(fall, 1e4);
    expect(end.position.z - fall.origin.z).toBeCloseTo(1.5, 6);
    const left = fallingFunnelPose({ ...fall, side: -1 }, 1e4);
    expect(left.position.z - fall.origin.z).toBeCloseTo(-1.5, 6);
  });
});
