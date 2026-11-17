import type { DecorId } from "@/lib/flamelings/catalog";

/**
 * The glade decor, drawn in the glade's 800x600 box. Each piece has a fixed
 * anchor spot (so nothing ever overlaps another piece) and a layer: the rug
 * under the hearth, "back" pieces behind it, "front" pieces beside it and
 * "hang" pieces above the scene (they glow after dark).
 */
export type DecorLayer = "rug" | "back" | "front" | "hang";

interface DecorSpec {
  layer: DecorLayer;
  /** Where the piece stands (its bottom centre); hanging pieces are absolute. */
  x: number;
  y: number;
  /** viewBox of the piece alone, for the shop picture. */
  box: string;
}

const FLOOR = 524;

export const DECOR_SPECS: Record<DecorId, DecorSpec> = {
  rug: { layer: "rug", x: 400, y: 500, box: "-200 -46 400 92" },
  tent: { layer: "back", x: 262, y: 462, box: "-56 -92 112 96" },
  mushroomHouse: { layer: "back", x: 548, y: 456, box: "-54 -112 108 116" },
  banner: { layer: "back", x: 0, y: 0, box: "200 316 400 74" },
  plant: { layer: "front", x: 238, y: FLOOR, box: "-30 -78 60 82" },
  snowman: { layer: "front", x: 284, y: FLOOR, box: "-22 -72 44 76" },
  bed: { layer: "front", x: 336, y: FLOOR + 6, box: "-42 -30 84 40" },
  toyBox: { layer: "front", x: 470, y: FLOOR, box: "-30 -56 60 60" },
  crystals: { layer: "front", x: 540, y: FLOOR, box: "-38 -64 76 68" },
  fairyLights: { layer: "hang", x: 0, y: 0, box: "250 195 300 90" },
  lanterns: { layer: "hang", x: 0, y: 0, box: "520 134 150 130" },
};

const BULB_COLOURS = ["#ff7ab6", "#ffd84a", "#4ad0ff", "#a8f04a", "#ff9b5a"];

/** Points on a quadratic curve, for bulbs and pennants strung along it. */
function along(
  p0: [number, number],
  c: [number, number],
  p2: [number, number],
  count: number
): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1],
    ];
  });
}

const LIGHTS_LEFT = along([-10, 190], [200, 290], [400, 215], 9);
const LIGHTS_RIGHT = along([400, 215], [600, 290], [810, 190], 9);
const PENNANTS = along([200, 320], [400, 400], [600, 320], 11);
const PENNANT_COLOURS = ["#e5484d", "#ffd84a", "#3aa0ff", "#8ee05a", "#ff7ab6"];

function Lantern({ x, y, glow }: { x: number; y: number; glow: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 -50 L0 -2" stroke="#2c2c34" strokeWidth="2.4" />
      <circle cy="26" r="46" fill="url(#fl-lantern-glow)" opacity={glow} />
      <rect
        x="-9"
        y="0"
        width="18"
        height="30"
        rx="5"
        fill="#ffcf6e"
        stroke="#2c2c34"
        strokeWidth="3"
      />
      <rect x="-13" y="-4" width="26" height="7" rx="2" fill="#2c2c34" />
      <rect x="-13" y="28" width="26" height="6" rx="2" fill="#2c2c34" />
      <rect x="-3" y="8" width="6" height="16" rx="3" fill="#fff3b8" />
    </g>
  );
}

/** One piece of decor, drawn where it stands. `glow` is 0 (day) to 1 (night). */
export function DecorPiece({ id, glow }: { id: DecorId; glow: number }) {
  switch (id) {
    case "rug":
      return (
        <g>
          <ellipse rx="192" ry="40" fill="#b8443f" />
          <ellipse
            rx="170"
            ry="34"
            fill="none"
            stroke="#f4d58a"
            strokeWidth="4"
            strokeDasharray="14 9"
          />
          <ellipse rx="140" ry="27" fill="#d9654f" />
          <ellipse
            rx="110"
            ry="21"
            fill="none"
            stroke="#f4d58a"
            strokeWidth="3"
          />
        </g>
      );
    case "tent":
      return (
        <g>
          <path
            d="M-52 0 L0 -74 L52 0 Z"
            fill="#e8a43a"
            stroke="#a8701a"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M0 -74 L-17 0 L17 0 Z" fill="#3a2a22" />
          <path
            d="M-28 -34 L-9 -40 M28 -34 L9 -40"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M0 -74 L0 -90" stroke="#6a4a2a" strokeWidth="3" />
          <path d="M0 -90 L16 -85 L0 -80 Z" fill="#e5484d" />
        </g>
      );
    case "mushroomHouse":
      return (
        <g>
          <rect
            x="-17"
            y="-44"
            width="34"
            height="44"
            rx="9"
            fill="#f6ead2"
            stroke="#d6c4a0"
            strokeWidth="2"
          />
          <rect x="-7" y="-24" width="14" height="24" rx="7" fill="#7a4a24" />
          <circle
            cx="11"
            cy="-32"
            r="4.4"
            fill="#ffd84a"
            stroke="#b9892a"
            strokeWidth="1.4"
          />
          <path
            d="M-52 -38 Q0 -118 52 -38 Q0 -30 -52 -38 Z"
            fill="#e5484d"
            stroke="#b0282d"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="-22" cy="-62" r="6" fill="#fff" />
          <circle cx="8" cy="-82" r="5" fill="#fff" />
          <circle cx="26" cy="-56" r="4.6" fill="#fff" />
        </g>
      );
    case "banner":
      return (
        <g>
          <path
            d="M200 320 Q400 400 600 320"
            stroke="#5a3b24"
            strokeWidth="3"
            fill="none"
          />
          {PENNANTS.map(([x, y], i) => (
            <path
              key={i}
              d={`M${x - 11} ${y} L${x + 11} ${y} L${x} ${y + 26} Z`}
              fill={PENNANT_COLOURS[i % PENNANT_COLOURS.length]}
              stroke="#0000002a"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          ))}
        </g>
      );
    case "plant":
      return (
        <g>
          <path d="M0 -26 Q-20 -40 -24 -66 Q-4 -56 0 -26 Z" fill="#2f9e4a" />
          <path d="M0 -26 Q20 -42 26 -64 Q4 -56 0 -26 Z" fill="#3fb85a" />
          <path d="M0 -26 Q-4 -50 0 -74 Q6 -50 0 -26 Z" fill="#26833e" />
          <path
            d="M-15 -24 L15 -24 L11 0 L-11 0 Z"
            fill="#c8683c"
            stroke="#9a4a26"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect
            x="-17"
            y="-28"
            width="34"
            height="7"
            rx="3.5"
            fill="#d9784a"
            stroke="#9a4a26"
            strokeWidth="1.4"
          />
        </g>
      );
    case "snowman":
      return (
        <g>
          <circle
            cy="-14"
            r="15"
            fill="#fff"
            stroke="#cfd9e6"
            strokeWidth="1.6"
          />
          <circle
            cy="-38"
            r="11"
            fill="#fff"
            stroke="#cfd9e6"
            strokeWidth="1.6"
          />
          <circle
            cy="-56"
            r="8.5"
            fill="#fff"
            stroke="#cfd9e6"
            strokeWidth="1.6"
          />
          <path d="M0 -56 L9 -54 L0 -52 Z" fill="#ff8a2a" />
          <circle cx="-3" cy="-59" r="1.2" fill="#25252f" />
          <circle cx="3" cy="-59" r="1.2" fill="#25252f" />
          <path
            d="M-9 -47 Q0 -42 9 -47"
            stroke="#e5484d"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <circle cy="-36" r="1.5" fill="#25252f" />
          <circle cy="-28" r="1.5" fill="#25252f" />
        </g>
      );
    case "bed":
      return (
        <g>
          <ellipse
            cy="-2"
            rx="40"
            ry="12"
            fill="#b9774a"
            stroke="#8a5028"
            strokeWidth="1.6"
          />
          <ellipse
            cy="-9"
            rx="40"
            ry="13"
            fill="#e4a06a"
            stroke="#b9774a"
            strokeWidth="1.6"
          />
          <ellipse cy="-10" rx="29" ry="8" fill="#ff8fb3" />
          <circle cx="-14" cy="-12" r="1.8" fill="#fff" fillOpacity="0.7" />
          <circle cx="10" cy="-8" r="1.8" fill="#fff" fillOpacity="0.7" />
        </g>
      );
    case "toyBox":
      return (
        <g>
          <rect
            x="-8"
            y="-52"
            width="10"
            height="10"
            rx="2"
            fill="#e5484d"
            transform="rotate(-14 -3 -47)"
          />
          <circle
            cx="12"
            cy="-47"
            r="7"
            fill="#ffd84a"
            stroke="#c9a02a"
            strokeWidth="1.2"
          />
          <rect
            x="-26"
            y="-38"
            width="52"
            height="38"
            rx="5"
            fill="#4a90e2"
            stroke="#2d6bb5"
            strokeWidth="2"
          />
          <rect
            x="-29"
            y="-44"
            width="58"
            height="11"
            rx="5"
            fill="#6aa8f0"
            stroke="#2d6bb5"
            strokeWidth="2"
          />
          <path
            d="M-10 -18 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1z"
            fill="#ffd84a"
            transform="translate(8 -4) scale(.8)"
          />
        </g>
      );
    case "crystals":
      return (
        <g>
          <ellipse
            cy="-26"
            rx="46"
            ry="38"
            fill="#7be0ff"
            opacity={0.12 + glow * 0.32}
          />
          <path
            d="M-22 0 L-28 -26 L-16 -50 L-8 -26 L-6 0 Z"
            fill="#b58cff"
            stroke="#7a55c9"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M-6 0 L-4 -32 L6 -62 L18 -32 L16 0 Z"
            fill="#7be0ff"
            stroke="#3aa8cf"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M16 0 L18 -22 L28 -40 L36 -20 L32 0 Z"
            fill="#ff8fd6"
            stroke="#cc5aa8"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M2 -40 L5 -54"
            stroke="#fff"
            strokeOpacity="0.8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
      );
    case "fairyLights":
      return (
        <g>
          <path
            d="M-10 190 Q200 290 400 215 Q600 290 810 190"
            stroke="#3a2a22"
            strokeWidth="2.4"
            fill="none"
          />
          {[...LIGHTS_LEFT, ...LIGHTS_RIGHT].map(([x, y], i) => {
            const colour = BULB_COLOURS[i % BULB_COLOURS.length];
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y + 6}
                  r="12"
                  fill={colour}
                  opacity={0.12 + glow * 0.38}
                />
                <circle
                  cx={x}
                  cy={y + 6}
                  r="5"
                  fill={colour}
                  stroke="#0000002a"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </g>
      );
    case "lanterns":
      return (
        <g>
          <path
            d="M810 150 Q690 126 520 162"
            stroke="#4a2f1c"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          <Lantern x={566} y={184} glow={0.25 + glow * 0.75} />
          <Lantern x={654} y={172} glow={0.25 + glow * 0.75} />
        </g>
      );
  }
}

/** A decor piece alone, for the shop and cards. */
export function DecorIcon({
  id,
  className,
}: {
  id: DecorId;
  className?: string;
}) {
  const spec = DECOR_SPECS[id];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={spec.box}
      className={className}
    >
      <defs>
        <radialGradient id="fl-lantern-glow">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd37a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <DecorPiece id={id} glow={1} />
    </svg>
  );
}
