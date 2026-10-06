import type { ReactNode } from "react";

const IRON = "#33383d";
const DARK = "#5a3a22";
const OAK = "#9a6b3f";

/** A wheeled deck cannon in profile, muzzle to the right. */
function DeckCannonIcon() {
  return (
    <g>
      <path d="M12 26 L38 21 L39 28 L12 32 Z" fill={IRON} />
      <rect x={37} y={20} width={4} height={9} rx={1} fill="#1c1c1f" />
      <circle cx={12} cy={29} r={3} fill={IRON} />
      <rect x={10} y={32} width={22} height={5} rx={1} fill={DARK} />
      <circle
        cx={16}
        cy={39}
        r={5}
        fill={OAK}
        stroke={DARK}
        strokeWidth={1.5}
      />
      <circle cx={16} cy={39} r={1.5} fill={DARK} />
      <circle
        cx={30}
        cy={39}
        r={5}
        fill={OAK}
        stroke={DARK}
        strokeWidth={1.5}
      />
      <circle cx={30} cy={39} r={1.5} fill={DARK} />
    </g>
  );
}

/** A long bow chaser: slim barrel on a low wooden bed. */
function ChaserCannonIcon() {
  return (
    <g>
      <path d="M5 24 L40 21 L40 26 L5 29 Z" fill={IRON} />
      <rect x={39} y={19.5} width={5} height={8} rx={1} fill="#1c1c1f" />
      <circle cx={6} cy={26.5} r={3} fill={IRON} />
      <path d="M8 31 H36 V37 H12 Z" fill={DARK} />
      <path d="M8 31 L4 36 H12 Z" fill={OAK} />
    </g>
  );
}

/** A small swivel gun on a post, with a yoke at the top. */
function SwivelCannonIcon() {
  return (
    <g>
      <path d="M22 28 H26 L28 42 H20 Z" fill={DARK} />
      <rect x={16} y={41} width={16} height={3} rx={1} fill={OAK} />
      <path d="M17 19 L33 17 L33 23 L17 25 Z" fill={IRON} />
      <rect x={32} y={16} width={3} height={8} rx={1} fill="#1c1c1f" />
      <circle cx={17} cy={22} r={2.5} fill={IRON} />
      <circle
        cx={24}
        cy={27}
        r={4}
        fill={IRON}
        stroke="#1c1c1f"
        strokeWidth={1}
      />
      <path d="M21 21 V26 M27 20 V26" stroke="#1c1c1f" strokeWidth={1.5} />
    </g>
  );
}

export const CANNON_ICONS = {
  "cannon-deck": DeckCannonIcon,
  "cannon-chaser": ChaserCannonIcon,
  "cannon-swivel": SwivelCannonIcon,
} satisfies Record<string, () => ReactNode>;
