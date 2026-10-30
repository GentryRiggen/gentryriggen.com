import { DoubleSide, FrontSide, MeshStandardMaterial } from "three";
import { PALETTE } from "./palette";
import { withRust } from "./rust";

export type PartTint = keyof typeof PALETTE.tint | null;
export type PartEmphasis = keyof typeof PALETTE.emphasis | null;

/** How a surface catches the light: satin paint, glass, metal or wood. */
export type SurfaceFinish = "paint" | "glass" | "metal" | "wood";

export const FINISHES: Record<
  SurfaceFinish,
  { roughness: number; metalness: number }
> = {
  paint: { roughness: 0.55, metalness: 0 },
  glass: { roughness: 0.1, metalness: 0 },
  metal: { roughness: 0.4, metalness: 0.6 },
  wood: { roughness: 0.8, metalness: 0 },
};

interface SurfaceProps {
  color: string;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Opacity when not a ghost (glass); ghosts are always 0.55. */
  opacity?: number;
  /** Draw both faces, for flat cloth and open shells. */
  doubleSided?: boolean;
  /** Defaults to satin paint. */
  finish?: SurfaceFinish;
  /**
   * Multiplies the paint by the geometry's vertex colours (a glb part's
   * baked ambient occlusion). Only for geometry that has a `color`
   * attribute. Ghost and removal tints ignore it and stay flat.
   */
  vertexColors?: boolean;
}

interface SurfaceLook {
  /** The colour actually drawn: the tint's, when there is one. */
  color: string;
  finish: SurfaceFinish;
  emphasis: PartEmphasis;
  opacity: number;
  doubleSided: boolean;
  /** Paint times the vertex colours; absent means flat. */
  vertexColors?: boolean;
}

const GHOST_OPACITY = 0.55;

/**
 * Every surface with the same look shares one material, so hundreds of parts
 * cost a handful of materials (fewer shader switches, less memory). Materials
 * here live for the whole session and are never mutated or disposed; a look
 * is a pure key.
 */
const materialCache = new Map<string, MeshStandardMaterial>();
const cachedMaterials = new WeakSet<MeshStandardMaterial>();
const looksByMaterial = new WeakMap<MeshStandardMaterial, SurfaceLook>();

function lookKey(look: SurfaceLook): string {
  return [
    look.color,
    look.finish,
    look.emphasis ?? "-",
    look.opacity,
    look.doubleSided ? "2" : "1",
    look.vertexColors ? "vc" : "-",
  ].join("|");
}

function createMaterial(look: SurfaceLook): MeshStandardMaterial {
  return withRust(
    new MeshStandardMaterial({
      color: look.color,
      transparent: look.opacity < 1,
      opacity: look.opacity,
      side: look.doubleSided ? DoubleSide : FrontSide,
      vertexColors: look.vertexColors ?? false,
      emissive: look.emphasis ? PALETTE.emphasis[look.emphasis] : "#000000",
      emissiveIntensity: look.emphasis ? 0.4 : 0,
      roughness: FINISHES[look.finish].roughness,
      metalness: FINISHES[look.finish].metalness,
    })
  );
}

/** The shared material for a surface look, made on first use. */
export function surfaceMaterial(look: SurfaceLook): MeshStandardMaterial {
  const key = lookKey(look);
  let material = materialCache.get(key);
  if (!material) {
    material = createMaterial(look);
    materialCache.set(key, material);
    cachedMaterials.add(material);
    looksByMaterial.set(material, look);
  }
  return material;
}

/**
 * The plain look of a shared material, for merging: the same paint with no
 * hover or selection glow. Null for materials that are not shared, see-through
 * ones (ghosts, glass) and removal tints, which are never merged.
 */
export function plainSurfaceMaterial(
  material: unknown
): MeshStandardMaterial | null {
  const look = looksByMaterial.get(material as MeshStandardMaterial);
  if (!look || look.opacity < 1) return null;
  if ((Object.values(PALETTE.tint) as string[]).includes(look.color))
    return null;
  return look.emphasis
    ? surfaceMaterial({ ...look, emphasis: null })
    : (material as MeshStandardMaterial);
}

/** Whether a material is one of the shared ones above (never mutated). */
export function isSharedSurfaceMaterial(material: unknown): boolean {
  return cachedMaterials.has(material as MeshStandardMaterial);
}

/**
 * The look a surface's props ask for: a ghost/removal tint replaces the
 * colour (and drops baked vertex shading, so tints read flat), and ghosts
 * are see-through.
 */
export function surfaceLook({
  color,
  tint,
  emphasis,
  opacity = 1,
  doubleSided = false,
  finish = "paint",
  vertexColors = false,
}: SurfaceProps): SurfaceLook {
  const ghost = tint === "ghost-ok" || tint === "ghost-bad";
  return {
    color: tint ? PALETTE.tint[tint] : color,
    finish,
    emphasis,
    opacity: ghost ? GHOST_OPACITY : opacity,
    doubleSided,
    vertexColors: vertexColors && !tint,
  };
}

/**
 * The material every part mesh uses: a ghost/removal tint replaces the colour,
 * and emphasis adds a hover/selection glow. Materials are shared (see above),
 * and `primitive` never disposes what it is given.
 */
export default function Surface(props: SurfaceProps) {
  const material = surfaceMaterial(surfaceLook(props));
  return <primitive object={material} attach="material" />;
}
