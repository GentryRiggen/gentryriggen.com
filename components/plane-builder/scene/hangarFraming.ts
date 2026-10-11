import { MAX_TIER, type Tiers } from "@/lib/plane-builder/plane/catalog";
import { planeParts } from "./planeParts";

/** Tailwind's `md:` breakpoint, where the hangar panel becomes a sidebar. */
export const SIDEBAR_MIN_WIDTH = 768;
/** The sidebar's width (`md:w-[22rem]`) in px. */
export const SIDEBAR_WIDTH = 352;
/** The bottom sheet's tallest share of the screen (`max-h-[50%]`). */
export const SHEET_SHARE = 0.5;

const MAX_TIERS: Tiers = {
  launcher: MAX_TIER,
  wings: MAX_TIER,
  engine: MAX_TIER,
  fuel: MAX_TIER,
  body: MAX_TIER,
  multiplier: MAX_TIER,
};

const FRAMING_MARGIN = 1.15;

/**
 * Radius of a sphere that holds the biggest plane as it turns on the
 * turntable. Fixed, so buying a part never makes the camera jump.
 */
export const HANGAR_PLANE_RADIUS =
  Math.hypot(
    planeParts("mountains", MAX_TIERS).wingSpan / 2,
    planeParts("mountains", MAX_TIERS).bodyLength / 2
  ) * FRAMING_MARGIN;

export interface HangarFraming {
  /** How far the camera sits from the plane. */
  distance: number;
  /** Pixels to slide the view sideways, so the plane lands left of the sidebar. */
  offsetX: number;
  /** Pixels to slide the view up, so the plane lands above the bottom sheet. */
  offsetY: number;
}

/**
 * Works out where the camera must be, and how far to shift the view, so the
 * whole turning plane fits in the part of the screen the panel leaves open:
 * the upper part on phones (bottom sheet), the left part from `md:` (sidebar).
 */
export function hangarFraming(
  width: number,
  height: number,
  fovDegrees: number,
  radius = HANGAR_PLANE_RADIUS
): HangarFraming {
  const hasSidebar = width >= SIDEBAR_MIN_WIDTH;
  const openWidth = hasSidebar ? Math.max(1, width - SIDEBAR_WIDTH) : width;
  const openHeight = hasSidebar ? height : height * (1 - SHEET_SHARE);
  const halfTan = Math.tan((fovDegrees * Math.PI) / 360);
  // Pixels per world unit at distance d is height / (2 d halfTan), and the
  // plane may fill half of the smaller open dimension.
  const distance =
    (radius * height) / (Math.min(openWidth, openHeight) * halfTan);
  return {
    distance,
    offsetX: hasSidebar ? SIDEBAR_WIDTH / 2 : 0,
    offsetY: hasSidebar ? 0 : (height * SHEET_SHARE) / 2,
  };
}
