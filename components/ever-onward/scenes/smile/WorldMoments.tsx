import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { INK } from "./parts";
import { Shout } from "./StreetsLayer";

interface MomentsProps {
  info: SmileSceneInfo;
}

const SPARK_DELAY = [
  "[animation-delay:0s]",
  "[animation-delay:0.2s]",
  "[animation-delay:0.4s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.8s]",
  "[animation-delay:1s]",
  "[animation-delay:1.2s]",
  "[animation-delay:1.4s]",
  "[animation-delay:1.6s]",
] as const;

const BUNTING = [
  "#ff5d73",
  "#ffd23f",
  "#4cc9f0",
  "#7bed9f",
  "#c77dff",
] as const;

/** Banners across the top of the street: a festival is on. */
function Festival() {
  return (
    <g data-testid="eo-world-festival">
      <rect x="0" y="30" width="400" height="2" fill={INK} />
      {Array.from({ length: 16 }, (_, i) => (
        <g key={i} className={i % 2 ? "ms-sway" : "ms-sway"}>
          <rect
            x={4 + i * 25}
            y="32"
            width="16"
            height="12"
            fill={BUNTING[i % 5]}
          />
          <rect
            x={7 + i * 25}
            y="44"
            width="10"
            height="5"
            fill={BUNTING[i % 5]}
          />
          <rect
            x={10 + i * 25}
            y="49"
            width="4"
            height="3"
            fill={BUNTING[i % 5]}
          />
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={20 + i * 42}
          y="60"
          width="5"
          height="5"
          fill={BUNTING[(i + 2) % 5]}
          className={`ms-confetti ${SPARK_DELAY[i]}`}
        />
      ))}
    </g>
  );
}

/** A gloomy week: a grey wash, slow clouds and drizzle. */
function Gloom() {
  return (
    <g data-testid="eo-world-gloom">
      <rect
        x="0"
        y="0"
        width="400"
        height="300"
        fill="#4b5563"
        fillOpacity="0.28"
      />
      <g className="ms-drift" fill="#6b7280">
        <rect x="40" y="20" width="90" height="22" />
        <rect x="60" y="12" width="50" height="10" />
        <rect x="240" y="28" width="110" height="24" />
        <rect x="262" y="20" width="60" height="10" />
      </g>
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x={30 + i * 31}
          y={56 + (i % 3) * 14}
          width="2"
          height="9"
          fill="#9ec5ff"
          className={i % 2 ? "ms-rain" : "ms-rain-b"}
        />
      ))}
    </g>
  );
}

/** Crowds tired of noise: the banner says so, and hands go to ears (in the faces). */
function Weary() {
  return (
    <g
      data-testid="eo-world-weary"
      fill="none"
      stroke="#4b5563"
      strokeWidth="2"
    >
      <path d="M 66 140 l 6 -4 l 6 4 l 6 -4" className="ms-w-wave" />
      <path
        d="M 300 150 l 6 -4 l 6 4 l 6 -4"
        className="ms-w-wave ms-w-wave-b"
      />
    </g>
  );
}

const DAY_NAMES: Record<string, string> = {
  fest: "FESTIVAL DAY",
  gloom: "GLOOMY WEEK",
  weary: "TIRED OF NOISE",
};
const DAY_COLORS: Record<string, string> = {
  fest: "#ffd23f",
  gloom: "#9ec5ff",
  weary: "#ffb4a2",
};

/** The little drones that stay up after the launch: a faint swirl under each. */
function Hovering() {
  return (
    <g data-testid="eo-world-drones">
      {[70, 190, 310].map((x, i) => (
        <g key={x} className={i === 1 ? "ms-bob-b" : "ms-bob"}>
          <polygon
            points={`${x},30 ${x - 26},150 ${x + 26},150`}
            fill="#ff7ad9"
            fillOpacity="0.14"
          />
          <g className="ms-w-spin">
            <circle
              cx={x}
              cy="34"
              r="9"
              fill="none"
              stroke="#ff4d8d"
              strokeWidth="2"
            />
            <circle
              cx={x}
              cy="34"
              r="4"
              fill="none"
              stroke="#7ad9ff"
              strokeWidth="2"
            />
          </g>
          <rect x={x - 10} y="22" width="20" height="8" fill="#2b2140" />
          <rect x={x - 16} y="20" width="8" height="2" fill="#c7d6e8" />
          <rect x={x + 8} y="20" width="8" height="2" fill="#c7d6e8" />
          <rect x={x - 2} y="24" width="4" height="4" fill="#ff3b6b" />
        </g>
      ))}
    </g>
  );
}

/** The launch: the sky goes dim, a swarm sweeps over, spirals spin, and the faces change. */
function DroneLaunch({ k }: { k: number }) {
  return (
    <g key={k} aria-hidden="true" data-testid="eo-world-drone-launch">
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill="#1a0b2e"
        className="ms-w-dim"
      />
      {[18, 40, 62, 84, 30, 52, 74, 96, 8].map((y, i) => (
        <g key={y} className={`ms-w-fly ${SPARK_DELAY[i]}`}>
          <rect
            x="-34"
            y={y}
            width="22"
            height="9"
            fill="#2b2140"
            stroke="#ff7ad9"
            strokeWidth="1"
          />
          <rect x="-40" y={y - 3} width="10" height="2" fill="#e5ecf7" />
          <rect x="-16" y={y - 3} width="10" height="2" fill="#e5ecf7" />
          <rect x="-26" y={y + 3} width="5" height="4" fill="#ff3b6b" />
        </g>
      ))}
      <g className="ms-w-beams">
        <polygon
          points="200,60 70,236 330,236"
          fill="#ff7ad9"
          fillOpacity="0.32"
        />
      </g>
      <g className="ms-w-spin" fill="none" strokeWidth="5">
        <circle cx="200" cy="130" r="22" stroke="#ff4d8d" />
        <circle cx="200" cy="130" r="46" stroke="#7ad9ff" />
        <circle cx="200" cy="130" r="72" stroke="#ff4d8d" />
      </g>
      <g className="ms-w-spin ms-w-spin-b" fill="none" strokeWidth="4">
        <circle
          cx="200"
          cy="130"
          r="34"
          stroke="#ffd23f"
          strokeDasharray="12 10"
        />
        <circle
          cx="200"
          cy="130"
          r="60"
          stroke="#ffffff"
          strokeDasharray="8 14"
        />
      </g>
      <Shout x={200} y={104} size={19} fill="#ff4d8d">
        HYPNODRONES!
      </Shout>
    </g>
  );
}

/** A quarter of the crowd gets painted: a pale band sweeps across and the faces freeze. */
function Painted({ k }: { k: number }) {
  return (
    <g key={k} aria-hidden="true" data-testid="eo-world-painted-moment">
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill="#fff0fa"
        className="ms-t-flash"
      />
      <g className="ms-w-sweep">
        <polygon
          points="-60,200 -20,200 40,270 0,270"
          fill="#ffffff"
          fillOpacity="0.85"
        />
        <polygon
          points="-10,200 20,200 80,270 50,270"
          fill="#ff7ad9"
          fillOpacity="0.7"
        />
      </g>
      <Shout x={200} y={200} size={16} fill="#ff7ad9">
        PAINTED SMILES
      </Shout>
    </g>
  );
}

/** Real smiles come back: colour floods in, hearts rise and the shout is warm. */
function Healed({ k }: { k: number }) {
  return (
    <g key={k} aria-hidden="true" data-testid="eo-world-healed-moment">
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill="#ffd36e"
        className="ms-w-flood"
      />
      {[0, 1].map((r) => (
        <circle
          key={r}
          cx="200"
          cy="236"
          r="14"
          fill="none"
          stroke="#ffe29a"
          strokeWidth="5"
          className={`ms-t-ring ${r ? "[animation-delay:0.5s]" : ""}`}
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} className={`ms-w-rise ${SPARK_DELAY[i]}`}>
          <rect
            x={26 + i * 42}
            y="240"
            width="9"
            height="9"
            fill="#ff5d73"
            stroke={INK}
            strokeWidth="1.5"
          />
          <rect x={30 + i * 42} y="236" width="5" height="5" fill="#ffd23f" />
        </g>
      ))}
      <Shout x={200} y={200} size={19} fill="#ffd23f">
        REAL SMILES!
      </Shout>
    </g>
  );
}

/** Sound rings on the loudspeakers: more, bolder rings the louder the level. */
const SPEAKER_RINGS: readonly (readonly [number, number])[] = [
  [60, 142],
  [148, 148],
  [220, 142],
];

function Soundwaves({ info }: MomentsProps) {
  if (info.loud <= 0 || info.b <= 0) return null;
  const spots = SPEAKER_RINGS.slice(0, Math.min(3, info.b));
  return (
    <g
      fill="none"
      stroke="#ff7a1a"
      strokeWidth={1 + info.loud * 0.8}
      data-testid="eo-world-waves"
      data-loud={info.loud}
    >
      {spots.flatMap(([x, y], s) =>
        Array.from({ length: info.loud }, (_, r) => (
          <circle
            key={`${s}-${r}`}
            cx={x}
            cy={y}
            r={10 + r * 8}
            strokeOpacity={0.35 + info.loud * 0.12}
            className={`ms-w-wave ${SPARK_DELAY[(r * 2 + s) % 9]}`}
          />
        ))
      )}
    </g>
  );
}

/**
 * Everything that happens above the crowd: the weather of the day, the
 * loudspeakers' rings, the drones that stay, and the three big moments.
 */
export default function WorldMoments({ info }: MomentsProps) {
  const drone = (info.projects & 16) !== 0;
  return (
    <g data-testid="eo-world-moments">
      <Soundwaves info={info} />
      {info.wday === "fest" && <Festival />}
      {info.wday === "gloom" && <Gloom />}
      {info.wday === "weary" && <Weary />}
      {drone && <Hovering />}
      {info.wday !== "" && (
        <Shout x={200} y={18} size={10} fill={DAY_COLORS[info.wday]}>
          {DAY_NAMES[info.wday]}
        </Shout>
      )}
      {info.retune && (
        <g className="ms-t-pulse" data-testid="eo-world-retune">
          <Shout x={200} y={188} size={10} fill="#ffe29a">
            TUNING…
          </Shout>
        </g>
      )}
      {info.healKey > 0 && <Healed k={info.healKey} />}
      {info.lostKey > 0 && info.droneKey === 0 && <Painted k={info.lostKey} />}
      {info.droneKey > 0 && <DroneLaunch k={info.droneKey} />}
    </g>
  );
}
