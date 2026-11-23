import { Group, Mesh, Vector3, type BufferAttribute } from "three";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import {
  createTitanicModel,
  type TitanicModel,
} from "@/components/shipwreck/model/shipModel";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { simulate } from "@/lib/shipwreck/sim/run";
import type { BodyPose, SimTrack } from "@/lib/shipwreck/sim/track";
import { BRITANNIC_HULL_BOXES, pushOutOfHull } from "../cameraMath";
import { MAST_LAY_S, foremastLaysAt, poseForemast } from "../mastWreck";

// jsdom has no 2d canvas: plain textures stand in.
jest.mock("@/components/shipwreck/model/textures", () => {
  const { Texture: T } = jest.requireActual("three");
  return {
    acquireShipTextures: () => ({
      plateNormal: new T(),
      weathering: new T(),
      planks: new T(),
      names: new T(),
      dispose() {},
    }),
    releaseShipTextures: () => {},
  };
});

/** A three point in the ship frame of `p` (x forward, y port, z up). */
function inShipFrame(p: BodyPose, w: Vector3): [number, number, number] {
  const g = new Group();
  applyBodyPose(g, p);
  g.updateMatrixWorld();
  const l = g.worldToLocal(w.clone());
  return [l.x, -l.z, l.y];
}

/** The mast mesh's vertices in world space. */
function mastPoints(model: TitanicModel): Vector3[] {
  const mesh = model.handles.foremast!.group.getObjectByName("mast") as Mesh;
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.getAttribute("position") as BufferAttribute;
  const out: Vector3[] = [];
  for (let i = 0; i < pos.count; i += 1)
    out.push(
      new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    );
  return out;
}

describe("the Britannic's foremast on the floor [WP]", () => {
  const track = simulate(britannic, britannic.realNight, {
    portholesOpen: true,
  });
  const last = track.frames[track.frames.length - 1];
  const wreck = last.bodies[0];
  const floor = -britannic.seaDepthM;
  const bowLands = track.events.find((e) => e.kind === "bow-lands")!.t;
  let model: TitanicModel;

  beforeAll(() => {
    model = createTitanicModel(britannic, { quality: "high", breakX: null });
  });
  afterAll(() => model.dispose());

  /** Her whole group at `pose`, the mast posed for shown time `t`. */
  function at(t: number, tr: SimTrack = track, pose = wreck) {
    applyBodyPose(model.handles.whole, pose);
    model.handles.root.updateMatrixWorld(true);
    poseForemast(model.handles, britannic, tr, t);
    model.handles.root.updateMatrixWorld(true);
  }

  it("is its own part, painted from the same paint as the merged mast", () => {
    const f = model.handles.foremast!;
    expect(f).toBeTruthy();
    expect(f.mast.id).toBe("fore");
    const mast = f.group.getObjectByName("mast") as Mesh;
    const paint = model.handles.whole.getObjectByName("paint") as Mesh;
    expect(mast.material).toBe(paint.material);
    // Its vertex colours include her mast paint (buff).
    const c = mast.geometry.getAttribute("color").array as Float32Array;
    expect(c.length).toBeGreaterThan(0);
    // Its pole in short lengths (rings all the way up), so it can bend.
    const p = mast.geometry.getAttribute("position");
    const ys = new Set<number>();
    for (let i = 0; i < p.count; i += 1) ys.add(Math.round(p.getY(i) * 10));
    const sorted = [...ys].sort((x, y) => x - y);
    for (let i = 1; i < sorted.length; i += 1)
      expect(sorted[i] - sorted[i - 1]).toBeLessThan(20);
  });

  it("leaves the Titanic's masts merged", () => {
    const t = createTitanicModel(titanic, { quality: "low", breakX: null });
    expect(t.handles.foremast ?? null).toBeNull();
    t.dispose();
  });

  it("lies from the bow's landing in her real run", () => {
    expect(foremastLaysAt(track)).toBe(bowLands);
  });

  it("stands on her before the bow lands", () => {
    const before = track.frames.find((f) => f.t >= bowLands - 1)!;
    at(before.t, track, before.bodies[0]);
    const g = model.handles.foremast!.group;
    const m = model.handles.foremast!.mast;
    // At its foot on her deck, upright in her frame.
    expect(g.quaternion.angleTo(g.quaternion.clone().identity())).toBe(0);
    const foot = new Vector3(m.x, m.baseZ, 0);
    expect(g.position.distanceTo(foot)).toBeLessThan(1e-9);
  });

  it("lies on the floor beside her forward end, bent, clear of her hull", () => {
    at(last.t);
    expect(last.t - bowLands).toBeGreaterThan(MAST_LAY_S);
    const pts = mastPoints(model);
    const g = model.handles.foremast!.group;
    const m = model.handles.foremast!.mast;
    // Its top (the vertex farthest from its foot) within 2 m of the floor.
    const tip = pts.reduce((a, b) =>
      b.distanceTo(g.position) > a.distanceTo(g.position) ? b : a
    );
    expect(tip.y - floor).toBeLessThan(2);
    expect(tip.y - floor).toBeGreaterThan(0);
    // Not through the floor.
    for (const p of pts) expect(p.y).toBeGreaterThan(floor - 0.05);
    // Not inside her.
    for (const p of pts) {
      const local = inShipFrame(wreck, p);
      expect(pushOutOfHull(local, 0, BRITANNIC_HULL_BOXES)).toEqual(local);
    }
    // Beside her forward end: its foot near the foremast's own place.
    const foot = inShipFrame(wreck, g.getWorldPosition(new Vector3()));
    expect(Math.abs(foot[0] - m.x)).toBeLessThan(15);
    // Out from her deck, its top bent toward her bow (away from funnel 1).
    const top = inShipFrame(wreck, tip);
    expect(top[2]).toBeGreaterThan(foot[2] + 25);
    expect(top[0]).toBeGreaterThan(foot[0] + 5);
    // Bent: its upper length turned from its lower by 15° or more.
    const footW = g.getWorldPosition(new Vector3());
    const mid = new Vector3(0, (m.topZ - m.baseZ) * 0.3, 0).applyMatrix4(
      g.matrixWorld
    );
    const lower = mid.clone().sub(footW).normalize();
    const upper = tip.clone().sub(mid).normalize();
    expect(lower.angleTo(upper)).toBeGreaterThan((15 * Math.PI) / 180);
  });

  it("hides its wires once it falls, and shows them again going back", () => {
    const wires: { visible: boolean }[] = [];
    model.handles.root.traverse((o) => {
      if (o.name === "rails-and-rigging") wires.push(o as never);
    });
    const counts = () =>
      wires.map(
        (w) =>
          (w as unknown as { geometry: { drawRange: { count: number } } })
            .geometry.drawRange.count
      );
    at(bowLands - 1);
    const shown = counts();
    at(last.t);
    const hidden = counts();
    expect(hidden.some((c, i) => c < shown[i])).toBe(true);
    at(bowLands - 1);
    expect(counts()).toEqual(shown);
    // And the mesh unbent.
    const mesh = model.handles.foremast!.group.getObjectByName("mast") as Mesh;
    const fresh = createTitanicModel(britannic, {
      quality: "high",
      breakX: null,
    });
    const orig = fresh.handles.foremast!.group.getObjectByName("mast") as Mesh;
    expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(
      Array.from(orig.geometry.getAttribute("position").array)
    );
    fresh.dispose();
  });

  it("stays on her where she floats, breaks or lands upright", () => {
    const fixed = simulate(britannic, britannic.realNight, {
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    });
    expect(fixed.outcome).toBe("floated");
    expect(foremastLaysAt(fixed)).toBeNull();
    // And the pose leaves her mast standing, wires shown, on that track.
    const standing = (tr: SimTrack, t: number, pose: BodyPose) => {
      at(t, tr, pose);
      const g = model.handles.foremast!.group;
      const lines: { geometry: { drawRange: { count: number } } }[] = [];
      model.handles.root.traverse((o) => {
        if (o.name === "rails-and-rigging") lines.push(o as never);
      });
      return {
        pos: g.position.toArray(),
        quat: g.quaternion.toArray(),
        wires: lines.map((l) => l.geometry.drawRange.count),
      };
    };
    const fixedLast = fixed.frames[fixed.frames.length - 1];
    const calm = standing(fixed, fixedLast.t, fixedLast.bodies[0]);
    const start = standing(fixed, 0, fixed.frames[0].bodies[0]);
    expect(calm).toEqual(start);
    expect(calm.quat).toEqual([0, 0, 0, 1]);
    expect(calm.wires.every((c) => c === Infinity)).toBe(true);
    expect(foremastLaysAt({ ...track, brokeAtT: 3000 })).toBeNull();
    const upright = {
      ...track,
      frames: [
        ...track.frames.slice(0, -1),
        { ...last, bodies: [{ ...wreck, roll: 0.05 }] },
      ],
    };
    expect(foremastLaysAt(upright)).toBeNull();
  });
});
