import type { ReactNode } from "react";
import { PALETTE } from "@/components/ship-builder/scene/palette";
import type { PartType } from "@/lib/ship-builder/model/types";

interface PartIconProps {
  type: PartType;
  className?: string;
}

const SHADE = "#000000";

interface BoxProps {
  /** Left edge of the front face. */
  x: number;
  /** Bottom edge of the front face. */
  bottom: number;
  width: number;
  height: number;
  fill: string;
  /** Painted across the front face (a window band). */
  band?: { fill: string; inset?: number };
}

/** A small oblique box: front face, top face and a shaded side face. */
function Box({ x, bottom, width, height, fill, band }: BoxProps) {
  const depth = 7;
  const top = bottom - height;
  const right = x + width;
  return (
    <g>
      <polygon
        points={`${x},${top} ${x + depth},${top - depth} ${right + depth},${top - depth} ${right},${top}`}
        fill={fill}
      />
      <rect x={x} y={top} width={width} height={height} fill={fill} />
      <polygon
        points={`${right},${top} ${right + depth},${top - depth} ${right + depth},${bottom - depth} ${right},${bottom}`}
        fill={fill}
      />
      <polygon
        points={`${right},${top} ${right + depth},${top - depth} ${right + depth},${bottom - depth} ${right},${bottom}`}
        fill={SHADE}
        fillOpacity={0.14}
      />
      {band && (
        <rect
          x={x + (band.inset ?? 3)}
          y={top + height * 0.28}
          width={width - 2 * (band.inset ?? 3)}
          height={height * 0.34}
          fill={band.fill}
          strokeWidth={1}
        />
      )}
    </g>
  );
}

interface LifeboatProps {
  length: number;
  depth: number;
  fill: string;
}

/** Side view of a lifeboat: curved hull, gunwale line and a few seats. */
function Lifeboat({ length, depth, fill }: LifeboatProps) {
  const left = 24 - length / 2;
  const right = 24 + length / 2;
  const top = 24 - depth / 2;
  const bottom = 24 + depth / 2;
  return (
    <g>
      <path
        d={`M${left} ${top} Q${left + length * 0.12} ${bottom} ${24} ${bottom} Q${right - length * 0.12} ${bottom} ${right} ${top} Z`}
        fill={fill}
      />
      <line
        x1={left + 3}
        y1={top + depth * 0.3}
        x2={right - 3}
        y2={top + depth * 0.3}
      />
    </g>
  );
}

interface MastProps {
  direction: "left" | "right";
}

/** A tall pole; the arrow shows which way the mast leans on the ship. */
function Mast({ direction }: MastProps) {
  const dx = direction === "left" ? -1 : 1;
  const tipX = 24 + dx * 14;
  return (
    <g>
      <rect x={22} y={4} width={4} height={34} fill={PALETTE.mast} />
      <line x1={17} y1={12} x2={31} y2={12} strokeWidth={2} />
      <line x1={24} y1={43} x2={tipX - dx * 5} y2={43} strokeWidth={2} />
      <polygon
        points={`${tipX},43 ${tipX - dx * 6},39.5 ${tipX - dx * 6},46.5`}
        fill="currentColor"
      />
    </g>
  );
}

const BLADE_ROTATIONS = [0, 120, 240] as const;

const DRAWINGS: Record<PartType, () => ReactNode> = {
  "deck-1x1": () => (
    <Box
      x={9}
      bottom={40}
      width={24}
      height={22}
      fill={PALETTE.superstructure}
    />
  ),
  "deck-2x1": () => (
    <Box
      x={3}
      bottom={38}
      width={34}
      height={20}
      fill={PALETTE.superstructure}
    />
  ),
  "cabin-1st": () => (
    <Box
      x={9}
      bottom={40}
      width={24}
      height={22}
      fill={PALETTE.superstructure}
      band={{ fill: PALETTE.cabin.first }}
    />
  ),
  "cabin-2nd": () => (
    <Box
      x={9}
      bottom={40}
      width={24}
      height={22}
      fill={PALETTE.superstructure}
      band={{ fill: PALETTE.cabin.second }}
    />
  ),
  "cabin-3rd": () => (
    <Box
      x={9}
      bottom={40}
      width={24}
      height={22}
      fill={PALETTE.superstructure}
      band={{ fill: PALETTE.cabin.third }}
    />
  ),
  bridge: () => (
    <Box
      x={3}
      bottom={34}
      width={34}
      height={14}
      fill={PALETTE.superstructure}
      band={{ fill: PALETTE.bridgeWindows, inset: 2 }}
    />
  ),
  funnel: () => (
    <g>
      <path d="M17 42 L19 14 H29 L31 42 Z" fill={PALETTE.funnel} />
      <rect x={18} y={8} width={12} height={7} fill={PALETTE.funnelTop} />
    </g>
  ),
  "funnel-large": () => (
    <g>
      <path d="M8 44 L11 12 H37 L40 44 Z" fill={PALETTE.funnel} />
      <rect x={9} y={4} width={30} height={9} fill={PALETTE.funnelTop} />
    </g>
  ),
  "mast-fore": () => <Mast direction="left" />,
  "mast-aft": () => <Mast direction="right" />,
  davit: () => (
    <g>
      <rect x={10} y={20} width={5} height={24} fill={PALETTE.davit} />
      <path
        d="M12.5 20 Q13 8 28 8 H38"
        fill="none"
        strokeWidth={4}
        stroke={PALETTE.davit}
      />
      <path d="M12.5 20 Q13 8 28 8 H38" fill="none" strokeWidth={1.5} />
      <line x1={36} y1={8} x2={36} y2={26} strokeWidth={1.5} />
      <circle cx={36} cy={29} r={3} fill="none" />
    </g>
  ),
  "lifeboat-standard": () => (
    <Lifeboat length={36} depth={18} fill={PALETTE.lifeboat} />
  ),
  "lifeboat-collapsible": () => (
    <Lifeboat length={36} depth={10} fill={PALETTE.collapsible} />
  ),
  "lifeboat-large": () => (
    <Lifeboat length={44} depth={20} fill={PALETTE.lifeboat} />
  ),
  propeller: () => (
    <g>
      {BLADE_ROTATIONS.map((angle) => (
        <path
          key={angle}
          d="M24 24 C19 20 19 8 24 5 C29 8 29 20 24 24 Z"
          fill={PALETTE.collapsible}
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
      <circle cx={24} cy={24} r={4} fill={PALETTE.davit} />
    </g>
  ),
};

/** A flat drawing of a part, matching its 3D look. Decorative: aria-hidden. */
export default function PartIcon({ type, className }: PartIconProps) {
  return (
    <svg
      data-testid="part-icon"
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={`${className ?? ""} text-slate-600 dark:text-slate-300`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {DRAWINGS[type]()}
    </svg>
  );
}
