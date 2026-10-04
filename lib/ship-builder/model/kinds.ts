import type { HullArea, PaintColor } from "./paint";
import type { BowShape, SternShape } from "./types";

export const SHIP_KINDS = ["liner", "cruise", "navy", "cargo"] as const;
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
};

export function isShipKind(value: unknown): value is ShipKind {
  return (SHIP_KINDS as readonly unknown[]).includes(value);
}

export interface ReferenceRow {
  label: string;
  value: string;
}

export interface ReferenceShip {
  /** Heading of the comparison box, e.g. "RMS Titanic (1912)". */
  title: string;
  rows: ReferenceRow[];
}

/** Approximate real-world figures shown beside a player's own stats. */
export const REFERENCE_SHIPS: Record<ShipKind, ReferenceShip> = {
  liner: {
    title: "RMS Titanic (1912)",
    rows: [
      { label: "Tonnage", value: "46,328" },
      { label: "Speed", value: "21 kn" },
      { label: "Lifeboats", value: "20 (1,178 seats)" },
      { label: "Aboard", value: "2,224" },
    ],
  },
  cruise: {
    title: "Wonder of the Seas (2022)",
    rows: [
      { label: "Tonnage", value: "236,857" },
      { label: "Speed", value: "22 kn" },
      { label: "Passengers", value: "5,734" },
      { label: "Crew", value: "2,300" },
    ],
  },
  navy: {
    title: "Arleigh Burke destroyer",
    rows: [
      { label: "Displacement", value: "9,200 t" },
      { label: "Speed", value: "30+ kn" },
      { label: "Crew", value: "about 300" },
    ],
  },
  cargo: {
    title: "Ever Given (2018)",
    rows: [
      { label: "Tonnage", value: "219,079" },
      { label: "Speed", value: "22.8 kn" },
      { label: "Cargo", value: "20,124 TEU" },
      { label: "Crew", value: "25" },
    ],
  },
};
