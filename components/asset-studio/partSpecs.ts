import funnel from "@/assets/parts/funnel.json";

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

/** The slice of a part spec (assets/parts/<id>.json) the studio reads. */
export interface PartSpec {
  id: string;
  slots: string[];
  variants: PartVariant[];
  views: PartViewSpec[];
  scoreVariant: string;
}

/** Every part the studio knows, keyed by spec id. */
export const PART_SPECS: Record<string, PartSpec> = {
  funnel: funnel as PartSpec,
};
