import type { ShipKind } from "../model/kinds";

export type ObstacleKind = "iceberg" | "rock" | "buoy" | "ship";

/** Only buoys are soft: a bump with no damage. */
export const SOFT_OBSTACLES: readonly ObstacleKind[] = ["buoy"];

export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  x: number;
  z: number;
  /** Collision radius in cells. */
  radius: number;
  /** Other ships only: heading (radians) and speed (cells/s). */
  heading?: number;
  speed?: number;
  /** Sector this obstacle was seeded in, "sx:sz" (see field.ts). */
  sector: string;
}

export interface SailInput {
  /** -0.3 (slow reverse) to 1 (full ahead). */
  throttle: number;
  /** -1 (port) to 1 (starboard). */
  rudder: number;
}

/** What the sail model needs to know about the ship. */
export interface SailShip {
  kind: ShipKind;
  /** Hull length and width in cells. */
  length: number;
  beam: number;
  topSpeedKnots: number;
  grossTonnage: number;
}

export interface Handling {
  /** Cells per second at full throttle. */
  topSpeed: number;
  /** Seconds from stop to top speed. */
  accelSeconds: number;
  /** Radians per second at full rudder and full speed. */
  maxTurnRate: number;
  /** Rudder units per second (how fast the rudder follows the input). */
  rudderRate: number;
}

export type HullPart = "bow" | "side" | "stern";

export interface SailImpact {
  obstacleId: string;
  kind: ObstacleKind;
  /** Cells from the bow, 0..length (matches `impactX` of the sea trial). */
  impactX: number;
  part: HullPart;
  /** Cells per second the hull and obstacle were closing at. */
  closingSpeed: number;
  at: number;
}

export interface SailState {
  time: number;
  x: number;
  z: number;
  heading: number;
  /** Signed cells per second along the heading; negative is reversing. */
  speed: number;
  /** The rudder as it is (it follows the input at `rudderRate`). */
  rudder: number;
  obstacles: Obstacle[];
  /** Sector keys already seeded. */
  sectors: string[];
  /** Set by the last soft bump (a buoy); the HUD can flash on a change. */
  bump: { id: string; at: number } | null;
  /** Set on a hard hit; the model stops moving once it is set. */
  impact: SailImpact | null;
}
