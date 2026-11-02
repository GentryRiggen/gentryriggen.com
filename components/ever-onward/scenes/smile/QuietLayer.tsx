import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { QuietForkArt } from "./ForkArt";
import { Face, Robot, type Mood } from "./parts";

interface LayerProps {
  info: SmileSceneInfo;
}

const STARS: readonly (readonly [number, number])[] = [
  [30, 24],
  [90, 46],
  [150, 18],
  [250, 30],
  [320, 52],
  [370, 22],
  [60, 80],
  [290, 84],
  [120, 70],
  [230, 66],
];

const FACE_BY_STAGE: Record<SmileSceneInfo["face"], Mood> = {
  frown: "frown",
  flicker: "flat",
  warm: "smile",
  smile: "grin",
};

/** The far-off city: busy, bright and cheerful, and very small from here. */
function FarCity() {
  const lights = [10, 40, 66, 98, 140, 176, 232, 270, 306, 348];
  return (
    <g>
      <rect x="0" y="132" width="400" height="48" fill="#25305e" />
      {lights.map((x, i) => (
        <g key={x}>
          <rect
            x={x}
            y={116 + (i % 4) * 6}
            width="22"
            height={64 - (i % 4) * 6}
            fill="#2d3a72"
          />
          <rect
            x={x + 4}
            y={124 + (i % 4) * 6}
            width="4"
            height="4"
            fill="#ffd23f"
            fillOpacity="0.8"
          />
          <rect
            x={x + 12}
            y={132 + (i % 4) * 6}
            width="4"
            height="4"
            fill="#ffd23f"
            fillOpacity="0.8"
          />
        </g>
      ))}
      {/* A very faint smile, high on the skyline, that never switches off. */}
      <g className="ms-glow" fill="#ffe29a">
        <rect x="318" y="96" width="26" height="3" />
        <rect x="314" y="92" width="4" height="4" />
        <rect x="344" y="92" width="4" height="4" />
      </g>
    </g>
  );
}

function Stars({ extra }: { extra: number }) {
  const shown = STARS.slice(0, 4 + extra * 2);
  return (
    <g fill="#fff4cf">
      {shown.map(([x, y], i) => (
        <rect
          key={x}
          x={x}
          y={y}
          width="2"
          height="2"
          className={i % 2 ? "ms-twinkle" : "ms-twinkle-b"}
        />
      ))}
    </g>
  );
}

function Rain({ level }: { level: number }) {
  const drops = Array.from({ length: level * 4 }, (_, i) => i);
  return (
    <g fill="#9bd0ff">
      <g className="ms-rain">
        {drops
          .filter((i) => i % 2 === 0)
          .map((i) => (
            <rect
              key={i}
              x={20 + ((i * 47) % 360)}
              y={60 + ((i * 29) % 90)}
              width="2"
              height="6"
            />
          ))}
      </g>
      <g className="ms-rain-b">
        {drops
          .filter((i) => i % 2 === 1)
          .map((i) => (
            <rect
              key={i}
              x={20 + ((i * 53) % 360)}
              y={50 + ((i * 31) % 100)}
              width="2"
              height="6"
            />
          ))}
      </g>
    </g>
  );
}

function Tea({ cups }: { cups: number }) {
  const n = Math.min(4, Math.ceil(cups / 2));
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect
            x={272 + (i % 2) * 14}
            y={226 - Math.floor(i / 2) * 12}
            width="9"
            height="8"
            fill="#fff"
          />
          <rect
            x={281 + (i % 2) * 14}
            y={228 - Math.floor(i / 2) * 12}
            width="3"
            height="4"
            fill="#fff"
          />
          <g
            className={i % 2 ? "ms-steam" : "ms-puff"}
            fill="#fff"
            fillOpacity="0.7"
          >
            <rect
              x={275 + (i % 2) * 14}
              y={218 - Math.floor(i / 2) * 12}
              width="3"
              height="5"
            />
          </g>
        </g>
      ))}
    </g>
  );
}

function Candles({ count }: { count: number }) {
  const n = Math.min(4, Math.ceil(count / 2));
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <circle
            cx={106 + i * 16}
            cy={206}
            r="14"
            fill="#ffd23f"
            fillOpacity="0.14"
            className="ms-glow"
          />
          <rect x={104 + i * 16} y="200" width="5" height="14" fill="#fff4cf" />
          <rect
            x={105 + i * 16}
            y="193"
            width="3"
            height="7"
            fill="#ff9f43"
            className="ms-flame"
          />
        </g>
      ))}
    </g>
  );
}

function Kettle() {
  return (
    <g>
      <rect x="318" y="206" width="44" height="6" fill="#8a5a2b" />
      <rect x="322" y="212" width="4" height="22" fill="#5b3a1a" />
      <rect x="354" y="212" width="4" height="22" fill="#5b3a1a" />
      <rect x="328" y="190" width="22" height="16" fill="#9fb4cc" />
      <rect x="350" y="194" width="8" height="4" fill="#9fb4cc" />
      <rect x="332" y="186" width="14" height="4" fill="#5b6b82" />
      <g className="ms-steam" fill="#fff" fillOpacity="0.6">
        <rect x="358" y="184" width="3" height="6" />
      </g>
    </g>
  );
}

function Blanket({ level }: { level: number }) {
  const colors = ["#e07a5f", "#f2cc8f", "#81b29a", "#3d405b"];
  return (
    <g>
      <rect x="150" y="196" width="76" height="14" fill="#e07a5f" />
      {Array.from({ length: Math.min(4, Math.ceil(level / 2)) }, (_, i) => (
        <rect
          key={i}
          x={152 + i * 18}
          y="198"
          width="8"
          height="10"
          fill={colors[i]}
        />
      ))}
    </g>
  );
}

/** The Quiet: a bench at the edge of the cheer, and two who are not talking. */
export default function QuietLayer({ info }: LayerProps) {
  const mood = FACE_BY_STAGE[info.face];
  const robotX = info.extraB > 0 ? 204 : 232;
  return (
    <g>
      <defs>
        <linearGradient id="ms-sky-quiet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2150" />
          <stop offset="1" stopColor="#6b5b95" />
        </linearGradient>
      </defs>
      <rect x="-1200" y="-1200" width="2800" height="2700" fill="#2b2f55" />
      <rect x="0" y="0" width="400" height="180" fill="url(#ms-sky-quiet)" />
      <Stars extra={info.scaling} />
      <FarCity />
      <rect x="0" y="180" width="400" height="120" fill="#33406e" />
      <g className="ms-leaf" fill="#e0a458">
        <rect x="240" y="120" width="4" height="4" />
      </g>
      {/* A lamp over the bench, very gentle. */}
      <rect x="64" y="110" width="4" height="86" fill="#5b6b82" />
      <rect x="56" y="104" width="20" height="8" fill="#ffd23f" />
      <rect
        x="56"
        y="112"
        width="20"
        height="60"
        fill="#ffd23f"
        fillOpacity="0.08"
      />
      {/* The bench. */}
      <rect x="120" y="190" width="160" height="8" fill="#8a5a2b" />
      <rect x="120" y="170" width="160" height="6" fill="#a9703a" />
      <rect x="124" y="198" width="6" height="22" fill="#5b3a1a" />
      <rect x="270" y="198" width="6" height="22" fill="#5b3a1a" />
      <rect x="124" y="176" width="4" height="14" fill="#5b3a1a" />
      <rect x="272" y="176" width="4" height="14" fill="#5b3a1a" />
      {/* The friend. */}
      <rect x="160" y="170" width="24" height="26" fill="#7d93b0" />
      <g className="ms-blink">
        <Face x={158} y={148} size={28} mood={mood} fill="#ffd9a8" />
      </g>
      {info.b > 0 && <Blanket level={info.b} />}
      <Robot x={robotX} y={166} />
      {info.wanting && (
        <g className="ms-glow">
          <rect x="132" y="108" width="52" height="24" fill="#e8e2ff" />
          <rect x="164" y="132" width="8" height="6" fill="#e8e2ff" />
          <rect x="144" y="118" width="5" height="5" fill="#8a7fb8" />
          <rect x="156" y="118" width="5" height="5" fill="#8a7fb8" />
          <rect x="168" y="118" width="5" height="5" fill="#8a7fb8" />
        </g>
      )}
      {info.fork > 0 && <QuietForkArt side={info.fork === 1 ? 0 : 1} />}
      {info.a > 0 && <Tea cups={info.a} />}
      {info.d > 0 && <Candles count={info.d} />}
      {info.extraA > 0 && <Kettle />}
      {info.c > 0 && <Rain level={info.c} />}
      {info.visitorHere && (
        <g>
          <circle
            cx="172"
            cy="160"
            r="44"
            fill="#ffe29a"
            fillOpacity="0.2"
            className="ms-glow"
          />
          <g fill="#fff4cf">
            <rect x="130" y="124" width="3" height="3" className="ms-twinkle" />
            <rect
              x="214"
              y="132"
              width="3"
              height="3"
              className="ms-twinkle-b"
            />
            <rect x="196" y="110" width="3" height="3" className="ms-twinkle" />
          </g>
        </g>
      )}
    </g>
  );
}
