import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";

import { plotDigit } from "@/lib/ever-onward/universes/light/garden";

import { GARDEN, LAST_LIGHTS as LIGHTS } from "./anchors";

/** The lamp, and where the boat starts and stops on the dark water. */
const LAMP = { x: 200, y: 166 };
const BOAT_START_X = 380;
const BOAT_END_X = 282;
const BOAT_LANE_Y = 262;
/** How far a boat that has lost the beam drifts down the water. */
const DRIFT_Y = 26;

/** The three lanterns a player can pick: the glow and the flame at its heart. */
const LANTERNS = [
  { glow: "#ffd76a", flame: "#ffe9a8" },
  { glow: "#5ef2c4", flame: "#c8fff0" },
  { glow: "#ff8fb4", flame: "#ffd3e2" },
] as const;

const lanternColours = (lantern: number) =>
  LANTERNS[Math.min(LANTERNS.length, Math.max(1, lantern)) - 1];

function Boat({ info }: { info: LightSceneInfo }) {
  const x = BOAT_START_X - info.boatProgress * (BOAT_START_X - BOAT_END_X);
  const y = BOAT_LANE_Y + (1 - info.boatHeading) * DRIFT_Y;
  const isTrue = info.boatHeading >= 0.8;
  const colours = lanternColours(info.lantern);
  return (
    <g>
      {/* the old beam reaching for the boat: bright when it is true */}
      <polygon
        points={`${LAMP.x},${LAMP.y} ${x - 6},${y - 14} ${x + 6},${y + 4}`}
        fill="url(#lm-beam)"
        className={`transition-opacity duration-1000 ${isTrue ? "opacity-50" : "opacity-15"}`}
      />
      <g transform={`translate(${x} ${y})`}>
        <g className={info.finished > 0 ? "lm-turn" : ""}>
          <g className="lm-bob">
            <circle
              cy="-20"
              r="11"
              fill={`url(#lm-lantern-${info.lantern})`}
              opacity="0.9"
            />
            <polygon points="-1,-18 -1,-3 9,-3" fill="#c9c3ae" />
            <path d="M-12 -2 L12 -2 L8 4 L-8 4 Z" fill="#202945" />
            <circle cy="-20" r="2.2" fill={colours.flame} />
            <rect x="-14" y="-12" width="2" height="6" fill="#202945" />
          </g>
        </g>
      </g>
    </g>
  );
}

const FLOWER_COLOURS = [
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
  "#a78bfa",
  "#2dd4bf",
  "#fb923c",
  "#f472b6",
  "#f87171",
  "#c4b5fd",
  "#facc15",
  "#93c5fd",
] as const;

/** One tiny memory flower by the lantern: sprout, bud or bloom (1 to 3). */
function Flower({ slot, digit }: { slot: number; digit: number }) {
  const x = GARDEN.x + slot * GARDEN.gap;
  const y = GARDEN.y + (slot % 2) * 3;
  const colour = FLOWER_COLOURS[slot];
  const stem = digit === 3 ? 12 : digit === 2 ? 9 : 5;
  return (
    <g transform={`translate(${x} ${y})`} data-testid="lm-scene-flower">
      <g className="gd-sway">
        {digit === 3 && (
          <circle cy={-stem} r="9" fill={colour} className="gd-glow" />
        )}
        <rect x="-0.5" y={-stem} width="1" height={stem} fill="#22c55e" />
        <rect x="-3" y="-4" width="3" height="1.5" fill="#4ade80" />
        {digit === 2 && (
          <rect x="-1.5" y={-stem - 3} width="3" height="4" fill={colour} />
        )}
        {digit === 3 && (
          <g transform={`translate(0 ${-stem})`}>
            <circle r="3.4" fill={colour} />
            <circle r="1.4" fill="#fff7ed" />
          </g>
        )}
      </g>
    </g>
  );
}

function RainBarrel() {
  return (
    <g transform={`translate(${GARDEN.barrelX} ${GARDEN.y + 2})`}>
      <rect x="-6" y="-12" width="12" height="13" fill="#6b4423" />
      <rect x="-6" y="-9" width="12" height="1.5" fill="#3b2412" />
      <rect x="-6" y="-4" width="12" height="1.5" fill="#3b2412" />
      <rect x="-5" y="-13" width="10" height="2" fill="#38bdf8" opacity="0.8" />
    </g>
  );
}

export default function LastLayer({ info }: { info: LightSceneInfo }) {
  /** The lantern is one of the lights; the rest are the dots. */
  const glow = 36 + 56 * info.flame;
  // A low flame dims the night: the far lights and the water fade a little.
  // It is feedback for the player, never a loss.
  const dim = Math.min(1, Math.max(0, (0.45 - info.flame) / 0.45));

  return (
    <g>
      <defs>
        {LANTERNS.map((c, i) => (
          <radialGradient key={c.glow} id={`lm-lantern-${i + 1}`}>
            <stop offset="0" stopColor={c.glow} stopOpacity="0.95" />
            <stop offset="1" stopColor={c.glow} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <rect x="-1200" y="-1200" width="2800" height="2800" fill="#010206" />
      <g
        className="transition-opacity duration-1000"
        opacity={1 - 0.7 * dim}
        data-testid="lm-last-sky"
      >
        <rect x="-1200" y="224" width="2800" height="1200" fill="#03081a" />
        <rect x="-1200" y="224" width="2800" height="1" fill="#16224a" />
        {LIGHTS.map((l, i) => {
          const isLit = (info.letGoMask & (1 << i)) === 0;
          return (
            <g key={i}>
              <circle
                cx={l.x}
                cy={l.y}
                r="20"
                fill="url(#lm-lamp)"
                className={`transition-opacity duration-[1500ms] ${isLit ? "opacity-80" : "opacity-0"}`}
              />
              <circle
                cx={l.x}
                cy={l.y}
                r="4"
                strokeWidth="1"
                className={`transition-colors duration-[1500ms] ${isLit ? "fill-amber-200 stroke-amber-50" : "fill-slate-900 stroke-slate-600"}`}
              />
            </g>
          );
        })}
      </g>
      {info.boatVisible > 0 && (
        <g className="lm-fade-up">
          {[240, 256, 272, 288].map((wy, i) => (
            <rect
              key={wy}
              x={40 + ((i * 97) % 220)}
              y={wy}
              width="34"
              height="1"
              fill="#16224a"
            />
          ))}
          <Boat info={info} />
        </g>
      )}
      {/* the one lantern left */}
      <path
        d="M150 300 Q165 248 188 240 L216 240 Q240 248 252 300 Z"
        fill="#0b1124"
      />
      <g transform="translate(200 240) scale(0.62)">
        <use href="#lm-mini" />
      </g>
      {/* memory flowers: one for each light let go, growing by the lantern */}
      {info.gardenCode > 0 && (
        <g data-testid="lm-scene-garden" opacity="0.95">
          {LIGHTS.map((_, slot) => {
            const digit = plotDigit(info.gardenCode, slot);
            return digit > 0 ? (
              <Flower key={slot} slot={slot} digit={digit} />
            ) : null;
          })}
          {info.rainBarrel > 0 && <RainBarrel />}
        </g>
      )}
      <g transform={`translate(${LAMP.x} ${LAMP.y})`}>
        <g className="lm-flicker">
          <circle
            r={glow}
            fill="url(#lm-lamp)"
            opacity={0.45 + 0.45 * info.flame}
          />
          <rect x="-4" y="-5" width="8" height="10" fill="#ffe28a" />
        </g>
        <g className="lm-sweep" opacity="0.4">
          <polygon points="0,0 190,-16 190,16" fill="url(#lm-beam)" />
        </g>
      </g>
      {info.finished > 0 && (
        <rect
          x="-1200"
          y="-1200"
          width="2800"
          height="2800"
          fill="#fff3b0"
          className="lm-flash pointer-events-none opacity-0"
        />
      )}
    </g>
  );
}
