import { DoubleSide, MeshStandardMaterial } from "three";
import type { LevelPalette } from "@/lib/plane-builder/levels/types";
import type { PlaneParts } from "./planeParts";

const GOLD = "#f5b82e";
const DARK = "#2f3a4a";
const FIRE = "#ff7a1a";
const GLOW_TRIM_INTENSITY = 0.5;
const GLOW_INTENSITY = 2;

/** The five paints a plane is drawn with; a model's slots are named by these. */
export const MATERIAL_KEYS = ["body", "trim", "dark", "fire", "glow"] as const;
export type MaterialKey = (typeof MATERIAL_KEYS)[number];

export type PaintSet = Record<MaterialKey, MeshStandardMaterial>;

export interface PlaneMaterials extends PaintSet {
  /**
   * The same paints with vertex colours on, for a model that carries baked
   * ambient occlusion (glTF COLOR_0). Only used on meshes that have it.
   */
  baked: PaintSet;
}

function trimEmissive(
  isGold: boolean,
  isGlowTrim: boolean,
  trimColor: string
): string {
  if (isGold) return "#8a6400";
  return isGlowTrim ? trimColor : "#000000";
}

/** The plane's materials for a look and palette (gold and glow trims included). */
export function createPlaneMaterials(
  parts: Pick<PlaneParts, "isGold" | "hasGlowTrim">,
  palette: Pick<LevelPalette, "plane" | "trim">
): PlaneMaterials {
  const isGlowTrim = parts.hasGlowTrim && !parts.isGold;
  const paints: PaintSet = {
    body: new MeshStandardMaterial({
      color: parts.isGold ? GOLD : palette.plane,
      metalness: parts.isGold ? 0.3 : 0.1,
      emissive: parts.isGold ? "#7a5200" : "#000000",
      roughness: parts.isGold ? 0.35 : 0.6,
      side: DoubleSide,
    }),
    trim: new MeshStandardMaterial({
      color: parts.isGold ? "#ffe08a" : palette.trim,
      metalness: parts.isGold ? 0.3 : 0,
      emissive: trimEmissive(parts.isGold, isGlowTrim, palette.trim),
      emissiveIntensity: isGlowTrim ? GLOW_TRIM_INTENSITY : 1,
      roughness: parts.isGold ? 0.35 : 0.6,
    }),
    dark: new MeshStandardMaterial({ color: DARK, roughness: 0.5 }),
    fire: new MeshStandardMaterial({
      color: FIRE,
      emissive: FIRE,
      emissiveIntensity: 2.5,
    }),
    glow: new MeshStandardMaterial({
      color: palette.trim,
      emissive: palette.trim,
      emissiveIntensity: GLOW_INTENSITY,
    }),
  };
  const baked = Object.fromEntries(
    MATERIAL_KEYS.map((key) => {
      const material = paints[key].clone();
      material.vertexColors = true;
      return [key, material];
    })
  ) as PaintSet;
  return { ...paints, baked };
}

/** Frees every material made by `createPlaneMaterials`. */
export function disposePlaneMaterials(materials: PlaneMaterials): void {
  for (const key of MATERIAL_KEYS) {
    materials[key].dispose();
    materials.baked[key].dispose();
  }
}
