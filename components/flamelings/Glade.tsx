import type { DecorId } from "@/lib/flamelings/catalog";
import { skyPhase, type SkyPhase } from "@/lib/flamelings/sky";
import { DECOR_SPECS, DecorPiece, type DecorLayer } from "./DecorArt";

interface GladeProps {
  /** The game clock (ms): the sky follows it. */
  nowMs: number;
  /** The decor this pet has put out. */
  decor?: readonly DecorId[];
}

/**
 * Where the pet's feet rest in the logs, in the glade's 800x600 box. PetView
 * anchors the pet here (see `.fl-hearth-anchor` in globals.css).
 */
export const HEARTH = { x: 400, y: 518 } as const;

/** The sky, top to horizon. */
const SKY: Record<SkyPhase, [string, string, string, string]> = {
  dawn: ["#3b3a73", "#8a5f9e", "#e58aa0", "#ffc58a"],
  day: ["#5aaef5", "#8fd0ff", "#c8ecff", "#fff1d6"],
  dusk: ["#2c2457", "#6b4a8e", "#d9849a", "#f6b37a"],
  evening: ["#1d1a4a", "#3d2d6e", "#7a4a86", "#c0708a"],
  night: ["#0b0f2a", "#151c4a", "#26265e", "#3b2f6a"],
};

/** A wash over the land (not the fire, which glows through it). */
const TINT: Record<SkyPhase, { colour: string; opacity: number }> = {
  dawn: { colour: "#ff9a6a", opacity: 0.08 },
  day: { colour: "#ffffff", opacity: 0 },
  dusk: { colour: "#ff7a3a", opacity: 0.06 },
  evening: { colour: "#2a1a5a", opacity: 0.2 },
  night: { colour: "#08102a", opacity: 0.34 },
};

/** How strongly the campfire, the light pool and the lanterns glow. */
const GLOW: Record<SkyPhase, number> = {
  dawn: 0.55,
  day: 0.3,
  dusk: 0.8,
  evening: 0.92,
  night: 1,
};

/** The land, back to front: [top, bottom] gradients and flat colours. */
interface Land {
  far: [string, string];
  mid: [string, string];
  near: [string, string];
  ground: [string, string];
  pine: string;
  /** Tree canopy: dark, mid, back, highlight. */
  leaf: [string, string, string, string];
  trunk: string;
}

const LAND: Record<SkyPhase, Land> = {
  dawn: {
    far: ["#b08ab8", "#8f6aa0"],
    mid: ["#7590a8", "#5a7290"],
    near: ["#5c9a66", "#3d7050"],
    ground: ["#4f9456", "#2c5a3a"],
    pine: "#3e5a6c",
    leaf: ["#2e573f", "#386a4a", "#2a4d37", "#4f8a5e"],
    trunk: "#53352a",
  },
  day: {
    far: ["#a890d6", "#8e78c0"],
    mid: ["#6aa6c4", "#5089aa"],
    near: ["#62b36c", "#43894f"],
    ground: ["#5daf5a", "#3a7d42"],
    pine: "#3d6f78",
    leaf: ["#3a7a4a", "#4a8f58", "#336c42", "#68ad72"],
    trunk: "#6a4530",
  },
  dusk: {
    far: ["#8c6aa6", "#6d5590"],
    mid: ["#5b7a8f", "#3f5c74"],
    near: ["#4f8a5e", "#2f5a43"],
    ground: ["#3f7a4e", "#22402f"],
    pine: "#2f4a5c",
    leaf: ["#284a37", "#2f5940", "#25432f", "#3b6c4c"],
    trunk: "#4a2f22",
  },
  evening: {
    far: ["#6a5288", "#4f3f70"],
    mid: ["#44607a", "#2f4660"],
    near: ["#3d6e4c", "#244634"],
    ground: ["#33643f", "#1b3326"],
    pine: "#24384a",
    leaf: ["#203d2e", "#264a36", "#1d3628", "#30573f"],
    trunk: "#3d271d",
  },
  night: {
    far: ["#463d70", "#322b58"],
    mid: ["#2f4662", "#20324b"],
    near: ["#2b5040", "#183026"],
    ground: ["#25482f", "#12261b"],
    pine: "#1a2a3a",
    leaf: ["#18301f", "#1d3a27", "#152a1c", "#264833"],
    trunk: "#2f1f17",
  },
};

const STARS = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 211 + 37) % 800,
  y: 14 + ((i * 97 + 11) % 250),
  r: 0.9 + (i % 3) * 0.6,
  delay: (i % 7) * 0.4,
}));

const FLIES = [
  { x: 150, y: 400 },
  { x: 290, y: 330 },
  { x: 520, y: 380 },
  { x: 640, y: 330 },
  { x: 250, y: 470 },
  { x: 590, y: 480 },
];

const FAR_HILLS =
  "M0 336 C 117 281, 203 297, 297 320 S 508 273, 609 297 S 750 281, 800 305 L800 600 L0 600Z";
const MID_HILLS =
  "M0 372 C 94 340, 188 348, 281 370 S 484 332, 594 356 S 734 340, 800 358 L800 600 L0 600Z";
const NEAR_RIDGE = "M0 410 C 125 387, 234 395, 352 410 S 594 391, 800 406";
const GROUND =
  "M0 448 C 156 434, 313 440, 400 444 S 664 432, 800 444 L800 600 L0 600Z";

/** Pines along the middle ridge: [x, base y, height]. */
const PINES: [number, number, number][] = [
  [28, 372, 50],
  [58, 366, 66],
  [92, 364, 44],
  [196, 360, 40],
  [612, 360, 48],
  [654, 352, 64],
  [690, 356, 46],
  [742, 352, 58],
  [772, 360, 40],
];

/** The lantern string: a sagging curve from tree to tree. */
const STRING = {
  from: [188, 252],
  sag: [400, 352],
  to: [612, 252],
} as const;
const BULB_COLOURS = ["#ffd27a", "#ff9fb3", "#9fd8ff", "#ffd27a"];

function onString(t: number): [number, number] {
  const u = 1 - t;
  const { from, sag, to } = STRING;
  return [
    u * u * from[0] + 2 * u * t * sag[0] + t * t * to[0],
    u * u * from[1] + 2 * u * t * sag[1] + t * t * to[1],
  ];
}

const BULBS = [0.17, 0.39, 0.61, 0.83].map((t, i) => ({
  at: onString(t),
  colour: BULB_COLOURS[i],
}));

/** Embers that drift up out of the fire: [x, size, drift class]. */
const EMBERS: [number, number, number][] = [
  [372, 3.4, 1],
  [430, 2.6, 2],
  [396, 3, 3],
  [450, 2.2, 4],
  [356, 2.4, 5],
];

function Mushroom({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-5" y="-12" width="10" height="16" rx="4" fill="#f5e6d3" />
      <path d="M-20 -10 Q0 -40 20 -10 Z" fill="#e8564a" />
      <path d="M-20 -10 Q0 -16 20 -10" fill="#c43f3a" opacity="0.5" />
      <circle cx="-7" cy="-19" r="3" fill="#fff" />
      <circle cx="6" cy="-24" r="2.4" fill="#fff" />
      <circle cx="10" cy="-15" r="2" fill="#fff" />
    </g>
  );
}

function Fern({
  x,
  y,
  flip = false,
  colour,
}: {
  x: number;
  y: number;
  flip?: boolean;
  colour: string;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}
      fill="none"
      stroke={colour}
      strokeWidth="5"
      strokeLinecap="round"
    >
      <path d="M0 0 Q-8 -36 -30 -56" />
      <path d="M0 0 Q4 -44 8 -68" />
      <path d="M0 0 Q14 -36 34 -50" />
    </g>
  );
}

/** A big storybook tree at the edge of the glade (mirrored on the right). */
function Tree({ land, flip = false }: { land: Land; flip?: boolean }) {
  const [dark, mid, back, light] = land.leaf;
  return (
    <g transform={flip ? "translate(800 0) scale(-1 1)" : undefined}>
      <rect x="66" y="230" width="30" height="250" rx="10" fill={land.trunk} />
      <path
        d="M92 300 Q120 280 150 284"
        stroke={land.trunk}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="40" cy="236" r="84" fill={dark} />
      <circle cx="122" cy="200" r="72" fill={mid} />
      <circle cx="88" cy="292" r="62" fill={back} />
      <circle cx="176" cy="246" r="34" fill={mid} />
      <circle cx="140" cy="184" r="26" fill={light} opacity="0.7" />
      <circle cx="70" cy="196" r="18" fill={light} opacity="0.5" />
    </g>
  );
}

/**
 * The campfire the pet sits in: a light pool on the grass, a scorch mark,
 * two crossed logs with glowing ends and a ring of six stones in front.
 */
function CampfireBase({ glow }: { glow: number }) {
  const pool = Math.max(0.35, glow);
  const { x, y } = HEARTH;
  const logY = y - 13;
  return (
    <g data-testid="fl-hearth">
      <g className="fl-pool-glow">
        <ellipse
          cx={x}
          cy={y + 6}
          rx="280"
          ry="92"
          fill="url(#fl-pool)"
          opacity={pool}
        />
      </g>
      <circle
        cx={x}
        cy={y - 110}
        r="170"
        fill="url(#fl-halo)"
        opacity={glow * 0.8}
      />
      <ellipse
        cx={x}
        cy={y + 4}
        rx="118"
        ry="26"
        fill="#2a1f22"
        opacity="0.55"
      />
      {/* Stones behind the logs. */}
      <g fill="url(#fl-stone-back)">
        <ellipse cx={x - 92} cy={y - 18} rx="20" ry="11" />
        <ellipse cx={x - 50} cy={y - 26} rx="20" ry="10" />
        <ellipse cx={x} cy={y - 29} rx="20" ry="10" />
        <ellipse cx={x + 50} cy={y - 26} rx="20" ry="10" />
        <ellipse cx={x + 92} cy={y - 18} rx="20" ry="11" />
      </g>
      {/* Coals under the logs. */}
      <ellipse cx={x} cy={y - 6} rx="70" ry="14" fill="#7a2a14" />
      <ellipse
        cx={x}
        cy={y - 8}
        rx="54"
        ry="9"
        fill="#ff7a2a"
        opacity={0.5 + glow * 0.5}
      />
      <g fill="#ffcf5c" opacity={0.4 + glow * 0.6}>
        <circle cx={x - 30} cy={y - 8} r="3" />
        <circle cx={x + 18} cy={y - 5} r="2.5" />
        <circle cx={x + 40} cy={y - 10} r="2" />
      </g>
      {/* Two crossed logs; their front ends glow. */}
      <rect
        x={x - 104}
        y={logY - 14}
        width="208"
        height="28"
        rx="14"
        fill="url(#fl-log)"
        transform={`rotate(-12 ${x} ${logY})`}
      />
      <rect
        x={x - 104}
        y={logY - 14}
        width="208"
        height="28"
        rx="14"
        fill="url(#fl-log)"
        transform={`rotate(12 ${x} ${logY})`}
      />
      <path
        d={`M${x - 80} ${logY - 3} l26 -4 M${x + 58} ${logY - 8} l22 4`}
        stroke="#c98a5a"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      {[-1, 1].map((side) => {
        const ex = x + side * 99;
        const ey = logY + 21;
        return (
          <g key={side}>
            <circle cx={ex} cy={ey} r="14" fill="#d9a06a" />
            <circle
              cx={ex}
              cy={ey}
              r="14"
              fill="none"
              stroke="#ff8a3d"
              strokeWidth="3"
              opacity={0.3 + glow * 0.6}
            />
            <circle cx={ex} cy={ey} r="8" fill="#b8784a" />
            <circle cx={ex} cy={ey} r="3" fill="#8a5432" />
          </g>
        );
      })}
      {/* The stone ring in front. */}
      <g fill="url(#fl-stone)" stroke="#5c5570" strokeWidth="1.5">
        <ellipse cx={x - 135} cy={y + 14} rx="25" ry="15" />
        <ellipse cx={x - 87} cy={y + 30} rx="27" ry="15" />
        <ellipse cx={x - 30} cy={y + 38} rx="27" ry="14" />
        <ellipse cx={x + 30} cy={y + 38} rx="27" ry="14" />
        <ellipse cx={x + 87} cy={y + 30} rx="27" ry="15" />
        <ellipse cx={x + 135} cy={y + 14} rx="25" ry="15" />
      </g>
      <g fill="#ffcf9a" opacity={0.15 + glow * 0.3}>
        <ellipse cx={x - 87} cy={y + 24} rx="14" ry="5" />
        <ellipse cx={x - 30} cy={y + 32} rx="14" ry="5" />
        <ellipse cx={x + 30} cy={y + 32} rx="14" ry="5" />
        <ellipse cx={x + 87} cy={y + 24} rx="14" ry="5" />
      </g>
    </g>
  );
}

/**
 * Ember Hollow: a cozy storybook glade at dusk, drawn in SVG. The pet is the
 * campfire in the middle. The sky, the land colours and the glow follow the
 * clock. It fills its parent and crops (never stretches) to fit; the ground
 * runs on below the box, so a dock over the bottom never shows a gap.
 */
export default function Glade({ nowMs, decor = [] }: GladeProps) {
  const phase = skyPhase(nowMs);
  const sky = SKY[phase];
  const land = LAND[phase];
  const tint = TINT[phase];
  const glow = GLOW[phase];
  const night = phase === "night" || phase === "evening";
  const horizon = sky[3];
  const placed = (layer: DecorLayer) =>
    decor
      .filter((id) => DECOR_SPECS[id].layer === layer)
      .map((id) => {
        const { x, y } = DECOR_SPECS[id];
        return (
          <g
            key={id}
            data-testid={`fl-decor-${id}`}
            className={`fl-decor-${id}`}
            transform={`translate(${x} ${y})`}
          >
            <DecorPiece id={id} glow={glow} />
          </g>
        );
      });
  // Low over the hills at dawn and dusk (setting behind them), high by day.
  const sunY = phase === "dawn" || phase === "dusk" ? 292 : 160;
  // The fairy lights take over from the lantern string when they are out.
  const lanterns = !decor.includes("fairyLights");
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMax slice"
      data-sky={phase}
    >
      <defs>
        <linearGradient id="fl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="0.4" stopColor={sky[1]} />
          <stop offset="0.68" stopColor={sky[2]} />
          <stop offset="0.8" stopColor={sky[3]} />
        </linearGradient>
        <linearGradient id="fl-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={land.far[0]} />
          <stop offset="0.4" stopColor={land.far[1]} />
        </linearGradient>
        <linearGradient id="fl-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={land.mid[0]} />
          <stop offset="0.4" stopColor={land.mid[1]} />
        </linearGradient>
        <linearGradient id="fl-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={land.near[0]} />
          <stop offset="0.3" stopColor={land.near[1]} />
        </linearGradient>
        <linearGradient id="fl-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={land.ground[0]} />
          <stop offset="1" stopColor={land.ground[1]} />
        </linearGradient>
        <radialGradient id="fl-pool">
          <stop offset="0" stopColor="#ffb35c" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#ff8a3d" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fl-halo">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fl-moon" cx="0.4" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fff8e1" />
          <stop offset="1" stopColor="#ffe2a8" />
        </radialGradient>
        <linearGradient id="fl-log" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a0623a" />
          <stop offset="1" stopColor="#5e3218" />
        </linearGradient>
        <linearGradient id="fl-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b8b2c6" />
          <stop offset="1" stopColor="#6f6884" />
        </linearGradient>
        <linearGradient id="fl-stone-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8f88a2" />
          <stop offset="1" stopColor="#57506a" />
        </linearGradient>
        {/* DecorPiece lanterns use this. */}
        <radialGradient id="fl-lantern-glow">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd37a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect y="-600" width="800" height="1200" fill={sky[0]} />
      <rect width="800" height="600" fill="url(#fl-sky)" />

      {night &&
        STARS.map((star, i) => (
          <circle
            key={i}
            className="fl-twinkle"
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#fff"
            opacity={phase === "evening" ? 0.5 : 0.95}
            data-delay={star.delay}
          />
        ))}

      {night ? (
        <g data-testid="fl-moon">
          <circle cx="556" cy="196" r="62" fill="#ffe8b8" opacity="0.16" />
          <circle cx="556" cy="196" r="34" fill="url(#fl-moon)" />
          <circle cx="545" cy="188" r="6" fill="#f2d39a" opacity="0.6" />
          <circle cx="566" cy="208" r="4" fill="#f2d39a" opacity="0.6" />
        </g>
      ) : (
        <g data-testid="fl-sun">
          <circle cx="560" cy={sunY} r="72" fill="#fff2b0" opacity="0.3" />
          <circle
            cx="560"
            cy={sunY}
            r="36"
            fill={phase === "day" ? "#ffe066" : "#ffc06a"}
          />
        </g>
      )}

      <path d={FAR_HILLS} fill="url(#fl-far)" />
      <path d={MID_HILLS} fill="url(#fl-mid)" />
      <g fill={land.pine} opacity="0.9">
        {PINES.map(([px, base, h]) => (
          <path
            key={px}
            d={`M${px - h * 0.3} ${base} L${px} ${base - h} L${px + h * 0.3} ${base} Z`}
          />
        ))}
      </g>
      <path d={`${NEAR_RIDGE} L800 600 L0 600Z`} fill="url(#fl-near)" />
      <path
        d={NEAR_RIDGE}
        fill="none"
        stroke={horizon}
        strokeOpacity="0.45"
        strokeWidth="3"
      />

      <Tree land={land} />
      <Tree land={land} flip />

      <path d={GROUND} fill="url(#fl-ground)" />
      {/* The ground runs on under the dock. */}
      <rect x="-800" y="599" width="2400" height="1400" fill={land.ground[1]} />
      {[150, 262, 330, 470, 548, 660].map((gx, i) => {
        const gy = 470 + (i % 3) * 22;
        return (
          <path
            key={gx}
            d={`M${gx} ${gy} l-4 -14 M${gx} ${gy} l4 -16 M${gx} ${gy} l8 -10`}
            stroke={land.near[0]}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}

      <Fern x={196} y={500} colour={land.near[0]} />
      <Fern x={606} y={504} flip colour={land.near[0]} />

      {/* The food basket. */}
      <g data-testid="fl-basket" transform="translate(64 0)">
        <path
          d="M526 470 L612 470 L600 520 Q569 532 538 520 Z"
          fill="#b57a3c"
          stroke="#8a5a28"
          strokeWidth="2"
        />
        <path
          d="M530 485 L608 485 M533 500 L604 500"
          stroke="#8a5a28"
          strokeWidth="2"
        />
        <rect
          x="536"
          y="452"
          width="46"
          height="9"
          rx="4"
          fill="#7a4a24"
          transform="rotate(-12 560 456)"
        />
        <circle cx="596" cy="460" r="8" fill="#a8743a" />
        <rect
          x="548"
          y="446"
          width="34"
          height="8"
          rx="4"
          fill="#fff"
          opacity="0.9"
        />
      </g>

      <Mushroom x={214} y={566} scale={1.15} />
      <Mushroom x={242} y={576} scale={0.75} />
      <Mushroom x={588} y={570} scale={0.95} />

      {placed("rug")}
      {placed("back")}
      {placed("front")}

      <rect
        x="-800"
        y="-600"
        width="2400"
        height="2600"
        fill={tint.colour}
        opacity={tint.opacity}
      />

      <CampfireBase glow={glow} />

      <g fill="#ffcf5c">
        {EMBERS.map(([ex, r, n]) => (
          <circle
            key={n}
            className={`fl-hearth-ember fl-hearth-ember-${n}`}
            cx={ex}
            cy={HEARTH.y - 70}
            r={r}
            opacity={0}
          />
        ))}
      </g>

      {lanterns && (
        <g data-testid="fl-lantern">
          <path
            d={`M${STRING.from[0]} ${STRING.from[1]} Q${STRING.sag[0]} ${STRING.sag[1]} ${STRING.to[0]} ${STRING.to[1]}`}
            fill="none"
            stroke="#3a2a22"
            strokeWidth="2"
          />
          {BULBS.map(({ at: [bx, by], colour }, i) => (
            <g key={i} className={`fl-lantern-sway fl-bulb-${i + 1}`}>
              <line
                x1={bx}
                y1={by}
                x2={bx}
                y2={by + 11}
                stroke="#3a2a22"
                strokeWidth="2"
              />
              <circle
                cx={bx}
                cy={by + 19}
                r="20"
                fill="url(#fl-halo)"
                opacity={0.4 + glow * 0.6}
              />
              <rect
                x={bx - 4}
                y={by + 9}
                width="8"
                height="4"
                rx="1.5"
                fill="#3a2a22"
              />
              <circle cx={bx} cy={by + 19} r="8" fill={colour} />
              <circle
                cx={bx - 2.5}
                cy={by + 16.5}
                r="2.2"
                fill="#fff"
                opacity="0.7"
              />
            </g>
          ))}
        </g>
      )}

      {placed("hang")}

      {FLIES.map((fly, i) => (
        <circle
          key={i}
          className={`fl-fly fl-fly-${i + 1}`}
          cx={fly.x}
          cy={fly.y}
          r="4"
          fill="#e9ff8a"
          opacity={night ? 0.95 : 0.45}
        />
      ))}
    </svg>
  );
}
