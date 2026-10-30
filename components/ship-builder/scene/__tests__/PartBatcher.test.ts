import { BoxGeometry, Group, Mesh } from "three";
import { batchRef } from "../batchRegistry";
import PartBatcher from "../PartBatcher";
import { surfaceLook, surfaceMaterial } from "../Surface";

const plain = surfaceMaterial(
  surfaceLook({ color: "#abcdef", tint: null, emphasis: null })
);
const hover = surfaceMaterial(
  surfaceLook({ color: "#abcdef", tint: null, emphasis: "hover" })
);
const removal = surfaceMaterial(
  surfaceLook({ color: "#abcdef", tint: "removal", emphasis: null })
);

function addPart(root: Group, index: number, material = plain) {
  const part = new Group();
  part.userData.partId = `part-${index}`;
  part.position.set(index * 3, 0, 0);
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
  part.add(mesh);
  root.add(part);
  batchRef(mesh);
  return { part, mesh };
}

/** Three parts, one opted-in box each, under one root. */
function rig() {
  const root = new Group();
  const added = [0, 1, 2].map((i) => addPart(root, i));
  return {
    root,
    parts: added.map((a) => a.part),
    meshes: added.map((a) => a.mesh),
    batcher: new PartBatcher(root),
  };
}

const mergedOf = (root: Group) =>
  root.children.filter((child) => child.userData.isStaticBatch) as Mesh[];

/** Triangles the merged meshes actually draw (blank ones are all zeros). */
function liveTriangles(root: Group): number {
  let live = 0;
  for (const mesh of mergedOf(root)) {
    const index = mesh.geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      if (index.getX(i) + index.getX(i + 1) + index.getX(i + 2) > 0) live++;
    }
  }
  return live;
}

describe("PartBatcher", () => {
  it("draws parts that share a material as one mesh and hides the sources", () => {
    const { root, meshes, batcher } = rig();
    batcher.update(0);
    const merged = mergedOf(root);
    expect(merged).toHaveLength(1);
    expect(merged[0].material).toBe(plain);
    expect(liveTriangles(root)).toBe(36);
    expect(meshes.every((mesh) => !mesh.visible)).toBe(true);
    batcher.dispose();
  });

  it("draws a hovered part on its own and takes it back, with no rebuild", () => {
    const { root, meshes, batcher } = rig();
    batcher.update(0);
    for (let t = 1; t <= 10; t++) {
      meshes[1].material = t % 2 ? hover : plain;
      batcher.update(t * 16);
      expect(meshes[1].visible).toBe(t % 2 === 1);
      expect(liveTriangles(root)).toBe(t % 2 ? 24 : 36);
    }
    meshes[2].material = removal;
    batcher.update(500);
    expect(meshes[2].visible).toBe(true);
    expect(batcher.builds).toBe(1);
    batcher.dispose();
  });

  it("merges a part that was hovered at build time once it is plain, without rebuilding", () => {
    const root = new Group();
    const parts = [0, 1, 2].map((i) =>
      addPart(root, i, i === 0 ? hover : plain)
    );
    const batcher = new PartBatcher(root);
    batcher.update(0);
    expect(parts[0].mesh.visible).toBe(true);
    expect(liveTriangles(root)).toBe(24);
    parts[0].mesh.material = plain;
    batcher.update(16);
    expect(parts[0].mesh.visible).toBe(false);
    expect(liveTriangles(root)).toBe(36);
    expect(batcher.builds).toBe(1);
    batcher.dispose();
  });

  it("stops drawing a part whose group is hidden", () => {
    const { root, parts, meshes, batcher } = rig();
    batcher.update(0);
    parts[2].visible = false;
    batcher.update(16);
    expect(liveTriangles(root)).toBe(24);
    parts[2].visible = true;
    batcher.update(32);
    expect(liveTriangles(root)).toBe(36);
    expect(meshes[2].visible).toBe(false);
    batcher.dispose();
  });

  it("drops a removed part at once", () => {
    const { root, parts, batcher } = rig();
    batcher.update(0);
    root.remove(parts[0]);
    batcher.update(16);
    expect(liveTriangles(root)).toBe(24);
    batcher.dispose();
  });

  it("does not bake a part that is still popping in, and merges it when done", () => {
    const { root, parts, meshes, batcher } = rig();
    // Two parts placed in quick succession are both mid-pop.
    parts[0].scale.setScalar(0.6);
    parts[2].scale.setScalar(1.1);
    batcher.update(0);
    expect(liveTriangles(root)).toBe(0);
    expect(meshes.every((mesh) => mesh.visible)).toBe(true);

    parts[0].scale.setScalar(1);
    parts[2].scale.setScalar(1);
    batcher.update(100);
    batcher.update(300);
    expect(batcher.builds).toBe(1);
    batcher.update(450);
    expect(batcher.builds).toBe(2);
    expect(liveTriangles(root)).toBe(36);
    batcher.dispose();
  });

  it("draws a new part itself and waits for quiet before rebuilding", () => {
    const { root, batcher } = rig();
    batcher.update(0);
    const extra = addPart(root, 3);
    batcher.update(100);
    expect(extra.mesh.visible).toBe(true);
    // A burst of edits keeps pushing the rebuild back.
    const more = addPart(root, 4);
    batcher.invalidate(200);
    batcher.update(300);
    batcher.invalidate(450);
    batcher.update(500);
    expect(batcher.builds).toBe(1);
    expect(more.mesh.visible).toBe(true);
    batcher.update(800);
    expect(batcher.builds).toBe(2);
    expect(liveTriangles(root)).toBe(60);
    expect(extra.mesh.visible).toBe(false);
    batcher.dispose();
  });

  it("draws a part that moved on its own straight away", () => {
    const { root, parts, meshes, batcher } = rig();
    batcher.update(0);
    parts[1].position.x += 5;
    batcher.invalidate(10);
    batcher.update(16);
    expect(meshes[1].visible).toBe(true);
    expect(liveTriangles(root)).toBe(24);
    expect(batcher.builds).toBe(1);
    batcher.update(400);
    expect(batcher.builds).toBe(2);
    expect(liveTriangles(root)).toBe(36);
    batcher.dispose();
  });

  it("puts every source back when disposed", () => {
    const { root, meshes, batcher } = rig();
    batcher.update(0);
    batcher.dispose();
    expect(mergedOf(root)).toHaveLength(0);
    expect(meshes.every((mesh) => mesh.visible)).toBe(true);
  });

  it("does not merge meshes that were not opted in, or have no partners", () => {
    const root = new Group();
    const lone = new Mesh(new BoxGeometry(1, 1, 1), plain);
    root.add(lone);
    batchRef(lone);
    const unregistered = new Mesh(new BoxGeometry(1, 1, 1), plain);
    root.add(unregistered);
    const batcher = new PartBatcher(root);
    batcher.update(0);
    expect(mergedOf(root)).toHaveLength(0);
    expect(lone.visible && unregistered.visible).toBe(true);
    batcher.dispose();
  });
});

describe("batchRef", () => {
  it("returns a cleanup, ignores null, and does not re-register a known mesh", () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), plain);
    const cleanup = batchRef(mesh);
    expect(typeof cleanup).toBe("function");
    expect(batchRef(null)).toBeUndefined();
    if (typeof cleanup === "function") cleanup();
  });
});
