import { PART_SPEC_LIST } from "@/assets/parts";

export interface PartVariant {
  name: string;
  dims: Record<string, number>;
  expectedBounds: { min: number[]; max: number[] };
}

export interface PartViewSpec {
  name: string;
  azimuthDeg: number;
  elevationDeg: number;
  ortho: boolean;
}

export interface SlotColorSpec {
  color: string;
  finish?: "metal" | "glass" | "wood";
}

/** The slice of a part spec (assets/parts/<id>.json) the studio reads. */
export interface PartSpec {
  id: string;
  slots: string[];
  /** Colour and finish per slot, for drawing a model the game doesn't list. */
  slotColors?: Record<string, SlotColorSpec>;
  variants: PartVariant[];
  views: PartViewSpec[];
  scoreVariant: string;
  /** Tilt about Z the game applies outside the model (a funnel's rake). */
  rakeRadians?: number;
  /** A detail-kit piece (a window frame, a porthole rim): drawn by KitStudio, not as a game part. */
  kit?: boolean;
  /** Work the modeller still has to do (slots not derived, and so on). */
  todo?: string[];
}

/** Every part spec, keyed by spec id. */
export const PART_SPECS: Record<string, PartSpec> = Object.fromEntries(
  (PART_SPEC_LIST as PartSpec[]).map((spec) => [spec.id, spec])
);

/**
 * The spec and variant behind a Ship Builder part id: the spec with that id
 * (its scoring variant), else the spec that lists the id as a variant (the
 * `funnel-large` variant of the `funnel` spec).
 */
export function specForPart(
  partId: string
): { spec: PartSpec; variant: string } | null {
  if (Object.hasOwn(PART_SPECS, partId)) {
    const spec = PART_SPECS[partId];
    return { spec, variant: spec.scoreVariant };
  }
  for (const spec of Object.values(PART_SPECS)) {
    if (spec.variants.some((v) => v.name === partId)) {
      return { spec, variant: partId };
    }
  }
  return null;
}
