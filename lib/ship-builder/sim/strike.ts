import { GASH_LENGTH } from "./compartments";
import type { IcebergInput, StrikeKind } from "./types";

/**
 * How each kind of strike opens the hull. A mine blows a wide hole and the sea
 * rushes in; an island grinds a long scrape along her bottom that lets the
 * water in slowly, so she sits on the rocks a while before (maybe) going down.
 */
export interface StrikeSpec {
  /** Cells the hole runs along the hull. */
  gashLength: number;
  /** Multiplies the usual inflow through the hole. */
  inflowScale: number;
}

export const STRIKES: Record<StrikeKind, StrikeSpec> = {
  iceberg: { gashLength: GASH_LENGTH, inflowScale: 1 },
  mine: { gashLength: 8, inflowScale: 2.6 },
  island: { gashLength: 7, inflowScale: 0.25 },
};

/** What struck her; an iceberg when the input does not say. */
export function strikeOf(iceberg: IcebergInput | undefined): StrikeKind {
  return iceberg?.strike ?? "iceberg";
}

/** The inflow multiplier of an iceberg input (1 for a plain iceberg). */
export function inflowScaleOf(iceberg: IcebergInput | undefined): number {
  return STRIKES[strikeOf(iceberg)].inflowScale;
}

/** A sentence-ready name for what opened her: "The mine", "The rocks". */
export const STRIKE_NOUN: Record<StrikeKind, string> = {
  iceberg: "The iceberg",
  mine: "The mine",
  island: "The rocks",
};
