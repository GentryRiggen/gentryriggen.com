import {
  BufferAttribute,
  Mesh,
  Matrix4,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  type Object3D,
} from "three";
import { batchableMeshes, batchEpoch } from "./batchRegistry";
import { mergeGeometries, type MergeSource } from "./batchMerge";
import { noRaycast } from "./noRaycast";
import { isSharedSurfaceMaterial } from "./Surface";

/** Fewer than this many meshes sharing a look are not worth merging. */
const MIN_GROUP_SIZE = 2;
/** New meshes (a model finishing its load) wait this long for a rebuild. */
const ADDITION_DELAY_MS = 200;
/** A tree that is not on screen (a half before the break) waits longer. */
const HIDDEN_DELAY_MS = 1000;

/** A run of meshes drawn together: same material, shadow flags and layers. */
interface BatchGroup {
  mesh: Mesh;
  index: BufferAttribute;
  /** The index buffer as built, to bring a blanked piece back. */
  original: Uint32Array;
}

/** A source mesh whose triangles live in a group's merged geometry. */
interface Member {
  source: Mesh;
  material: Material;
  geometry: BufferGeometry;
  group: BatchGroup;
  start: number;
  count: number;
  /** True while the merged copy is shown and the source hidden. */
  isBatched: boolean;
}

export interface PartBatcherOptions {
  /** Part ids to leave out of a build (hovered, selected, being removed...). */
  excluded: () => ReadonlySet<string>;
}

/** The id of the part a mesh belongs to, read from the part's group. */
function partIdOf(mesh: Object3D): string | null {
  for (let node: Object3D | null = mesh; node; node = node.parent) {
    const id: unknown = node.userData.partId;
    if (typeof id === "string") return id;
  }
  return null;
}

function isWithin(node: Object3D, root: Object3D): boolean {
  for (let at: Object3D | null = node.parent; at; at = at.parent) {
    if (at === root) return true;
  }
  return false;
}

type Reach = "shown" | "hidden" | "gone";

/** Whether `node` still hangs under `root`, and if so whether it shows. */
function reachOf(node: Object3D, root: Object3D): Reach {
  let reach: Reach = "shown";
  for (let at: Object3D | null = node.parent; at; at = at.parent) {
    if (at === root) return reach;
    if (!at.visible) reach = "hidden";
  }
  return "gone";
}

/** Visible all the way up to the scene. */
function isOnScreen(node: Object3D): boolean {
  for (let at: Object3D | null = node; at; at = at.parent) {
    if (!at.visible) return false;
  }
  return true;
}

/**
 * Merges a ship's static, opted-in meshes (see batchRegistry.ts) into a few
 * big ones, one per material look, so a ship of hundreds of parts costs a
 * handful of draw calls. The source meshes stay in the scene, hidden, so
 * picking, hover and events still reach them exactly as before.
 *
 * A source is drawn on its own whenever it differs from what was merged: its
 * material changed (hover, selection, removal tint, paint), an ancestor is
 * hidden (a funnel that fell), or it is unmounted. Each frame `update` only
 * compares references, then blanks or restores the piece's index range, so
 * emphasis costs no rebuild. A rebuild happens when the set of meshes changes.
 */
export default class PartBatcher {
  private readonly root: Object3D;
  private readonly options: PartBatcherOptions;
  private readonly groups: BatchGroup[] = [];
  private members: Member[] = [];
  private builtEpoch = -1;
  private builtAt = Number.NEGATIVE_INFINITY;
  private skippedParts = new Set<string>();
  private isStale = false;
  private readonly rootInverse = new Matrix4();
  private readonly scratch = new Matrix4();

  constructor(root: Object3D, options: PartBatcherOptions) {
    this.root = root;
    this.options = options;
  }

  /** Call once per frame, before the scene is drawn. */
  update(now: number): void {
    const onScreen = isOnScreen(this.root);
    if (this.shouldRebuild(now, onScreen)) this.build(now);
    this.sync();
  }

  /** Puts every source back and drops the merged meshes. */
  dispose(): void {
    this.release();
  }

  /** Forces the next `update` to rebuild (the ship changed). */
  invalidate(): void {
    this.isStale = true;
    this.builtEpoch = -1;
  }

  private shouldRebuild(now: number, onScreen: boolean): boolean {
    const wait = onScreen ? ADDITION_DELAY_MS : HIDDEN_DELAY_MS;
    const sinceBuild = now - this.builtAt;
    if (this.members.some((m) => reachOf(m.source, this.root) === "gone")) {
      // Something merged was removed: it must not linger on screen.
      return onScreen;
    }
    if (this.isStale) return sinceBuild >= (onScreen ? 0 : wait);
    if (sinceBuild < wait) return false;
    if (this.builtEpoch !== batchEpoch()) return true;
    if (this.skippedParts.size === 0) return false;
    const excluded = this.options.excluded();
    for (const id of this.skippedParts) if (!excluded.has(id)) return true;
    return false;
  }

  private release(): void {
    for (const member of this.members) {
      if (member.isBatched) member.source.visible = true;
    }
    this.members = [];
    for (const { mesh } of this.groups) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.groups.length = 0;
  }

  private build(now: number): void {
    this.release();
    this.builtAt = now;
    this.builtEpoch = batchEpoch();
    this.isStale = false;
    this.skippedParts = new Set();
    const { root } = this;
    root.updateMatrixWorld(true);
    this.rootInverse.copy(root.matrixWorld).invert();
    const excluded = this.options.excluded();

    const byLook = new Map<string, Mesh[]>();
    for (const mesh of batchableMeshes()) {
      if (!isWithin(mesh, root)) continue;
      const material = mesh.material;
      if (
        Array.isArray(material) ||
        !isSharedSurfaceMaterial(material) ||
        material.transparent ||
        !mesh.geometry.hasAttribute("position") ||
        !mesh.geometry.hasAttribute("normal")
      ) {
        continue;
      }
      const partId = partIdOf(mesh);
      if (partId && excluded.has(partId)) {
        this.skippedParts.add(partId);
        continue;
      }
      const key = [
        material.uuid,
        mesh.castShadow ? 1 : 0,
        mesh.receiveShadow ? 1 : 0,
        mesh.layers.mask,
        mesh.renderOrder,
      ].join("|");
      const list = byLook.get(key);
      if (list) list.push(mesh);
      else byLook.set(key, [mesh]);
    }

    for (const meshes of byLook.values()) {
      if (meshes.length >= MIN_GROUP_SIZE) this.buildGroup(meshes);
    }
  }

  private buildGroup(meshes: Mesh[]): void {
    const first = meshes[0];
    const material = first.material as Material & { vertexColors: boolean };
    const sources: MergeSource[] = [];
    const spans: { mesh: Mesh; first: number; length: number }[] = [];
    for (const mesh of meshes) {
      const before = sources.length;
      const instanced = (mesh as Partial<InstancedMesh>).isInstancedMesh
        ? (mesh as InstancedMesh)
        : null;
      const placements = instanced ? instanced.count : 1;
      for (let i = 0; i < placements; i++) {
        const matrix = new Matrix4().multiplyMatrices(
          this.rootInverse,
          mesh.matrixWorld
        );
        if (instanced) {
          instanced.getMatrixAt(i, this.scratch);
          matrix.multiply(this.scratch);
        }
        sources.push({ geometry: mesh.geometry, matrix });
      }
      spans.push({ mesh, first: before, length: placements });
    }
    const { geometry, ranges } = mergeGeometries(
      sources,
      material.vertexColors
    );
    const merged = new Mesh(geometry, first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.layers.mask = first.layers.mask;
    merged.renderOrder = first.renderOrder;
    merged.raycast = noRaycast;
    merged.userData.isStaticBatch = true;
    this.root.add(merged);
    const index = geometry.getIndex() as BufferAttribute;
    const group: BatchGroup = {
      mesh: merged,
      index,
      original: new Uint32Array(index.array as Uint32Array),
    };
    this.groups.push(group);
    for (const { mesh, first: from, length } of spans) {
      const start = ranges[from].start;
      const last = ranges[from + length - 1];
      this.members.push({
        source: mesh,
        material: mesh.material as Material,
        geometry: mesh.geometry,
        group,
        start,
        count: last.start + last.count - start,
        // Starts shown; `sync` blanks it if it should not be.
        isBatched: false,
      });
    }
    // Every piece starts shown in the merged mesh; `sync` fixes the rest.
    for (const member of this.members) {
      if (member.group === group) this.setBatched(member, true);
    }
  }

  /** Brings each member in line with its source's current state. */
  private sync(): void {
    for (const member of this.members) {
      const { source } = member;
      const shouldBatch =
        source.material === member.material &&
        source.geometry === member.geometry &&
        reachOf(source, this.root) === "shown";
      if (shouldBatch !== member.isBatched)
        this.setBatched(member, shouldBatch);
    }
  }

  private setBatched(member: Member, isBatched: boolean): void {
    const { group, start, count } = member;
    const target = group.index.array as Uint32Array;
    if (isBatched) {
      target.set(group.original.subarray(start, start + count), start);
    } else {
      target.fill(0, start, start + count);
    }
    group.index.addUpdateRange(start, count);
    group.index.needsUpdate = true;
    member.isBatched = isBatched;
    member.source.visible = !isBatched;
  }
}
