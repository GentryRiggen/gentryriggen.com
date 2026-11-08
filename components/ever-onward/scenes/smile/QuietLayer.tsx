import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { QuietForkArt } from "./ForkArt";
import BenchLayer, { BenchRoad } from "./BenchLayer";
import { Face, INK, type Mood } from "./parts";

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
          <rect x={300 + i * 14} y="268" width="9" height="8" fill="#fff" />
          <rect x={309 + i * 14} y="270" width="3" height="4" fill="#fff" />
          <g
            className={i % 2 ? "ms-steam" : "ms-puff"}
            fill="#fff"
            fillOpacity="0.7"
          >
            <rect x={303 + i * 14} y="260" width="3" height="5" />
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
            cx={36 + i * 16}
            cy={270}
            r="14"
            fill="#ffd23f"
            fillOpacity="0.14"
            className="ms-glow"
          />
          <rect x={34 + i * 16} y="264" width="5" height="14" fill="#fff4cf" />
          <rect
            x={35 + i * 16}
            y="257"
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

/** A blanket over the friend's knees. */
function Blanket({ level }: { level: number }) {
  const colors = ["#e07a5f", "#f2cc8f", "#81b29a", "#3d405b"];
  return (
    <g>
      <rect x="284" y="194" width="62" height="16" fill="#e07a5f" />
      {Array.from({ length: Math.min(4, Math.ceil(level / 2)) }, (_, i) => (
        <rect
          key={i}
          x={288 + i * 14}
          y="196"
          width="8"
          height="12"
          fill={colors[i]}
        />
      ))}
    </g>
  );
}

/** Who is real: the order the crowd's real smiles are given out in. */
const CROWD_X = [30, 80, 130, 180, 230, 280, 330] as const;
const REAL_ORDER = [3, 0, 5, 2, 6, 1, 4] as const;
/** How many of the seven far-off faces are real, by the quarter of smiles kept. */
const REAL_BY_BAND = [1, 3, 5, 7] as const;

/** A painted-on smile: the same wide grin, stiff, never crinkling at the eyes. */
function PaintedFace({ x, y }: { x: number; y: number }) {
  return (
    <g data-crowd="painted" transform={`translate(${x} ${y})`}>
      <rect x="1" y="0" width="12" height="14" fill="#efe3cf" />
      <rect x="0" y="1" width="14" height="12" fill="#efe3cf" />
      <rect x="3" y="4" width="2" height="2" fill={INK} />
      <rect x="9" y="4" width="2" height="2" fill={INK} />
      <rect x="2" y="8" width="10" height="3" fill="#fff" stroke={INK} />
    </g>
  );
}

/** The far side of the road: real smiles crinkle and bob, painted ones stay put. */
function Crowd({ kept }: { kept: number }) {
  const realCount = REAL_BY_BAND[kept];
  return (
    <g aria-hidden="true" data-testid="eo-quiet-crowd" data-kept={kept}>
      {CROWD_X.map((x, i) => {
        const isReal = REAL_ORDER.indexOf(i as 0) < realCount;
        return (
          <g key={x}>
            <rect x={x} y="158" width="14" height="14" fill="#3d4a7a" />
            {isReal ? (
              <g className={i % 2 ? "ms-bob" : "ms-bob-b"} data-crowd="real">
                <Face x={x} y={144} size={14} mood="smile" />
              </g>
            ) : (
              <PaintedFace x={x} y={144} />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The Quiet: a long bench at the edge of the cheer, and two who are not talking. */
export default function QuietLayer({ info }: LayerProps) {
  const mood = FACE_BY_STAGE[info.face];
  return (
    <g>
      <defs>
        <linearGradient id="ms-sky-quiet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2150" />
          <stop offset="1" stopColor="#6b5b95" />
        </linearGradient>
      </defs>
      <rect x="-1200" y="-1200" width="2800" height="2700" fill="#2b2f55" />
      <rect x="-1200" y="-1200" width="2800" height="1380" fill="#1a2150" />
      <rect x="0" y="0" width="400" height="180" fill="url(#ms-sky-quiet)" />
      <Stars extra={info.scaling} />
      <FarCity />
      {/* The road behind the bench, where trucks go by. */}
      <rect x="-1200" y="176" width="2800" height="22" fill="#3a3f63" />
      <g fill="#8d93b8">
        {[-60, 20, 100, 180, 260, 340, 420].map((x) => (
          <rect key={x} x={x} y="186" width="36" height="3" />
        ))}
      </g>
      <Crowd kept={info.kept} />
      <BenchRoad info={info} />
      <rect x="-1200" y="198" width="2800" height="120" fill="#33406e" />
      <g className="ms-leaf" fill="#e0a458">
        <rect x="240" y="120" width="4" height="4" />
      </g>
      {/* A lamp over the bench, very gentle. */}
      <rect x="14" y="96" width="5" height="120" fill="#5b6b82" />
      <rect x="4" y="88" width="26" height="9" fill="#ffd23f" />
      <rect
        x="4"
        y="97"
        width="26"
        height="80"
        fill="#ffd23f"
        fillOpacity="0.1"
      />
      {/* The bench: a long back, a long seat. */}
      <rect x="30" y="172" width="340" height="8" fill="#a9703a" />
      <rect x="30" y="184" width="340" height="6" fill="#8a5a2b" />
      <rect x="34" y="172" width="6" height="52" fill="#5b3a1a" />
      <rect x="360" y="172" width="6" height="52" fill="#5b3a1a" />
      <rect x="30" y="214" width="340" height="9" fill="#8a5a2b" />
      <rect x="30" y="223" width="340" height="3" fill="#5b3a1a" />
      <rect x="40" y="226" width="8" height="26" fill="#5b3a1a" />
      <rect x="352" y="226" width="8" height="26" fill="#5b3a1a" />
      {info.extraB > 0 && (
        <rect x="140" y="210" width="130" height="5" fill="#e07a5f" />
      )}
      <BenchLayer info={info} mood={mood} />
      {info.b > 0 && <Blanket level={info.b} />}
      {info.fork > 0 && <QuietForkArt side={info.fork === 1 ? 0 : 1} />}
      {info.a > 0 && <Tea cups={info.a} />}
      {info.d > 0 && <Candles count={info.d} />}
      {info.c > 0 && <Rain level={info.c} />}
      {info.visitorHere && (
        <g>
          <circle
            cx="312"
            cy="130"
            r="60"
            fill="#ffe29a"
            fillOpacity="0.25"
            className="ms-glow"
          />
          <g fill="#fff4cf">
            <rect x="270" y="96" width="4" height="4" className="ms-twinkle" />
            <rect
              x="354"
              y="104"
              width="4"
              height="4"
              className="ms-twinkle-b"
            />
            <rect x="330" y="82" width="4" height="4" className="ms-twinkle" />
          </g>
        </g>
      )}
    </g>
  );
}
