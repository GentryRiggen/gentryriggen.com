// lib/plane-builder/levels/types.ts
import type { PlaneCatalog } from "../plane/catalog";

export type LevelId = "meadow" | "canyon" | "mountains";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type ObstacleKind =
  | "tree"
  | "barn"
  | "balloon"
  | "wall"
  | "arch"
  | "bird"
  | "peak"
  | "palm"
  | "skyscraper"
  | "iceberg"
  | "cloud";

/** An axis-aligned box. Rendering may draw a nicer shape inside it. */
export interface Obstacle {
  kind: ObstacleKind;
  center: Vec3;
  half: Vec3;
  /** Hard ends the flight (or spends a shield); soft only slows. */
  hard: boolean;
}

export interface Ring {
  center: Vec3;
  radius: number;
}

/** Inside fromX..toX, lift pushes up and push pushes sideways (+z), in m/s. */
export interface WindZone {
  fromX: number;
  toX: number;
  lift: number;
  push: number;
}

export interface TerrainDef {
  seed: number;
  /** Tallest hill, m. 0 = flat. */
  amplitude: number;
  wavelength: number;
  /** Flat ground up to here (slingshot area). */
  flatUntil: number;
}

export interface LevelPalette {
  sky: string;
  horizon: string;
  ground: string;
  hill: string;
  hard: string;
  soft: string;
  plane: string;
  trim: string;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  blurb: string;
  finishDistance: number;
  corridorHalfWidth: number;
  /** Coins per metre of progress. */
  payPerMeter: number;
  /** Every flight pays at least this. */
  minPayout: number;
  terrain: TerrainDef;
  obstacles: Obstacle[];
  coins: Vec3[];
  rings: Ring[];
  /** Floating fuel cans; only planes with an engine collect them. */
  fuelCans: Vec3[];
  winds: WindZone[];
  plane: PlaneCatalog;
  palette: LevelPalette;
}
