import { Matrix4, type BufferGeometry, type Mesh, type Object3D } from "three";
import type { SurfaceFinish } from "./Surface";

/** How one named slot of a glb part is drawn. */
export interface GlbSlotLook {
  color: string;
  finish?: SurfaceFinish;
  castShadow?: boolean;
  /** Puts the mesh on the ambient-occlusion layer (see aoLayer.ts). */
  aoOccluder?: boolean;
  /** Turns about the shaft (local X) at the ship's pace, like a propeller. */
  spin?: boolean;
}

/** One mesh of a loaded glb, named by its paint slot. */
export interface SlotMesh {
  slot: string;
  /** The loader's own geometry, shared by every instance: never dispose. */
  geometry: BufferGeometry;
  /** The node's transform within the file, or null when it has none. */
  matrix: Matrix4 | null;
  /** The mesh carries baked ambient occlusion (glTF COLOR_0). */
  baked: boolean;
}

/** A slot name for a mesh: its node name, else its material's. */
function slotNameOf(mesh: Mesh): string {
  if (mesh.name) return mesh.name;
  const material = Array.isArray(mesh.material)
    ? mesh.material[0]
    : mesh.material;
  return material?.name ?? "";
}

const IDENTITY = new Matrix4();

/** Every scene's meshes, found once and shared by all its instances. */
const meshCache = new WeakMap<Object3D, SlotMesh[]>();

/**
 * The slot meshes of a loaded glb scene. Each mesh must be named by one of
 * `slots`; an unknown name throws (the renderer's error boundary then draws
 * the fallback), so a mis-named mesh is caught rather than drawn unpainted.
 * Slots the file lacks are simply not drawn.
 */
export function slotMeshesOf(
  scene: Object3D,
  slots: readonly string[],
  url: string
): SlotMesh[] {
  let meshes = meshCache.get(scene);
  if (!meshes) {
    const found: SlotMesh[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const matrix = mesh.matrixWorld.equals(IDENTITY)
        ? null
        : mesh.matrixWorld.clone();
      found.push({
        slot: slotNameOf(mesh),
        geometry: mesh.geometry,
        matrix,
        baked: mesh.geometry.hasAttribute("color"),
      });
    });
    meshes = found;
    meshCache.set(scene, meshes);
  }
  for (const { slot } of meshes) {
    if (!slots.includes(slot)) {
      throw new Error(`Unknown slot "${slot}" in ${url}`);
    }
  }
  return meshes;
}
