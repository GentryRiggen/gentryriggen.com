import {
  BufferAttribute,
  Matrix4,
  Mesh,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  type Object3D,
} from "three";
import { batchableMeshes, batchEpoch } from "./batchRegistry";
import { mergeGeometries, type MergeSource } from "./batchMerge";
import { noRaycast } from "./noRaycast";
import { isSharedSurfaceMaterial, plainSurfaceMaterial } from "./Surface";

/** Fewer than this many meshes sharing a look are not worth merging. */
const MIN_GROUP_SIZE = 2;
/** A rebuild waits until this long after the last change (edits, pop-ins). */
const QUIET_MS = 300;
/** If the browser is never idle, a due rebuild still runs after this. */
const IDLE_TIMEOUT_MS = 500;

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
  /** The plain look the merged copy is drawn with. */
  material: Material;
  geometry: BufferGeometry;
  group: BatchGroup;
  start: number;
  count: number;
  /** Where the source sat (relative to the root) when merged. */
  placed: Float32Array;
  /** The instance matrices' version when merged (instanced sources). */
  instanceVersion: number;
  /** Set once the source no longer matches what was merged, for good. */
  isOutdated: boolean;
  /** True while the merged copy is shown and the source hidden. */
  isBatched: boolean;
}

/** A source left out of a build because it cannot be merged yet. */
interface Skipped {
  mesh: Mesh;
  /** What it was waiting on; a change means it may be mergeable now. */
  reason: () => string;
  seen: string;
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

/** The scales between a mesh and the root that are not 1 (a part popping in). */
function scaleSignature(mesh: Object3D, root: Object3D): string {
  let signature = "";
  for (let at = mesh.parent; at && at !== root; at = at.parent) {
    const { x, y, z } = at.scale;
    if (x !== 1 || y !== 1 || z !== 1) signature += `${x},${y},${z};`;
  }
  return signature;
}

/**
 * Merges a ship's static, opted-in meshes (see batchRegistry.ts) into a few
 * big ones, one per material look, so a ship of hundreds of parts costs a
 * handful of draw calls. The source meshes stay in the scene, hidden, so
 * picking, hover and events still reach them exactly as before.
 *
 * A source is drawn on its own whenever it differs from what was merged: its
 * material changed (hover, selection, removal tint, paint), its place or
 * geometry changed, an ancestor is hidden (a funnel that fell) or it is
 * unmounted. Each frame `update` only compares references, then blanks or
 * restores the piece's index range, so none of that costs a rebuild; moving
 * the mouse never rebuilds.
 *
 * Merging is a pass over every triangle, so it is kept off edits: a rebuild
 * waits until the ship has been quiet for QUIET_MS (and for an idle moment),
 * and the parts that changed in the meantime simply draw themselves.
 */
export default class PartBatcher {
  private readonly root: Object3D;
  private readonly groups: BatchGroup[] = [];
  private members: Member[] = [];
  private skipped: Skipped[] = [];
  private hasBuilt = false;
  private seenEpoch = batchEpoch();
  /** When the ship last changed since the build; null while it is current. */
  private dirtyAt: number | null = null;
  private idlePending = false;
  private idleReady = false;
  private isDisposed = false;
  private rebuildCount = 0;
  private readonly rootInverse = new Matrix4();
  private readonly scratch = new Matrix4();

  constructor(root: Object3D) {
    this.root = root;
  }

  /** How many times the merge has run (a test and profiling aid). */
  get builds(): number {
    return this.rebuildCount;
  }

  /** Call once per frame, before the scene is drawn. */
  update(now: number): void {
    const onScreen = isOnScreen(this.root);
    if (!this.hasBuilt) {
      if (onScreen) this.build();
    } else {
      this.noteChanges(now);
      if (
        onScreen &&
        this.dirtyAt !== null &&
        now - this.dirtyAt >= QUIET_MS &&
        this.isIdle()
      ) {
        this.build();
      }
    }
    this.sync();
  }

  /** Puts every source back and drops the merged meshes. */
  dispose(): void {
    this.isDisposed = true;
    this.release();
  }

  /**
   * The ship changed. Pieces that moved are drawn on their own at once; the
   * merge itself follows once things are quiet.
   */
  invalidate(now: number = performance.now()): void {
    if (!this.hasBuilt) return;
    this.dirtyAt = now;
    this.root.updateMatrixWorld(true);
    this.rootInverse.copy(this.root.matrixWorld).invert();
    for (const member of this.members) {
      if (member.isOutdated) continue;
      this.scratch
        .multiplyMatrices(this.rootInverse, member.source.matrixWorld)
        .toArray(PLACED_SCRATCH);
      if (!sameMatrix(PLACED_SCRATCH, member.placed)) member.isOutdated = true;
    }
  }

  private noteChanges(now: number): void {
    const epoch = batchEpoch();
    if (epoch !== this.seenEpoch) {
      this.seenEpoch = epoch;
      this.dirtyAt = now;
    }
    for (const skip of this.skipped) {
      const reason = skip.reason();
      if (reason !== skip.seen) {
        skip.seen = reason;
        this.dirtyAt = now;
      }
    }
    for (const member of this.members) {
      const instances = (member.source as Partial<InstancedMesh>)
        .instanceMatrix;
      if (
        instances &&
        !member.isOutdated &&
        instances.version !== member.instanceVersion
      ) {
        member.isOutdated = true;
        this.dirtyAt = now;
      }
    }
  }

  /** True when the browser can spare the time for a merge. */
  private isIdle(): boolean {
    if (typeof requestIdleCallback === "undefined") return true;
    if (this.idleReady) return true;
    if (!this.idlePending) {
      this.idlePending = true;
      requestIdleCallback(
        () => {
          this.idlePending = false;
          this.idleReady = !this.isDisposed;
        },
        { timeout: IDLE_TIMEOUT_MS }
      );
    }
    return false;
  }

  private release(): void {
    for (const member of this.members) {
      if (member.isBatched) member.source.visible = true;
    }
    this.members = [];
    this.skipped = [];
    for (const { mesh } of this.groups) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.groups.length = 0;
  }

  private build(): void {
    this.release();
    this.hasBuilt = true;
    this.rebuildCount++;
    this.dirtyAt = null;
    this.idleReady = false;
    this.seenEpoch = batchEpoch();
    const { root } = this;
    root.updateMatrixWorld(true);
    this.rootInverse.copy(root.matrixWorld).invert();

    const byLook = new Map<string, { base: Material; meshes: Mesh[] }>();
    for (const mesh of batchableMeshes()) {
      if (!isWithin(mesh, root) || !mesh.visible) continue;
      const material = mesh.material;
      if (
        Array.isArray(material) ||
        !isSharedSurfaceMaterial(material) ||
        !mesh.geometry.hasAttribute("position") ||
        !mesh.geometry.hasAttribute("normal")
      ) {
        continue;
      }
      const base = plainSurfaceMaterial(material);
      if (!base) {
        // A removal tint or ghost: drawn on its own until it is plain again.
        this.skipped.push({
          mesh,
          reason: () =>
            plainSurfaceMaterial(mesh.material) ? "plain" : "tint",
          seen: "tint",
        });
        continue;
      }
      const popping = scaleSignature(mesh, root);
      if (popping) {
        // Still scaling in: baking it now would freeze it part-grown.
        this.skipped.push({
          mesh,
          reason: () => scaleSignature(mesh, root),
          seen: popping,
        });
        continue;
      }
      const key = [
        base.uuid,
        mesh.castShadow ? 1 : 0,
        mesh.receiveShadow ? 1 : 0,
        mesh.layers.mask,
        mesh.renderOrder,
      ].join("|");
      const entry = byLook.get(key);
      if (entry) entry.meshes.push(mesh);
      else byLook.set(key, { base, meshes: [mesh] });
    }

    for (const { base, meshes } of byLook.values()) {
      if (meshes.length >= MIN_GROUP_SIZE) this.buildGroup(base, meshes);
    }
  }

  private buildGroup(base: Material, meshes: Mesh[]): void {
    const first = meshes[0];
    const withColor = (base as Material & { vertexColors: boolean })
      .vertexColors;
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
    const { geometry, ranges } = mergeGeometries(sources, withColor);
    const merged = new Mesh(geometry, base);
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
      const placed = new Float32Array(16);
      new Matrix4()
        .multiplyMatrices(this.rootInverse, mesh.matrixWorld)
        .toArray(placed);
      this.members.push({
        source: mesh,
        material: base,
        geometry: mesh.geometry,
        group,
        start,
        count: last.start + last.count - start,
        placed,
        instanceVersion:
          (mesh as Partial<InstancedMesh>).instanceMatrix?.version ?? 0,
        isOutdated: false,
        isBatched: false,
      });
    }
    // Every piece starts in the merged mesh; `sync` blanks any that differ.
    for (const member of this.members) {
      if (member.group === group) this.setBatched(member, true);
    }
  }

  /** Brings each member in line with its source's current state. */
  private sync(): void {
    for (const member of this.members) {
      const { source } = member;
      const shouldBatch =
        !member.isOutdated &&
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

const PLACED_SCRATCH = new Float32Array(16);

function sameMatrix(a: Float32Array, b: Float32Array): boolean {
  for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-5) return false;
  return true;
}
