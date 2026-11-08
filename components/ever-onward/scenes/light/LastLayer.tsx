import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { LIGHTS } from "@/lib/ever-onward/universes/light/warmth";
import ForkArt from "./ForkArt";
import { BOAT_LANE, LAST_LIGHTS, SHORE_Y } from "./anchors";

/** The old lantern's lamp, and the lane the boat sails. */
const LAMP = { x: 200, y: 166 };
const { startX: BOAT_START_X, endX: BOAT_END_X, y: BOAT_LANE_Y } = BOAT_LANE;

/** The three lanterns a player can pick: the glow and the flame at its heart. */
const LANTERNS = [
  { glow: "#ffd76a", flame: "#ffe9a8" },
  { glow: "#5ef2c4", flame: "#c8fff0" },
  { glow: "#ff8fb4", flame: "#ffd3e2" },
] as const;

const lanternColours = (lantern: number) =>
  LANTERNS[Math.min(LANTERNS.length, Math.max(1, lantern)) - 1];

/** How much company a lamp keeps (0 a little .. 3 a lot), from the picture's code. */
const bandOf = (code: number, light: number): number =>
  Math.floor(code / 4 ** light) % 4;

/** Which way the sparks of a bloom fly (written out so Tailwind sees every class). */
const SPARKS = [
  "[--ll-dx:-12px] [--ll-dy:-14px]",
  "[--ll-dx:0px] [--ll-dy:-20px]",
  "[--ll-dx:12px] [--ll-dy:-14px]",
  "[--ll-dx:-18px] [--ll-dy:-4px]",
  "[--ll-dx:18px] [--ll-dy:-4px]",
  "[--ll-dx:-6px] [--ll-dy:-26px]",
  "[--ll-dx:7px] [--ll-dy:-25px]",
] as const;

/** Each rising lantern at the end starts a little after the one before. */
const RISE_DELAYS = [
  "[animation-delay:0s]",
  "[animation-delay:0.25s]",
  "[animation-delay:0.5s]",
  "[animation-delay:0.75s]",
  "[animation-delay:1s]",
  "[animation-delay:1.25s]",
  "[animation-delay:1.5s]",
  "[animation-delay:1.75s]",
  "[animation-delay:2s]",
  "[animation-delay:2.25s]",
  "[animation-delay:2.5s]",
] as const;

/** Wind streaks across the picture: where each starts, and how late. */
const GUSTS = [
  { y: 60, x: 396, w: 46, late: "[animation-delay:0s]" },
  { y: 104, x: 380, w: 36, late: "[animation-delay:0.5s]" },
  { y: 150, x: 400, w: 52, late: "[animation-delay:1.1s]" },
  { y: 196, x: 372, w: 40, late: "[animation-delay:0.3s]" },
  { y: 240, x: 392, w: 44, late: "[animation-delay:0.8s]" },
  { y: 276, x: 384, w: 34, late: "[animation-delay:1.4s]" },
] as const;

const WIND_WORDS = [
  "MILD WIND COMING",
  "CHILLY WIND COMING",
  "BITTER WIND COMING",
];

/** One remembered lamp on the shore: a tall post, a glowing head, a reflection in the water, and a glass dome once the glass is thicker. */
function Lamp({
  index,
  isLit,
  band,
  tier,
  company,
  isWindy,
}: {
  index: number;
  isLit: boolean;
  band: number;
  tier: number;
  company: number;
  isWindy: boolean;
}) {
  const p = LAST_LIGHTS[index];
  const glow = 20 + band * 5 + company * 2;
  return (
    <g transform={`translate(${p.x} ${p.y})`} data-testid="lm-last-lamp">
      <rect x="-1.1" y="-20" width="2.2" height="20" fill="#26335f" />
      <rect x="-4" y="-2.5" width="8" height="2.5" fill="#1c2748" />
      {isLit && (
        <>
          <ellipse
            cy="9"
            rx="4"
            ry={9 + band * 2}
            fill="#ffd76a"
            opacity="0.28"
            className="transition-opacity duration-[1500ms]"
          />
          <circle
            cy="-26"
            r={glow}
            fill="url(#lm-lamp)"
            className="transition-opacity duration-[1500ms]"
            opacity="0.95"
          />
          <g className={`lm-flicker ${isWindy ? "ll-lean" : ""}`}>
            <rect
              x="-4.4"
              y="-32"
              width="8.8"
              height="11"
              fill="#ffe28a"
              stroke="#6b3d10"
              strokeWidth="0.9"
            />
            <rect x="-2" y="-29.5" width="4" height="6" fill="#fff8d6" />
          </g>
          {tier > 0 && (
            <path
              d="M-5.6 -21 L-5.6 -33 Q0 -39 5.6 -33 L5.6 -21"
              fill="none"
              stroke="#bfe3ff"
              strokeWidth="1.3"
              opacity="0.9"
            />
          )}
        </>
      )}
      {!isLit && (
        <rect
          x="-4.4"
          y="-32"
          width="8.8"
          height="11"
          fill="#0c1226"
          stroke="#26335f"
          strokeWidth="0.9"
        />
      )}
    </g>
  );
}

/** The flower that blooms where a light stood; the one that just bloomed pops open with a ring and sparks. */
function Flower({ index, isNew }: { index: number; isNew: boolean }) {
  const p = LAST_LIGHTS[index];
  const light = LIGHTS[index];
  return (
    <g
      transform={`translate(${p.x} ${p.y})`}
      data-testid="lm-scene-flower"
      data-new={isNew ? "yes" : "no"}
    >
      <g className={isNew ? "ll-bloom" : ""}>
        <g className="gd-sway">
          <circle cy="-17" r="15" fill={light.petal} className="gd-glow" />
          <rect x="-0.9" y="-17" width="1.8" height="17" fill="#22c55e" />
          <rect x="-7" y="-8" width="7" height="2.4" fill="#4ade80" />
          <rect x="1" y="-11" width="6" height="2.2" fill="#4ade80" />
          <g transform="translate(0 -19)">
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <circle
                key={deg}
                cx={Math.round(Math.cos((deg * Math.PI) / 180) * 5.2 * 10) / 10}
                cy={Math.round(Math.sin((deg * Math.PI) / 180) * 5.2 * 10) / 10}
                r="3.6"
                fill={light.petal}
                stroke="#05080f"
                strokeWidth="0.7"
              />
            ))}
            <circle
              r="3.6"
              fill={light.heart}
              stroke="#05080f"
              strokeWidth="0.7"
            />
          </g>
        </g>
      </g>
      {isNew && (
        <g aria-hidden="true">
          <circle
            cy="-19"
            r="14"
            fill="none"
            stroke={light.petal}
            strokeWidth="2.4"
            className="ll-ring"
          />
          {SPARKS.map((spark, k) => (
            <rect
              key={spark}
              x="-1.5"
              y="-20"
              width="3"
              height="3"
              fill={k % 2 === 0 ? light.petal : "#fff7d6"}
              className={`ll-spark ${spark}`}
            />
          ))}
        </g>
      )}
    </g>
  );
}

/** A paper lantern lifting off from a lamp's place and drifting up into the sky. */
function RisingLantern({
  x,
  y,
  delay,
  colour,
}: {
  x: number;
  y: number;
  delay: string;
  colour: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <g className={`ll-rise ${delay}`}>
        <circle cy="-26" r="32" fill="url(#lm-lamp)" />
        <circle cy="-26" r="14" fill={colour} opacity="0.35" />
        <rect
          x="-7"
          y="-34"
          width="14"
          height="17"
          fill="#ffcf6a"
          stroke="#7a3b10"
          strokeWidth="1.2"
        />
        <rect x="-3.2" y="-30" width="6.4" height="8" fill="#fff6c8" />
        <rect x="-1.5" y="-17" width="3" height="6" fill="#7a3b10" />
      </g>
    </g>
  );
}

function Boat({ info }: { info: LightSceneInfo }) {
  const x = BOAT_START_X - info.boatProgress * (BOAT_START_X - BOAT_END_X);
  const colours = lanternColours(info.lantern);
  const warm = info.flame;
  const tier = info.sailTier;
  return (
    <g>
      {/* the path home brightens with the warmth */}
      <polygon
        points={`${LAMP.x},${LAMP.y} ${x - 8},${BOAT_LANE_Y - 18} ${x + 8},${BOAT_LANE_Y + 8}`}
        fill="url(#lm-beam)"
        opacity={0.08 + 0.55 * warm}
        className="transition-opacity duration-1000"
      />
      <rect
        x={BOAT_END_X}
        y={BOAT_LANE_Y + 6}
        width={Math.max(0, x - BOAT_END_X)}
        height="2"
        fill="#ffd76a"
        opacity={0.1 + 0.5 * warm}
        className="transition-opacity duration-1000"
      />
      <g transform={`translate(${x} ${BOAT_LANE_Y}) scale(1.45)`}>
        {/* the golden haze round the boat: it grows as the flame warms */}
        <circle
          cy="-14"
          r={20 + 52 * warm}
          fill="url(#lm-lamp)"
          opacity={0.25 + 0.6 * warm}
          data-testid="lm-boat-haze"
          className="transition-opacity duration-1000"
        />
        {info.surge > 0 && (
          <g aria-hidden="true" data-testid="lm-boat-surge">
            {[0, 1, 2].map((k) => (
              <rect
                key={k}
                x={12 + k * 7}
                y={-8 + k * 5}
                width="14"
                height="1.6"
                fill="#fff0b0"
                className={`ll-wake ${RISE_DELAYS[k]}`}
              />
            ))}
            <path
              d="M-14 4 Q-22 1 -26 -3"
              fill="none"
              stroke="#fff0b0"
              strokeWidth="1.4"
              className="ll-wake"
            />
          </g>
        )}
        <g className={info.finished > 0 ? "lm-turn" : ""}>
          <g className={info.surge > 0 ? "ll-surge" : "lm-bob"}>
            <circle
              cy="-20"
              r="11"
              fill={`url(#lm-lantern-${info.lantern})`}
              opacity="0.9"
            />
            <polygon points="-1,-18 -1,-3 9,-3" fill="#c9c3ae" />
            {tier >= 1 && (
              <polygon points="-2,-16 -2,-4 -12,-4" fill="#e3dcc6" />
            )}
            {tier >= 2 && (
              <polygon points="-1,-27 -1,-19 6,-19" fill="#f2ecd6" />
            )}
            {tier >= 3 && (
              <path
                d="M-8 2 L-16 9 M8 2 L16 9"
                stroke="#9a7440"
                strokeWidth="1.2"
              />
            )}
            {tier >= 4 && <circle cx="-14" cy="-7" r="2.2" fill="#fff2b0" />}
            {tier >= 5 && (
              <polygon points="-1,-27 -1,-24 -9,-25.5" fill="#fb7185" />
            )}
            <path d="M-12 -2 L12 -2 L8 4 L-8 4 Z" fill="#202945" />
            <circle cy="-20" r="2.2" fill={colours.flame} />
            <rect x="-14" y="-12" width="2" height="6" fill="#202945" />
          </g>
        </g>
      </g>
    </g>
  );
}

/** Fog creeping across the water: more of it as the flame cools. */
function Fog({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <g aria-hidden="true" data-testid="lm-fog" data-level={level}>
      {[236, 252, 268, 282].map((y, k) => (
        <ellipse
          key={y}
          cx={120 + k * 70}
          cy={y}
          rx={120}
          ry={9 + level * 2}
          fill="#a9bcdc"
          opacity={0.07 + 0.07 * level}
          className={k % 2 === 0 ? "ll-fog" : "ll-fog-b"}
        />
      ))}
    </g>
  );
}

/** Streaks of cold wind across the picture, and a word at the top edge. */
function Wind({ chill }: { chill: number }) {
  if (chill <= 0) return null;
  const isBlowing = chill >= 4;
  const size = (isBlowing ? chill - 4 : chill - 1) as 0 | 1 | 2;
  const count = isBlowing ? GUSTS.length : 2 + size;
  return (
    <g
      aria-hidden="true"
      data-testid="lm-wind-scene"
      data-blowing={isBlowing ? "yes" : "no"}
    >
      {GUSTS.slice(0, count).map((gust) => (
        <rect
          key={gust.y}
          x={gust.x}
          y={gust.y}
          width={gust.w}
          height={isBlowing ? 3.2 : 2.2}
          fill={isBlowing ? "#eaf7ff" : "#a9c8f5"}
          className={`ll-gust ${gust.late}`}
        />
      ))}
      <text
        x="394"
        y="30"
        textAnchor="end"
        fontSize="11"
        fill={isBlowing ? "#dff0ff" : "#9ec4f2"}
        stroke="#050a18"
        strokeWidth="3"
        paintOrder="stroke"
        className="font-[family-name:var(--font-eo-pixel)]"
      >
        {isBlowing ? "COLD WIND!" : WIND_WORDS[size]}
      </text>
    </g>
  );
}

/** The hearth by the old lantern: a log for each step bought. */
function Hearth({ tier }: { tier: number }) {
  return (
    <g data-testid="lm-hearth" data-tier={tier} aria-hidden="true">
      {Array.from({ length: tier }, (_, k) => (
        <g key={k} transform={`translate(${176 + k * 9} ${250 - (k % 2) * 3})`}>
          <rect width="7" height="3" fill="#6b4423" />
          <rect
            x="1"
            y="-2"
            width="2"
            height="2"
            fill="#fb923c"
            className="lm-flicker"
          />
        </g>
      ))}
    </g>
  );
}

export default function LastLayer({ info }: { info: LightSceneInfo }) {
  const glow = 30 + 44 * info.flame;
  const isWindy = info.chill >= 4;
  const gone = info.letGoMask;
  const justGone = info.goodbye - 1;
  const lantern = lanternColours(info.lantern);

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
      {/* the sky and the dark sea; the stars are all gone */}
      <rect x="-1200" y={SHORE_Y} width="2800" height="1200" fill="#03081a" />
      <rect x="-1200" y={SHORE_Y} width="2800" height="1" fill="#16224a" />
      <rect x="-1200" y={SHORE_Y - 4} width="2800" height="5" fill="#070d22" />
      <g
        data-testid="lm-last-sky"
        opacity={1 - 0.12 * info.fog}
        className="transition-opacity duration-1000"
      >
        {LAST_LIGHTS.map((_, i) => {
          const isLit = (gone & (1 << i)) === 0;
          return (
            <Lamp
              key={i}
              index={i}
              isLit={isLit}
              band={bandOf(info.brightCode, i)}
              tier={info.slowburnTier}
              company={info.companyTier}
              isWindy={isWindy}
            />
          );
        })}
        {LAST_LIGHTS.map((_, i) =>
          (gone & (1 << i)) !== 0 ? (
            <Flower key={i} index={i} isNew={i === justGone} />
          ) : null
        )}
      </g>
      {/* rings on the dark water, and eyes past the light */}
      <g aria-hidden="true">
        <ellipse
          cx="90"
          cy="262"
          rx="10"
          ry="2.5"
          fill="none"
          stroke="#2a3a6a"
          className="gg-ripple"
        />
        <ellipse
          cx="320"
          cy="282"
          rx="12"
          ry="3"
          fill="none"
          stroke="#2a3a6a"
          className="gg-ripple-b"
        />
        <g className="gg-peek" fill="#ffe14d">
          <rect x="62" y="236" width="2" height="1" />
          <rect x="67" y="236" width="2" height="1" />
        </g>
        <g
          className="gg-peek-often"
          fill="#ffe14d"
          opacity={info.fog > 1 ? 1 : 0}
        >
          <rect x="330" y="226" width="2" height="1" />
          <rect x="335" y="226" width="2" height="1" />
        </g>
      </g>
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
      {/* the one lantern left */}
      <path
        d="M150 300 Q165 248 188 240 L216 240 Q240 248 252 300 Z"
        fill="#0b1124"
      />
      <g transform="translate(200 240) scale(0.62)">
        <use href="#lm-mini" />
      </g>
      <Hearth tier={info.hearthTier} />
      <g transform={`translate(${LAMP.x} ${LAMP.y})`}>
        <g className="lm-flicker">
          <circle
            r={glow}
            fill="url(#lm-lamp)"
            opacity={0.35 + 0.5 * info.flame}
          />
          <rect x="-4" y="-5" width="8" height="10" fill="#ffe28a" />
        </g>
        <g className="lm-sweep" opacity="0.4">
          <polygon points="0,0 190,-16 190,16" fill="url(#lm-beam)" />
        </g>
        <g className="gg-moth" aria-hidden="true">
          <g className="gg-flap">
            <rect x="7" y="-12" width="2" height="2" fill="#d8cbb0" />
            <rect x="10" y="-12" width="2" height="2" fill="#d8cbb0" />
            <rect x="9" y="-12" width="1" height="3" fill="#6b5a40" />
          </g>
        </g>
      </g>
      <Fog level={info.fog} />
      <Wind chill={info.chill} />
      {/* a goodbye: the lantern lifts off, and the words stay small at the top edge */}
      {justGone >= 0 && justGone < LAST_LIGHTS.length && (
        <g data-testid="lm-goodbye" data-light={justGone}>
          <RisingLantern
            x={LAST_LIGHTS[justGone].x}
            y={LAST_LIGHTS[justGone].y}
            delay={RISE_DELAYS[0]}
            colour={LIGHTS[justGone].petal}
          />
          <text
            x="8"
            y="30"
            textAnchor="start"
            fontSize="11"
            fill="#fde7a8"
            stroke="#1a0f05"
            strokeWidth="3"
            paintOrder="stroke"
            className="ll-banner font-[family-name:var(--font-eo-pixel)]"
          >
            GOODBYE, LITTLE LIGHT
          </text>
        </g>
      )}
      <ForkArt info={info} />
      {info.finished > 0 && (
        <g data-testid="lm-last-all-go">
          {LAST_LIGHTS.map((p, i) => (
            <RisingLantern
              key={i}
              x={p.x}
              y={p.y}
              delay={RISE_DELAYS[i]}
              colour={lantern.glow}
            />
          ))}
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="2800"
            fill="#fff3b0"
            className="lm-flash pointer-events-none opacity-0"
          />
        </g>
      )}
    </g>
  );
}
