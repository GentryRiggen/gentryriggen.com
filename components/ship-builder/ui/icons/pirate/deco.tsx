import type { ReactNode } from "react";

const OAK = "#9a6b3f";
const DARK = "#5a3a22";
const PALE = "#c9a56b";
const IRON = "#33383d";
const GOLD = "#e8b923";
const GLASS = "#1d2a33";

/** A stern cabin: oak block, pale window frames and a dark roof band. */
function CabinCaptainIcon(): ReactNode {
  return (
    <g data-icon="cabin-captain">
      <rect x={8} y={14} width={32} height={26} fill={OAK} />
      <rect x={6} y={10} width={36} height={5} fill={DARK} />
      {[12, 26].map((x) => (
        <g key={x}>
          <rect x={x} y={20} width={10} height={12} fill={PALE} />
          <rect x={x + 1.5} y={21.5} width={7} height={9} fill={GLASS} />
        </g>
      ))}
    </g>
  );
}

function HelmWheelIcon(): ReactNode {
  return (
    <g data-icon="helm-wheel">
      <rect x={20} y={32} width={8} height={10} fill={DARK} />
      <circle cx={24} cy={22} r={13} fill="none" stroke={OAK} strokeWidth={3} />
      <path
        d="M24 6 V38 M8 22 H40 M12.7 10.7 L35.3 33.3 M35.3 10.7 L12.7 33.3"
        stroke={PALE}
        strokeWidth={2}
      />
      <circle cx={24} cy={22} r={3.5} fill={GOLD} />
    </g>
  );
}

function FigureheadIcon(): ReactNode {
  return (
    <g data-icon="figurehead">
      <path d="M10 42 L18 24 L26 26 L16 44 Z" fill={DARK} />
      <path
        d="M18 26 C24 18 30 14 36 12 L38 18 C32 22 28 28 26 32 Z"
        fill={PALE}
      />
      <circle cx={38} cy={12} r={5} fill={PALE} />
      <path d="M33 10 C34 4 42 4 43 11 C40 8 36 8 33 10 Z" fill={DARK} />
      <path d="M26 24 L16 20 L18 17 L28 20 Z" fill={PALE} />
    </g>
  );
}

function ShipAnchorIcon(): ReactNode {
  return (
    <g data-icon="ship-anchor" stroke={IRON} strokeWidth={3} fill="none">
      <circle cx={24} cy={9} r={3.5} />
      <path d="M24 13 V38 M15 19 H33" />
      <path d="M8 28 C9 38 17 42 24 42 C31 42 39 38 40 28" />
      <path d="M8 28 L5 33 M40 28 L43 33" strokeLinecap="round" />
    </g>
  );
}

function Barrel({ cx, cy }: { cx: number; cy: number }): ReactNode {
  return (
    <g>
      <rect x={cx - 8} y={cy - 9} width={16} height={18} rx={4} fill={OAK} />
      <path
        d={`M${cx - 8} ${cy - 3} H${cx + 8} M${cx - 8} ${cy + 3} H${cx + 8}`}
        stroke={IRON}
        strokeWidth={1.8}
      />
    </g>
  );
}

function BarrelStackIcon(): ReactNode {
  return (
    <g data-icon="barrel-stack">
      <Barrel cx={15} cy={34} />
      <Barrel cx={33} cy={34} />
      <Barrel cx={24} cy={17} />
    </g>
  );
}

function Crate({ x, y }: { x: number; y: number }): ReactNode {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={16}
        height={16}
        fill={OAK}
        stroke={DARK}
        strokeWidth={2}
      />
      <path
        d={`M${x} ${y} L${x + 16} ${y + 16} M${x + 16} ${y} L${x} ${y + 16}`}
        stroke={DARK}
        strokeWidth={1.5}
      />
    </g>
  );
}

function CrateStackIcon(): ReactNode {
  return (
    <g data-icon="crate-stack">
      <Crate x={8} y={24} />
      <Crate x={26} y={24} />
      <Crate x={17} y={8} />
    </g>
  );
}

function TreasureChestIcon(): ReactNode {
  return (
    <g data-icon="treasure-chest">
      <rect x={8} y={26} width={32} height={14} fill={DARK} />
      <path d="M8 26 V20 C8 8 40 8 40 20 V26 Z" fill={OAK} />
      <path d="M8 26 H40" stroke={GOLD} strokeWidth={3} />
      <rect x={13} y={14} width={3} height={26} fill={GOLD} />
      <rect x={32} y={14} width={3} height={26} fill={GOLD} />
      <rect x={21} y={23} width={6} height={8} rx={1} fill={GOLD} />
    </g>
  );
}

function RowboatIcon(): ReactNode {
  return (
    <g data-icon="rowboat">
      <path d="M4 26 H44 C42 36 34 40 24 40 C14 40 6 36 4 26 Z" fill={OAK} />
      <rect x={3} y={24} width={42} height={3} fill={DARK} />
      <rect x={15} y={29} width={4} height={2} fill={PALE} />
      <rect x={29} y={29} width={4} height={2} fill={PALE} />
      <path d="M12 10 L30 32 M36 10 L18 32" stroke={PALE} strokeWidth={2} />
    </g>
  );
}

export const DECO_ICONS = {
  "cabin-captain": CabinCaptainIcon,
  "helm-wheel": HelmWheelIcon,
  figurehead: FigureheadIcon,
  "ship-anchor": ShipAnchorIcon,
  "barrel-stack": BarrelStackIcon,
  "crate-stack": CrateStackIcon,
  "treasure-chest": TreasureChestIcon,
  rowboat: RowboatIcon,
} satisfies Record<string, () => ReactNode>;
