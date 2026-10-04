import type { ReactNode } from "react";
import { PALETTE } from "@/components/ship-builder/scene/palette";
import type { BowShape, SternShape } from "@/lib/ship-builder/model/types";

export type HullEndKind =
  { end: "bow"; shape: BowShape } | { end: "stern"; shape: SternShape };

interface HullEndIconProps {
  kind: HullEndKind;
  className?: string;
}

/** Y of the deck line and of the water in every drawing. */
const DECK = 12;
const WATER = 26;

/**
 * Side views on a 48 × 48 canvas. Bows point right and sterns point left, so
 * the hull body always runs toward the middle of the tile.
 */
const BOW_DRAWINGS: Record<BowShape, () => ReactNode> = {
  // Upright stem.
  straight: () => <path d="M3 12 H40 V38 H3 Z" fill={PALETTE.hull} />,
  // Long and raked: the top reaches far ahead of the keel.
  clipper: () => <path d="M3 12 H46 Q38 28 28 38 H3 Z" fill={PALETTE.hull} />,
  // Upright stem with a round bulb out front, under the water.
  bulbous: () => (
    <g>
      <path d="M3 12 H38 L35 38 H3 Z" fill={PALETTE.hull} />
      <circle cx={39} cy={32} r={6} fill={PALETTE.antifouling} />
    </g>
  ),
  // A ramp: the keel runs ahead of the deck so she can ride up on ice.
  icebreaker: () => (
    <g>
      <path d="M3 12 H32 L45 38 H3 Z" fill={PALETTE.hull} />
      <path
        d="M36 22 L40 17 L45 22 L43 26 Z"
        fill={PALETTE.sky}
        strokeWidth={1}
      />
    </g>
  ),
};

const STERN_DRAWINGS: Record<SternShape, () => ReactNode> = {
  // Overhanging deck over a rounded, tucked-in underbody.
  counter: () => (
    <path
      d="M3 12 H45 V38 H22 Q14 38 12 30 Q10 22 3 12 Z"
      fill={PALETTE.hull}
    />
  ),
  // One smooth bulge from deck to keel.
  cruiser: () => (
    <path d="M10 12 H45 V38 H24 Q10 36 10 12 Z" fill={PALETTE.hull} />
  ),
  // Cut off flat, with the plate showing.
  transom: () => (
    <g>
      <path d="M8 12 H45 V38 H8 Z" fill={PALETTE.hull} />
      <path d="M12 16 V34" stroke={PALETTE.deck} strokeWidth={2} />
    </g>
  ),
  // Pointed, like a bow.
  canoe: () => (
    <path d="M2 25 Q8 14 18 12 H45 V38 H18 Q8 36 2 25 Z" fill={PALETTE.hull} />
  ),
};

/** A bow or stern seen from the side, with the waterline. Decorative. */
export default function HullEndIcon({ kind, className }: HullEndIconProps) {
  const drawing =
    kind.end === "bow"
      ? BOW_DRAWINGS[kind.shape]()
      : STERN_DRAWINGS[kind.shape]();
  return (
    <svg
      data-testid="hull-end-icon"
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={`${className ?? ""} text-slate-600 dark:text-slate-300`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {drawing}
      <path d={`M3 ${DECK} H45`} stroke={PALETTE.deck} strokeWidth={2.5} />
      <path
        d={`M0 ${WATER} Q6 ${WATER - 3} 12 ${WATER} T24 ${WATER} T36 ${WATER} T48 ${WATER}`}
        stroke={PALETTE.gridTarget}
        strokeWidth={1.5}
      />
    </svg>
  );
}
