import {
  Box3,
  Vector3,
  type BufferAttribute,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from "three";

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

const ROUND = 10_000;
const round = (v: number) => Math.round(v * ROUND) / ROUND + 0; // + 0: never -0

/**
 * The bounding box of every visible mesh under `root`, from its vertices in
 * `root`'s world frame, then turned back by `rakeRadians` about Z so a part
 * the game tilts (a funnel's rake) is measured upright. Rounded to 4 places.
 * Null when there is no geometry.
 */
export function partBounds(root: Object3D, rakeRadians = 0): Bounds | null {
  root.updateMatrixWorld(true);
  const box = new Box3();
  const point = new Vector3();
  const cos = Math.cos(-rakeRadians);
  const sin = Math.sin(-rakeRadians);
  root.traverseVisible((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position") as
      BufferAttribute | undefined;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(
        point.set(
          point.x * cos - point.y * sin,
          point.x * sin + point.y * cos,
          point.z
        )
      );
    }
  });
  if (box.isEmpty()) return null;
  return {
    min: box.min.toArray().map(round) as Bounds["min"],
    max: box.max.toArray().map(round) as Bounds["max"],
  };
}

/** One distinct paint in a part: what a Blender slot would be. */
export interface SlotGuess {
  /** A name from the game's palette when the colour is one, else `paint-<hex>`. */
  name: string;
  color: string;
  finish: "paint" | "glass" | "metal" | "wood";
  meshes: number;
  triangles: number;
}

function finishOf(roughness: number, metalness: number): SlotGuess["finish"] {
  if (metalness > 0.3) return "metal";
  if (roughness >= 0.7) return "wood";
  if (roughness <= 0.15) return "glass";
  return "paint";
}

/** Palette hex -> key (`cabin.first` -> `cabin-first`), for naming slots. */
export function paletteNames(
  palette: Record<string, unknown>
): Map<string, string> {
  const names = new Map<string, string>();
  const walk = (value: unknown, path: string[]) => {
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
      const hex = value.toLowerCase();
      if (!names.has(hex)) names.set(hex, path.join("-"));
    } else if (value && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) {
        walk(inner, [...path, key]);
      }
    }
  };
  walk(palette, []);
  return names;
}

/**
 * The distinct `Surface` paints under `root` (shared materials, so one per
 * colour and finish), with mesh and triangle counts. Meshes with any other
 * material (unlit glow, sprites) are counted under the name `unlit`.
 */
export function partSlots(
  root: Object3D,
  names: ReadonlyMap<string, string>
): SlotGuess[] {
  const found = new Map<string, SlotGuess>();
  root.traverseVisible((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    const standard = material as MeshStandardMaterial;
    const triangles =
      (mesh.geometry.index?.count ??
        mesh.geometry.getAttribute("position")?.count ??
        0) / 3;
    let guess: SlotGuess;
    if (!standard.isMeshStandardMaterial) {
      guess = found.get("unlit") ?? {
        name: "unlit",
        color: "#000000",
        finish: "paint",
        meshes: 0,
        triangles: 0,
      };
      found.set("unlit", guess);
    } else {
      const color = `#${standard.color.getHexString()}`;
      const finish = finishOf(standard.roughness, standard.metalness);
      const key = `${color}/${finish}`;
      guess = found.get(key) ?? {
        name: names.get(color) ?? `paint-${color.slice(1)}`,
        color,
        finish,
        meshes: 0,
        triangles: 0,
      };
      found.set(key, guess);
    }
    guess.meshes += 1;
    guess.triangles += Math.round(triangles);
  });
  return [...found.values()];
}
