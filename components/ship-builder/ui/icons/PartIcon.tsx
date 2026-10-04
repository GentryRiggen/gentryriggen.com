import type { ReactNode } from "react";
import { PALETTE } from "@/components/ship-builder/scene/palette";
import { paintHex } from "@/lib/ship-builder/model/paint";
import { CRUISE_COLORS } from "@/components/ship-builder/scene/cruiseColors";
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

/** A tall pole with a cross-tree. */
function Mast() {
  return (
    <g>
      <rect x={22} y={4} width={4} height={40} fill={PALETTE.mast} />
      <line x1={15} y1={12} x2={33} y2={12} strokeWidth={2} />
    </g>
  );
}

interface BridgeIconProps {
  /** Footprint width in cells; the drawn box grows 3.5 units per cell. */
  width: number;
}

/** One bridge drawing for every size, centred in the 48-unit viewBox. */
function BridgeIcon({ width }: BridgeIconProps) {
  const drawnWidth = 26 + 3.5 * (width - 3);
  const depth = 7;
  return (
    <Box
      x={(48 - depth - drawnWidth) / 2}
      bottom={38}
      width={drawnWidth}
      height={14}
      fill={PALETTE.superstructure}
      band={{ fill: PALETTE.bridgeWindows, inset: 2 }}
    />
  );
}

const NAVAL_GREY = "#8a949c";
const NAVAL_DARK = "#4b545b";
const NAVAL_DECK = "#5d666d";
const NAVAL_HELI = "#6f7b66";
const NAVAL_TUBE = "#69727a";

interface TurretIconProps {
  /** Grows the whole drawing about its centre. */
  scale: number;
}

/** Side view of a gun turret: a round base, a housing and a barrel. */
function TurretIcon({ scale }: TurretIconProps) {
  return (
    <g transform={`translate(24 24) scale(${scale}) translate(-24 -24)`}>
      <rect x={10} y={32} width={26} height={6} fill={NAVAL_DARK} />
      <path d="M13 32 L16 20 H32 L35 32 Z" fill={NAVAL_GREY} />
      <rect x={32} y={23} width={13} height={3.5} fill={NAVAL_DARK} />
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
  "cabin-crew": () => (
    <Box
      x={9}
      bottom={40}
      width={24}
      height={22}
      fill={PALETTE.superstructure}
      band={{ fill: PALETTE.cabin.crew }}
    />
  ),
  "bridge-3": () => <BridgeIcon width={3} />,
  bridge: () => <BridgeIcon width={4} />,
  "bridge-5": () => <BridgeIcon width={5} />,
  "bridge-6": () => <BridgeIcon width={6} />,
  "bridge-7": () => <BridgeIcon width={7} />,
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
  mast: () => <Mast />,
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
  // A rudder blade hanging from its stock, seen from the side.
  rudder: () => (
    <g>
      <rect x={21} y={5} width={6} height={9} fill={PALETTE.davit} />
      <path d="M16 14 H32 L30 42 Q24 45 18 42 Z" fill={PALETTE.propeller} />
    </g>
  ),
  "turret-small": () => <TurretIcon scale={1} />,
  "turret-large": () => <TurretIcon scale={1.35} />,
  "radar-mast": () => (
    <g>
      <rect x={22.5} y={14} width={3} height={30} fill={NAVAL_GREY} />
      <line x1={18} y1={34} x2={30} y2={34} strokeWidth={2} />
      <line x1={19} y1={26} x2={29} y2={26} strokeWidth={2} />
      <rect x={22} y={10} width={4} height={4} fill={NAVAL_DARK} />
      <path d="M10 8 Q24 -1 38 8" fill="none" strokeWidth={3} />
    </g>
  ),
  helipad: () => (
    <g>
      <path d="M6 32 L24 24 L42 32 L24 42 Z" fill={NAVAL_DECK} />
      <path
        d="M17 31 V37 M25 28 V34 M17 34 L25 31"
        stroke={PALETTE.superstructure}
        strokeWidth={2}
      />
    </g>
  ),
  helicopter: () => (
    <g>
      <line x1={6} y1={13} x2={42} y2={13} strokeWidth={2.5} />
      <line x1={24} y1={13} x2={24} y2={18} />
      <ellipse cx={22} cy={25} rx={11} ry={7} fill={NAVAL_HELI} />
      <path d="M32 23 L44 20 V24 L32 27 Z" fill={NAVAL_HELI} />
      <line x1={10} y1={37} x2={34} y2={37} strokeWidth={2} />
      <path d="M15 31 V37 M29 31 V37" />
    </g>
  ),
  "rib-boat": () => (
    <g>
      <ellipse cx={24} cy={26} rx={20} ry={10} fill={NAVAL_TUBE} />
      <ellipse cx={24} cy={26} rx={13} ry={5} fill={NAVAL_DARK} />
    </g>
  ),
  // A corrugated box: vertical ribs down the front.
  container: () => (
    <g>
      <Box x={4} bottom={36} width={32} height={20} fill={paintHex("sky")} />
      {[10, 15, 20, 25, 30].map((x) => (
        <line key={x} x1={x} y1={19} x2={x} y2={35} strokeWidth={1} />
      ))}
    </g>
  ),
  // A low slab on a raised rim.
  "hatch-cover": () => (
    <g>
      <Box
        x={6}
        bottom={36}
        width={30}
        height={6}
        fill={PALETTE.hatchCoaming}
      />
      <Box x={4} bottom={30} width={34} height={4} fill={PALETTE.hatchCover} />
    </g>
  ),
  // A pedestal with a jib leaning out over a hook.
  "cargo-crane": () => (
    <g>
      <rect x={10} y={26} width={10} height={16} fill={PALETTE.crane} />
      <rect x={7} y={40} width={16} height={4} fill={PALETTE.hatchCover} />
      <path d="M15 28 L40 10 L42 13 L18 30 Z" fill={PALETTE.crane} />
      <line x1={38} y1={12} x2={38} y2={28} strokeWidth={1.5} />
      <rect x={35} y={28} width={6} height={4} fill={PALETTE.hatchCover} />
    </g>
  ),
  // An enclosed boat on a ramp tilted down toward the stern (right).
  "lifeboat-freefall": () => (
    <g>
      <path d="M4 20 L44 36 L44 40 L4 24 Z" fill={PALETTE.freefallRamp} />
      <path
        d="M8 11 Q18 6 28 14 L36 24 L34 28 L12 20 Q7 16 8 11 Z"
        fill={PALETTE.freefallBoat}
        transform="translate(0 -1)"
      />
      <circle cx={19} cy={14} r={2} fill={PALETTE.bridgeWindows} />
    </g>
  ),
  "cabin-balcony": () => (
    <g>
      <Box
        x={9}
        bottom={38}
        width={24}
        height={20}
        fill={PALETTE.superstructure}
        band={{ fill: PALETTE.cabin.second }}
      />
      <rect
        x={7}
        y={34}
        width={28}
        height={4}
        fill={CRUISE_COLORS.balconyRail}
      />
    </g>
  ),
  pool: () => (
    <g>
      <path d="M6 28 L24 18 L42 28 L24 40 Z" fill={CRUISE_COLORS.poolRim} />
      <path
        d="M11 28 L24 21.5 L37 28 L24 36 Z"
        fill={CRUISE_COLORS.poolWater}
      />
    </g>
  ),
  waterslide: () => (
    <g>
      <rect
        x={21}
        y={5}
        width={5}
        height={38}
        fill={CRUISE_COLORS.slideTower}
      />
      <path
        d="M24 8 C40 12 40 18 24 21 C8 24 8 30 24 33 C36 35 38 39 30 43"
        fill="none"
        strokeWidth={4}
        stroke={CRUISE_COLORS.slideTube}
      />
    </g>
  ),
  "climbing-wall": () => (
    <g>
      <rect x={12} y={5} width={24} height={38} fill={CRUISE_COLORS.wall} />
      {CRUISE_COLORS.holds.flatMap((fill, i) => [
        <circle
          key={`a${i}`}
          cx={19 + (i % 2) * 10}
          cy={12 + i * 8}
          r={2.5}
          fill={fill}
        />,
        <circle
          key={`b${i}`}
          cx={24 + (i % 2) * -8}
          cy={16 + i * 8}
          r={2.5}
          fill={fill}
        />,
      ])}
    </g>
  ),
  "lifeboat-enclosed": () => (
    <g>
      <path
        d="M5 26 Q5 15 24 15 Q43 15 43 26 Q43 34 24 34 Q5 34 5 26 Z"
        fill={CRUISE_COLORS.enclosedBoat}
      />
      <rect
        x={12}
        y={21}
        width={24}
        height={5}
        fill={CRUISE_COLORS.enclosedWindow}
      />
    </g>
  ),
  "raft-canister": () => (
    <g>
      <rect
        x={6}
        y={17}
        width={36}
        height={14}
        rx={7}
        fill={CRUISE_COLORS.raft}
      />
      <rect x={14} y={17} width={4} height={14} fill={CRUISE_COLORS.raftBand} />
      <rect x={30} y={17} width={4} height={14} fill={CRUISE_COLORS.raftBand} />
    </g>
  ),
  "funnel-modern": () => (
    <path
      d="M16 43 L19 7 Q24 5 29 7 L33 43 Z"
      fill={CRUISE_COLORS.modernFunnel}
    />
  ),
  azipod: () => (
    <g>
      <rect x={21} y={5} width={8} height={16} fill={CRUISE_COLORS.azipod} />
      <rect
        x={10}
        y={20}
        width={30}
        height={12}
        rx={6}
        fill={CRUISE_COLORS.azipod}
      />
      <rect
        x={5}
        y={14}
        width={5}
        height={24}
        rx={2}
        fill={CRUISE_COLORS.azipodBlade}
      />
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
