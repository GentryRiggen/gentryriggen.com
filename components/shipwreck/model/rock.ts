import {
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  type BufferAttribute,
} from "three";
import { hash01, type ShipRecipe } from "./titanicRecipe";

/**
 * The rock torn off Le Scole and stuck in the Concordia's port side (R21):
 * a lumpy grey granite block as its own small mesh, in the ship frame of
 * the part it is added to (three.js axes: x forward, y up, z to
 * starboard). Hidden until the scene shows it (`ShipRig`, from
 * `rock.fromT`); the model viewer shows it always.
 */
export function createRockMesh(rock: NonNullable<ShipRecipe["rock"]>): Mesh {
  const g = new IcosahedronGeometry(rock.r, 1);
  const pos = g.getAttribute("position") as BufferAttribute;
  // Lumps: each corner pushed in or out by a fixed hash of where it is,
  // the same for the corners that coincide (no cracks).
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k =
      0.72 +
      0.5 *
        hash01(
          Math.round(x * 100) * 7 + Math.round(y * 100),
          Math.round(z * 100)
        );
    // Flatter where it lies against her plating.
    pos.setXYZ(i, x * k * 1.15, y * k * 0.85, z * k);
  }
  g.computeVertexNormals();
  const m = new Mesh(
    g,
    new MeshStandardMaterial({
      color: 0x77716a,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    })
  );
  m.name = "rock";
  const [x, y, z] = rock.p;
  m.position.set(x, z, -y);
  return m;
}

/** Frees the rock's geometry and material. */
export function disposeRockMesh(m: Mesh): void {
  m.geometry.dispose();
  (m.material as MeshStandardMaterial).dispose();
}
