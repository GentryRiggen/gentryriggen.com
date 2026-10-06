import type { ReactNode } from "react";

const OAK = "#9a6b3f";
const DARK = "#5a3a22";
const CANVAS = "#efe6cf";
const BLACK = "#1c1c1f";
const BONE = "#f1ede0";

function mast(top: number) {
  return function MastIcon(): ReactNode {
    return (
      <g>
        <path
          d={`M22.5 ${top} H25.5 L27 42 H21 Z`}
          fill={OAK}
          stroke={DARK}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <circle cx={24} cy={top - 1} r={2.2} fill={DARK} />
        <rect x={16} y={42} width={16} height={2.5} rx={1} fill={DARK} />
      </g>
    );
  };
}

function squareSail(width: number, height: number) {
  return function SquareSailIcon(): ReactNode {
    const left = 24 - width / 2;
    const top = 8;
    return (
      <g>
        <path
          d={`M${left} ${top + 3} H${left + width} L${left + width - 2} ${top + 3 + height} Q24 ${top + height + 6} ${left + 2} ${top + 3 + height} Z`}
          fill={CANVAS}
          stroke={DARK}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <rect
          x={left - 3}
          y={top + 1}
          width={width + 6}
          height={3}
          rx={1.2}
          fill={OAK}
          stroke={DARK}
          strokeWidth={1}
        />
      </g>
    );
  };
}

function SailJibIcon(): ReactNode {
  return (
    <g>
      <path
        d="M10 40 L12 8 L38 40 Z"
        fill={CANVAS}
        stroke={DARK}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path d="M12 8 V40" stroke={OAK} strokeWidth={2.4} />
    </g>
  );
}

function SailLateenIcon(): ReactNode {
  return (
    <g>
      <path
        d="M8 34 L36 8 L40 34 Z"
        fill={CANVAS}
        stroke={DARK}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path
        d="M6 36 L37 7"
        stroke={OAK}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path d="M8 40 H40" stroke={DARK} strokeWidth={1.2} />
    </g>
  );
}

function FlagIcon(): ReactNode {
  return (
    <g>
      <path
        d="M13 6 V43"
        stroke={DARK}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path
        d="M14 9 Q24 6 34 10 Q38 12 42 12 V28 Q38 28 34 26 Q24 22 14 25 Z"
        fill={BLACK}
        stroke={BLACK}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <circle cx={26} cy={16} r={3.6} fill={BONE} />
      <path d="M22 22 L30 21 M22 21 L30 22" stroke={BONE} strokeWidth={1.2} />
    </g>
  );
}

export const SAIL_ICONS = {
  "mast-wood-short": mast(22),
  "mast-wood-tall": mast(14),
  "mast-wood-main": mast(6),
  "sail-square-small": squareSail(14, 14),
  "sail-square": squareSail(20, 20),
  "sail-square-large": squareSail(26, 24),
  "sail-jib": SailJibIcon,
  "sail-lateen": SailLateenIcon,
  "flag-jolly-roger": FlagIcon,
} satisfies Record<string, () => ReactNode>;
