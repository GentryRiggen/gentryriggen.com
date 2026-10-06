import type { ReactNode } from "react";

/** Icons are drawn on a 48x48 grid. */
export const CREW_ICONS = {
  plank: () => (
    <g>
      <path d="M6 22 L42 30 L42 35 L6 27 Z" fill="#c9a56b" />
      <path d="M6 27 L42 35" stroke="#5a3a22" strokeWidth={1.5} />
      <path
        d="M10 22 V13 M20 24 V15 M10 14 H20"
        stroke="#5a3a22"
        strokeWidth={2}
      />
      <path
        d="M2 40 Q8 37 14 40 T26 40 T38 40 T46 40"
        stroke="#2f7fc1"
        strokeWidth={2}
        fill="none"
      />
    </g>
  ),
  "pirate-crew": () => (
    <g>
      <path d="M13 14 L24 5 L35 14 Z" fill="#1c1c1f" />
      <path
        d="M9 15 H39"
        stroke="#1c1c1f"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={24} cy={21} r={6} fill="#e4b88a" />
      <rect x={16} y={27} width={16} height={16} rx={7} fill="#7a1f1f" />
      <path
        d="M37 24 L41 44"
        stroke="#c0c6cc"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  ),
  parrot: () => (
    <g>
      <path
        d="M10 38 H38"
        stroke="#5a3a22"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M17 36 L11 45 L20 42 Z" fill="#3f9a4a" />
      <ellipse cx={22} cy={27} rx={8} ry={11} fill="#c8312b" />
      <ellipse cx={19} cy={28} rx={4} ry={7} fill="#2f7fc1" />
      <circle cx={26} cy={14} r={6} fill="#c8312b" />
      <path d="M31 12 L38 15 L31 18 Z" fill="#f2c230" />
      <circle cx={27} cy={13} r={1.2} fill="#1c1c1f" />
    </g>
  ),
} satisfies Record<string, () => ReactNode>;
