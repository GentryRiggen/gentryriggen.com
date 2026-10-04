import type { ReactNode } from "react";
import type { ShipKind } from "@/lib/ship-builder/model/kinds";

interface ShipKindIconProps {
  kind: ShipKind;
  className?: string;
}

const OUTLINE = "#334155";
const WATER = "#3b82c4";
const WINDOW = "#5f86a8";
const CONTAINER_COLORS = ["#c8312b", "#2f7fc1", "#e8a82e", "#3c8d4a"];

/** Water line under every ship, drawn last so it overlaps the keel. */
const WATER_STRIP = (
  <path
    d="M2 52 Q9 49 16 52 T30 52 T44 52 T58 52 T72 52 T86 52 T98 52 V60 H2 Z"
    fill={WATER}
    stroke="none"
  />
);

/**
 * Side views on a 100 × 60 canvas, bows pointing right. Each kind has its own
 * silhouette: funnels, stacked decks, a gun turret or containers.
 */
const DRAWINGS: Record<ShipKind, () => ReactNode> = {
  // Four funnels on a long, low black hull with a red waterline stripe.
  liner: () => (
    <g>
      {[30, 42, 54, 66].map((x) => (
        <g key={x}>
          <rect x={x - 3.5} y={14} width={7} height={22} fill="#d39b45" />
          <rect x={x - 3.5} y={14} width={7} height={4} fill="#141414" />
        </g>
      ))}
      <rect x={20} y={30} width={62} height={9} fill="#f3efe4" />
      <path d="M4 38 H92 L82 52 H12 Q6 46 4 38 Z" fill="#15171a" />
      <path d="M12 52 H82 L80 48 H9 Z" fill="#8e2a22" stroke="none" />
      {WATER_STRIP}
    </g>
  ),
  // A tall block-stacked white superstructure with rows of windows.
  cruise: () => (
    <g>
      <rect x={22} y={9} width={34} height={7} fill="#ffffff" />
      <rect x={16} y={16} width={52} height={7} fill="#ffffff" />
      <rect x={12} y={23} width={62} height={7} fill="#ffffff" />
      <rect x={10} y={30} width={70} height={8} fill="#ffffff" />
      {[12, 19, 26, 34].map((y, row) => (
        <path
          key={y}
          d={`M${[26, 20, 16, 14][row]} ${y} H${[52, 64, 70, 76][row]}`}
          stroke={WINDOW}
          strokeWidth={2}
          strokeDasharray="2.5 2"
        />
      ))}
      <path d="M4 38 H92 L82 52 H12 Q6 46 4 38 Z" fill="#ffffff" />
      <path d="M12 52 H82 L84 47 H8 Z" fill="#1f3a6b" stroke="none" />
      {WATER_STRIP}
    </g>
  ),
  // A low grey angular hull, a slanted bridge, a turret with a gun, a radar.
  navy: () => (
    <g>
      <path d="M44 28 L50 14 H60 L66 28 Z" fill="#9aa1ab" />
      <line x1={55} y1={14} x2={55} y2={5} />
      <line x1={50} y1={8} x2={60} y2={8} />
      <path d="M20 38 L26 28 H44 L48 38 Z" fill="#9aa1ab" />
      <path d="M72 38 L74 32 H82 L84 38 Z" fill="#8a909a" />
      <path d="M68 30 A6 6 0 0 1 80 30 Z" fill="#7b818b" />
      <line x1={78} y1={27} x2={92} y2={25} strokeWidth={2.5} />
      <path d="M2 38 H96 L86 52 H14 Z" fill="#8a8f98" />
      {WATER_STRIP}
    </g>
  ),
  // Stacks of coloured containers, with the bridge tower at the back.
  cargo: () => (
    <g>
      <rect x={10} y={10} width={14} height={28} fill="#ffffff" />
      <rect x={8} y={8} width={18} height={5} fill="#ffffff" />
      <path d="M12 12 H22" stroke={WINDOW} strokeWidth={2} />
      <path d="M12 18 H22" stroke={WINDOW} strokeWidth={2} />
      {[0, 1, 2, 3, 4].map((col) =>
        Array.from({ length: col % 2 === 0 ? 3 : 2 }, (_, row) => (
          <rect
            key={`${col}-${row}`}
            x={28 + col * 12}
            y={32 - row * 7}
            width={11}
            height={6.5}
            fill={CONTAINER_COLORS[(col + row) % CONTAINER_COLORS.length]}
            strokeWidth={0.8}
          />
        ))
      )}
      <path d="M4 38 H94 L86 52 H10 Q5 46 4 38 Z" fill="#1f3a6b" />
      <path d="M10 52 H86 L88 47 H7 Z" fill="#c8312b" stroke="none" />
      {WATER_STRIP}
    </g>
  ),
};

/** A side-view picture of a ship kind; the figure carries no text. */
export default function ShipKindIcon({ kind, className }: ShipKindIconProps) {
  return (
    <svg
      data-testid="ship-kind-icon"
      data-kind={kind}
      aria-hidden="true"
      viewBox="0 0 100 60"
      fill="none"
      stroke={OUTLINE}
      strokeWidth={1.2}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
    >
      {DRAWINGS[kind]()}
    </svg>
  );
}
