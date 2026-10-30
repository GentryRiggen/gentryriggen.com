import type { Mesh } from "three";

/**
 * The meshes that may be merged into a ship's static batch (see
 * PartBatcher.ts). A mesh opts in by taking `ref={batchRef}`: only meshes that
 * never move on their own (no spinner, swinger or animated parent) and that
 * are painted by `Surface` should. The registry is global; each batcher keeps
 * the ones under its own root.
 */
const registry = new Set<Mesh>();
let epoch = 0;

/**
 * The `ref` of a batchable mesh. It must be this stable function, never an
 * inline one, so a re-render does not look like a new mesh. Returns the
 * cleanup React runs on unmount, which drops the mesh from the registry.
 */
export function batchRef(mesh: Mesh | null): (() => void) | void {
  if (!mesh) return;
  if (!registry.has(mesh)) {
    registry.add(mesh);
    epoch++;
  }
  return () => {
    registry.delete(mesh);
  };
}

/** Changes whenever a batchable mesh mounts. */
export function batchEpoch(): number {
  return epoch;
}

/** Every registered mesh still in a scene; the rest are pruned. */
export function batchableMeshes(): Mesh[] {
  const live: Mesh[] = [];
  for (const mesh of registry) {
    if (mesh.parent) live.push(mesh);
    else registry.delete(mesh);
  }
  return live;
}
