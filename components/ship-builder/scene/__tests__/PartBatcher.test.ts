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

interface Rig {
  root: Group;
  parts: Group[];
  meshes: Mesh[];
  excluded: Set<string>;
  batcher: PartBatcher;
}

/** Three parts, one opted-in box each, under one root. */
function rig(): Rig {
  const root = new Group();
  const parts: Group[] = [];
  const meshes: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const part = new Group();
    part.userData.partId = `part-${i}`;
    part.position.set(i * 3, 0, 0);
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), plain);
    part.add(mesh);
    root.add(part);
    batchRef(mesh);
    parts.push(part);
    meshes.push(mesh);
  }
  const excluded = new Set<string>();
  const batcher = new PartBatcher(root, { excluded: () => excluded });
  return { root, parts, meshes, excluded, batcher };
}

const mergedOf = (root: Group) =>
  root.children.filter((child) => child.userData.isStaticBatch) as Mesh[];

/** Triangles the merged mesh actually draws (blank ones are all zeros). */
function liveTriangles(mesh: Mesh): number {
  const index = mesh.geometry.index!;
  let live = 0;
  for (let i = 0; i < index.count; i += 3) {
    if (index.getX(i) + index.getX(i + 1) + index.getX(i + 2) > 0) live++;
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
    expect(liveTriangles(merged[0])).toBe(36);
    expect(meshes.every((mesh) => !mesh.visible)).toBe(true);
    batcher.dispose();
  });

  it("draws a part on its own while its material differs, then merges it back", () => {
    const { root, meshes, batcher } = rig();
    batcher.update(0);
    meshes[1].material = hover;
    batcher.update(16);
    expect(meshes[1].visible).toBe(true);
    expect(meshes[0].visible).toBe(false);
    expect(liveTriangles(mergedOf(root)[0])).toBe(24);

    meshes[1].material = plain;
    batcher.update(32);
    expect(meshes[1].visible).toBe(false);
    expect(liveTriangles(mergedOf(root)[0])).toBe(36);
    batcher.dispose();
  });

  it("stops drawing a part whose group is hidden", () => {
    const { root, parts, meshes, batcher } = rig();
    batcher.update(0);
    parts[2].visible = false;
    batcher.update(16);
    expect(liveTriangles(mergedOf(root)[0])).toBe(24);
    parts[2].visible = true;
    batcher.update(32);
    expect(liveTriangles(mergedOf(root)[0])).toBe(36);
    expect(meshes[2].visible).toBe(false);
    batcher.dispose();
  });

  it("drops a removed part at once", () => {
    const { root, parts, batcher } = rig();
    batcher.update(0);
    root.remove(parts[0]);
    batcher.update(16);
    expect(liveTriangles(mergedOf(root)[0])).toBe(24);
    batcher.dispose();
  });

  it("leaves excluded parts out, and takes them once they stop standing out", () => {
    const { root, meshes, excluded, batcher } = rig();
    excluded.add("part-0");
    batcher.update(0);
    expect(meshes[0].visible).toBe(true);
    expect(liveTriangles(mergedOf(root)[0])).toBe(24);

    excluded.clear();
    batcher.update(500);
    expect(meshes[0].visible).toBe(false);
    expect(liveTriangles(mergedOf(root)[0])).toBe(36);
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
    const batcher = new PartBatcher(root, { excluded: () => new Set() });
    batcher.update(0);
    expect(mergedOf(root)).toHaveLength(0);
    expect(lone.visible && unregistered.visible).toBe(true);
    batcher.dispose();
  });
});
