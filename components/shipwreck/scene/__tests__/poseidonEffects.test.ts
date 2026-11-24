import { Group, Vector3 } from "three";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import { buildHull } from "@/lib/shipwreck/sim/geometry";
import { simulate } from "@/lib/shipwreck/sim/run";
import { sampleTrack, type BodyPose } from "@/lib/shipwreck/sim/track";
import {
  POSEIDON_PARTICLES,
  PoseidonEffects,
  WAVE_SPRAY_S,
  bubblesAt,
  rolledFoamAt,
  waveSprayAt,
  type PoseidonFrame,
} from "../poseidonEffects";
import { createSceneRuntime } from "../runtime";

/**
 * The rogue wave's effects (Task 9): the spray sheet fires once, at the
 * hit, from her port side; white water where she rolled; bubbles from her
 * smashed openings once keel up. Points only, in the blended buffer.
 */

const track = simulate(poseidon, poseidon.realNight);
const ev = (k: string) => track.events.find((e) => e.kind === k)!.t;
const hull = buildHull(poseidon);
const POOL = 5000;

function rig() {
  const runtime = createSceneRuntime();
  const pos = new Float32Array(POOL * 3);
  const col = new Float32Array(POOL * 4);
  const size = new Float32Array(POOL);
  const fx = new PoseidonEffects(poseidon, hull, runtime, pos, col, size);
  return { runtime, pos, col, size, fx };
}

function frameAt(
  t: number,
  under = false,
  cam = [400, 40, 300]
): PoseidonFrame {
  return {
    track,
    frame: sampleTrack(track, t),
    openings: poseidon.realNight,
    t,
    wall: 3.3,
    quality: "high",
    camX: cam[0],
    camY: cam[1],
    camZ: cam[2],
    under,
    white: 0.3,
    lamps: 1,
  };
}

/** A three.js point in a pose's ship frame (x, y to port, z up). */
function inShip(p: BodyPose, w: readonly number[]): [number, number, number] {
  const g = new Group();
  applyBodyPose(g, p);
  g.updateMatrixWorld();
  const l = g.worldToLocal(new Vector3(w[0], w[1], w[2]));
  return [l.x, -l.z, l.y];
}

describe("the rogue wave's spray sheet", () => {
  it("fires once, at the hit, for a few seconds", () => {
    const hit = ev("collision");
    let on = 0;
    let starts = 0;
    let prev = 0;
    for (let t = -60; t <= 600; t += 0.25) {
      const a = waveSprayAt(track.events, t);
      if (a > 0) on += 1;
      if (a > 0 && prev === 0) starts += 1;
      prev = a;
      if (t < hit || t > hit + WAVE_SPRAY_S) expect(a).toBe(0);
    }
    expect(starts).toBe(1);
    expect(on).toBeGreaterThan(10);
    // A run without a hit: none (the effects are built only for a wave
    // ship: Effects.tsx).
    expect(waveSprayAt([], 0)).toBe(0);
  });

  it("comes up her port side (the wave's) and goes over her", () => {
    const { fx, pos } = rig();
    const hitPose = sampleTrack(track, ev("collision")).bodies[0];
    const n = fx.update(frameAt(ev("collision") + 0.6), 0);
    expect(fx.counts.spray).toBeGreaterThan(100);
    expect(fx.counts.spray).toBeLessThanOrEqual(POSEIDON_PARTICLES.high.spray);
    let port = 0;
    for (let k = 0; k < n; k += 1) {
      const l = inShip(hitPose, [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]);
      if (l[1] > 0) port += 1;
      expect(Number.isFinite(l[0])).toBe(true);
    }
    // Early on, nearly all of it is still over her port side.
    expect(port / n).toBeGreaterThan(0.8);
    // None before the hit, none after it has fallen.
    expect(fx.update(frameAt(-5), 0)).toBe(0);
    fx.update(frameAt(ev("collision") + WAVE_SPRAY_S + 1), 0);
    expect(fx.counts.spray).toBe(0);
  });

  it("is never drawn under the water", () => {
    const { fx } = rig();
    fx.update(frameAt(ev("collision") + 1, true), 0);
    expect(fx.counts.spray).toBe(0);
  });
});

describe("where she rolled, and keel up", () => {
  it("leaves white water round her from the hit, thinning, gone after she is under", () => {
    expect(rolledFoamAt(track.events, -1)).toBe(0);
    expect(rolledFoamAt(track.events, 10)).toBeGreaterThan(0.5);
    expect(rolledFoamAt(track.events, ev("capsized") + 300)).toBeLessThan(
      rolledFoamAt(track.events, 10)
    );
    expect(rolledFoamAt(track.events, ev("stern-under") + 61)).toBe(0);
    const { fx, runtime } = rig();
    fx.update(frameAt(20), 0);
    expect(runtime.foamPatch[3]).toBeGreaterThan(0);
    expect(runtime.foamPatch[2]).toBeGreaterThan(50);
    fx.update(frameAt(-20), 0);
    expect(runtime.foamPatch[3]).toBe(0);
  });

  it("bubbles air from her smashed openings only once she is keel up", () => {
    expect(bubblesAt(track.events, ev("capsized") - 1)).toBe(0);
    expect(bubblesAt(track.events, ev("capsized") + 60)).toBe(1);
    expect(bubblesAt(track.events, ev("stern-under") + 41)).toBe(0);
    const { fx, pos, runtime } = rig();
    const t = ev("capsized") + 60;
    const f = frameAt(t, true, [0, -30, 60]);
    const n = fx.update(f, 0);
    expect(fx.counts.bubbles).toBeGreaterThan(50);
    expect(fx.counts.bubbles).toBeLessThanOrEqual(
      POSEIDON_PARTICLES.high.bubbles + poseidon.realNight.length
    );
    // Under the sea (or just at it, where they break the surface).
    for (let k = 0; k < n; k += 1) {
      const y = pos[k * 3 + 1];
      expect(y).toBeLessThanOrEqual(
        runtime.seaY(pos[k * 3], pos[k * 3 + 2]) + 0.2
      );
    }
    // From above the sea: only the fizz at the surface.
    const above = fx.update(frameAt(t, false), 0);
    expect(above).toBeLessThan(n);
    // None upright.
    fx.update(frameAt(5, true), 0);
    expect(fx.counts.bubbles).toBe(0);
  });

  it("writes after what the storm drew, within the buffer", () => {
    const { fx, size } = rig();
    const n = fx.update(frameAt(ev("collision") + 1), 4990);
    expect(n).toBeLessThanOrEqual(size.length);
    expect(n).toBeGreaterThanOrEqual(4990);
  });
});
