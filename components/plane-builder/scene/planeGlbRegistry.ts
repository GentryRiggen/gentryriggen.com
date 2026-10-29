import { useGLTF } from "@react-three/drei";
import pieces from "@/assets/plane-pieces.json";
import type { LevelId } from "@/lib/plane-builder/levels/types";

/**
 * The plane pieces drawn from Blender-made glbs. `assets/plane-pieces.json`
 * lists them (the asset scripts read the same file): a piece is a spec
 * (`assets/parts/plane-<piece>.json`) and each of its units is one glb,
 * `public/plane-builder/models/plane-<piece>/<unit>.glb`. A unit with a glb
 * is drawn by `PlaneGlbUnit`; the procedural unit stays as its fallback.
 */
export type PlanePiece = keyof typeof pieces;

export interface PlaneUnitEntry {
  /** The spec id, and the directory under public/plane-builder/models/. */
  model: string;
  piece: PlanePiece;
  /** The file name there, without `.glb`. */
  unit: string;
  /** Palette (and look) the studio draws the unit with. */
  level: LevelId;
  /** The whole unit turns about its X axis, like a propeller. */
  spin: boolean;
}

interface UnitJson {
  level: string;
  spin?: boolean;
}

/** Every unit, keyed by its (globally unique) name. */
export const PLANE_UNITS: Readonly<Record<string, PlaneUnitEntry>> =
  Object.fromEntries(
    (Object.keys(pieces) as PlanePiece[]).flatMap((piece) =>
      Object.entries(pieces[piece].units as Record<string, UnitJson>).map(
        ([unit, json]) => [
          unit,
          {
            model: `plane-${piece}`,
            piece,
            unit,
            level: json.level as LevelId,
            spin: json.spin === true,
          } satisfies PlaneUnitEntry,
        ]
      )
    )
  );

export type PlaneUnit = string;

export function planeModelUrl(model: string, unit: string): string {
  return `/plane-builder/models/${model}/${unit}.glb`;
}

/** Every model the game can draw. */
export const PLANE_MODEL_URLS: readonly string[] = Object.values(
  PLANE_UNITS
).map((entry) => planeModelUrl(entry.model, entry.unit));

/** Starts loading every model, so pieces rarely show their stand-in. */
export function preloadPlaneModels(): void {
  for (const url of PLANE_MODEL_URLS) useGLTF.preload(url, false, false);
}
