import type { DecorId } from "@/lib/flamelings/catalog";
import { skyPhase, type SkyPhase } from "@/lib/flamelings/sky";
import { DECOR_SPECS, DecorPiece, type DecorLayer } from "./DecorArt";

interface GladeProps {
  /** The game clock (ms): the sky follows it. */
  nowMs: number;
  /** The decor this pet has put out. */
  decor?: readonly DecorId[];
}

const SKY: Record<SkyPhase, [string, string, string]> = {
  dawn: ["#3b3a73", "#d9779a", "#ffc58a"],
  day: ["#4fa8f5", "#9fd8ff", "#e4f6ff"],
  dusk: ["#3f3a8a", "#e8635a", "#ffb15a"],
  evening: ["#1b1b52", "#4b2f78", "#8a4a7a"],
  night: ["#070b22", "#101a44", "#1d2a5c"],
};

const TINT: Record<SkyPhase, { colour: string; opacity: number }> = {
  dawn: { colour: "#ff9a6a", opacity: 0.1 },
  day: { colour: "#ffffff", opacity: 0 },
  dusk: { colour: "#ff7a3a", opacity: 0.14 },
  evening: { colour: "#2a1a5a", opacity: 0.28 },
  night: { colour: "#08102a", opacity: 0.42 },
};

/** How strongly the lantern and hearth glow. */
const GLOW: Record<SkyPhase, number> = {
  dawn: 0.35,
  day: 0.12,
  dusk: 0.6,
  evening: 0.85,
  night: 1,
};

const STARS = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 211 + 37) % 800,
  y: 14 + ((i * 97 + 11) % 250),
  r: 0.9 + (i % 3) * 0.6,
  delay: (i % 7) * 0.4,
}));

const FLIES = [
  { x: 120, y: 330 },
  { x: 300, y: 270 },
  { x: 470, y: 330 },
  { x: 640, y: 290 },
  { x: 220, y: 400 },
  { x: 560, y: 410 },
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
      <rect x="-5" y="-12" width="10" height="16" rx="4" fill="#f2e6d0" />
      <path d="M-20 -10 Q0 -42 20 -10 Z" fill="#e5484d" />
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
}: {
  x: number;
  y: number;
  flip?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}
      fill="none"
      stroke="#2f8f4a"
      strokeWidth="5"
      strokeLinecap="round"
    >
      <path d="M0 0 Q-8 -40 -34 -64" />
      <path d="M0 0 Q4 -50 8 -78" />
      <path d="M0 0 Q14 -40 38 -58" />
    </g>
  );
}

/**
 * Ember Hollow: a layered, cozy glade drawn in SVG. The sky, glow and stars
 * follow the clock. It fills its parent and crops (never stretches) to fit.
 */
export default function Glade({ nowMs, decor = [] }: GladeProps) {
  const phase = skyPhase(nowMs);
  const [top, mid, bottom] = SKY[phase];
  const tint = TINT[phase];
  const glow = GLOW[phase];
  const night = phase === "night" || phase === "evening";
  const placed = (layer: DecorLayer) =>
    decor
      .filter((id) => DECOR_SPECS[id].layer === layer)
      .map((id) => {
        const { x, y } = DECOR_SPECS[id];
        return (
          <g
            key={id}
            data-testid={`fl-decor-${id}`}
            transform={`translate(${x} ${y})`}
          >
            <DecorPiece id={id} glow={glow} />
          </g>
        );
      });
  const sun = phase === "dawn" ? 270 : phase === "dusk" ? 250 : 110;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMax slice"
      data-sky={phase}
    >
      <defs>
        <linearGradient id="fl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <linearGradient id="fl-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3e8a47" />
          <stop offset="1" stopColor="#1f5a35" />
        </linearGradient>
        <radialGradient id="fl-lantern-glow">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd37a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fl-hearth-glow">
          <stop offset="0" stopColor="#ff9a3c" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
        </radialGradient>
      </defs>

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
          <circle cx="500" cy="130" r="60" fill="#fff6c8" opacity="0.12" />
          <circle cx="500" cy="130" r="34" fill="#fbf3cf" />
          <circle cx="514" cy="120" r="30" fill={top} />
        </g>
      ) : (
        <g data-testid="fl-sun">
          <circle cx="500" cy={sun} r="70" fill="#fff2b0" opacity="0.25" />
          <circle
            cx="600"
            cy={sun}
            r="36"
            fill={phase === "day" ? "#ffe066" : "#ffb347"}
          />
        </g>
      )}

      <path
        d="M0 330 Q120 250 260 320 T520 300 T800 320 L800 600 L0 600 Z"
        fill="#2f6b57"
      />
      <path
        d="M0 380 Q160 320 320 370 T640 360 T800 380 L800 600 L0 600 Z"
        fill="#2a7a4a"
      />

      {/* Side trees: only the wide (landscape) crop shows them. */}
      {[60, 740].map((x) => (
        <g key={x}>
          <rect
            x={x - 12}
            y="300"
            width="24"
            height="160"
            rx="8"
            fill="#5a3b24"
          />
          <circle cx={x} cy="280" r="62" fill="#1f6b3a" />
          <circle cx={x - 34} cy="320" r="44" fill="#26793f" />
          <circle cx={x + 34} cy="322" r="44" fill="#26793f" />
        </g>
      ))}

      <path
        d="M0 440 Q200 410 400 430 T800 430 L800 600 L0 600 Z"
        fill="url(#fl-ground)"
      />
      {[260, 330, 470, 540, 610].map((x, i) => (
        <path
          key={x}
          d={`M${x} ${505 + (i % 2) * 20} l-4 -14 M${x} ${505 + (i % 2) * 20} l4 -16 M${x} ${505 + (i % 2) * 20} l8 -10`}
          stroke="#58b560"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}

      <Fern x={222} y={500} />
      <Fern x={585} y={505} flip />
      <Mushroom x={228} y={522} scale={1.2} />
      <Mushroom x={255} y={532} scale={0.8} />
      <Mushroom x={566} y={528} scale={1} />

      {/* The food basket. */}
      <g data-testid="fl-basket" transform="translate(-52 -38)">
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

      {placed("rug")}
      {placed("back")}

      {/* The hearth ring the pet sits on. */}
      <g data-testid="fl-hearth">
        <ellipse cx="400" cy="492" rx="170" ry="38" fill="#6b6f78" />
        <ellipse cx="400" cy="488" rx="150" ry="30" fill="#3a2a22" />
        <ellipse
          cx="400"
          cy="488"
          rx="150"
          ry="30"
          fill="url(#fl-hearth-glow)"
          opacity={glow * 0.55}
        />
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return (
            <ellipse
              key={i}
              cx={400 + Math.cos(a) * 162}
              cy={492 + Math.sin(a) * 34}
              rx="17"
              ry="9"
              fill={i % 2 ? "#8a8f99" : "#a1a6b0"}
              stroke="#5a5f68"
              strokeWidth="1.5"
            />
          );
        })}
      </g>

      {placed("front")}

      <rect
        width="800"
        height="600"
        fill={tint.colour}
        opacity={tint.opacity}
      />

      {/* The lantern, hanging from a branch. */}
      <g data-testid="fl-lantern" transform="translate(40 0)">
        <path
          d="M-10 70 Q120 40 270 70"
          stroke="#4a2f1c"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M250 72 L250 150" stroke="#2c2c34" strokeWidth="3" />
        <circle
          cx="250"
          cy="190"
          r="70"
          fill="url(#fl-lantern-glow)"
          opacity={glow}
        />
        <rect
          x="232"
          y="146"
          width="36"
          height="52"
          rx="8"
          fill="#ffcf6e"
          stroke="#2c2c34"
          strokeWidth="4"
        />
        <rect x="226" y="140" width="48" height="10" rx="3" fill="#2c2c34" />
        <rect x="226" y="196" width="48" height="8" rx="3" fill="#2c2c34" />
        <rect x="244" y="158" width="12" height="28" rx="6" fill="#fff3b8" />
      </g>

      {placed("hang")}

      {FLIES.map((fly, i) => (
        <circle
          key={i}
          className={`fl-fly fl-fly-${i + 1}`}
          cx={fly.x}
          cy={fly.y}
          r="4"
          fill="#e8ff7a"
          opacity={night ? 0.95 : 0.45}
        />
      ))}
    </svg>
  );
}
