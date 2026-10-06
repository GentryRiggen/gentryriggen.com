import type { HullArea, PaintColor } from "./paint";
import type { BowShape, SternShape } from "./types";

export const SHIP_KINDS = [
  "liner",
  "cruise",
  "navy",
  "cargo",
  "pirate",
] as const;
export type ShipKind = (typeof SHIP_KINDS)[number];

export const DEFAULT_KIND: ShipKind = "liner";

export interface KindDefaults {
  /** Name given to a new ship of this kind. */
  name: string;
  bow: BowShape;
  stern: SternShape;
  /** Absent means the default paint look. */
  paint?: Partial<Record<HullArea, PaintColor>>;
}

export const KIND_DEFAULTS: Record<ShipKind, KindDefaults> = {
  liner: { name: "Untitled liner", bow: "straight", stern: "counter" },
  cruise: {
    name: "Untitled cruise ship",
    bow: "bulbous",
    stern: "transom",
    paint: { topsides: "white", bottom: "navy" },
  },
  navy: {
    name: "Untitled navy ship",
    bow: "clipper",
    stern: "transom",
    paint: { topsides: "grey", bottom: "grey" },
  },
  cargo: {
    name: "Untitled cargo ship",
    bow: "bulbous",
    stern: "transom",
    paint: { topsides: "navy", bottom: "red" },
  },
  pirate: {
    name: "Untitled pirate ship",
    bow: "beakhead",
    stern: "galleon",
    paint: { topsides: "oak", bottom: "dark-oak" },
  },
};

export function isShipKind(value: unknown): value is ShipKind {
  return (SHIP_KINDS as readonly unknown[]).includes(value);
}

/** Which of the player's computed stats a real-ship figure lines up with. */
export type ReferenceMetric =
  | "tonnage"
  | "speed"
  | "seats"
  | "people"
  | "passengers"
  | "crew"
  | "teu"
  | "cannons";

export interface ReferenceFigure {
  metric: ReferenceMetric;
  label: string;
  value: number;
  /** Shown after the number, e.g. "kn". */
  unit?: string;
}

export interface ReferenceShip {
  /** Heading of the comparison box, e.g. "RMS Titanic (1912)". */
  title: string;
  /** Real-world numbers that can be compared bar-for-bar with the player's. */
  figures: ReferenceFigure[];
  /** A figure the model can't compute, shown as plain text. */
  note?: string;
}

/** Approximate real-world figures shown beside a player's own stats. */
export const REFERENCE_SHIPS: Record<ShipKind, ReferenceShip> = {
  liner: {
    title: "RMS Titanic (1912)",
    figures: [
      { metric: "tonnage", label: "Gross tonnage", value: 46328 },
      { metric: "speed", label: "Top speed", value: 21, unit: "kn" },
      { metric: "seats", label: "Lifeboat seats", value: 1178 },
      { metric: "people", label: "People aboard", value: 2224 },
    ],
  },
  cruise: {
    title: "Wonder of the Seas (2022)",
    figures: [
      { metric: "tonnage", label: "Gross tonnage", value: 236857 },
      { metric: "speed", label: "Top speed", value: 22, unit: "kn" },
      { metric: "passengers", label: "Passengers", value: 5734 },
      { metric: "crew", label: "Crew", value: 2300 },
    ],
  },
  navy: {
    title: "Arleigh Burke destroyer",
    figures: [
      { metric: "speed", label: "Top speed", value: 30, unit: "kn" },
      { metric: "crew", label: "Crew", value: 300 },
    ],
    // Displacement is a mass, which the model doesn't compute.
    note: "Displaces about 9,200 tons",
  },
  cargo: {
    title: "Ever Given (2018)",
    figures: [
      { metric: "tonnage", label: "Gross tonnage", value: 219079 },
      { metric: "speed", label: "Top speed", value: 22.8, unit: "kn" },
      { metric: "teu", label: "Cargo", value: 20124, unit: "TEU" },
      { metric: "crew", label: "Crew", value: 25 },
    ],
  },
  pirate: {
    title: "Queen Anne's Revenge (1718)",
    figures: [
      { metric: "speed", label: "Top speed", value: 11, unit: "kn" },
      { metric: "crew", label: "Crew", value: 150 },
      { metric: "cannons", label: "Cannons", value: 40 },
    ],
    // Gross tonnage means little for a ship this size.
    note: "Displaced about 300 tons",
  },
};
