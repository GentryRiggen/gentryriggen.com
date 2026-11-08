import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { WorldForkArt } from "./ForkArt";
import { INK, PixelText } from "./parts";
import WorldFaces from "./WorldFaces";
import WorldMoments from "./WorldMoments";

interface LayerProps {
  info: SmileSceneInfo;
}

const WALLS: readonly (readonly [number, number, number, string])[] = [
  [4, 92, 70, "#d9d2e9"],
  [80, 74, 80, "#e8dcc8"],
  [166, 100, 66, "#cfe0e8"],
  [238, 80, 74, "#ead1dc"],
  [318, 96, 80, "#d9ead3"],
];

const POSTER_SPOTS: readonly (readonly [number, number])[] = [
  [14, 110],
  [96, 94],
  [128, 94],
  [176, 118],
  [250, 98],
  [282, 98],
  [330, 114],
  [362, 114],
];

const TOWER_SPOTS: readonly (readonly [number, number])[] = [
  [58, 40],
  [214, 30],
  [300, 48],
  [150, 56],
  [374, 52],
  [20, 56],
];

const SPEAKER_SPOTS: readonly (readonly [number, number])[] = [
  [72, 150],
  [160, 156],
  [232, 150],
  [312, 156],
  [118, 162],
  [358, 160],
];

function Walls() {
  return (
    <g>
      {WALLS.map(([x, y, w, color]) => (
        <g key={x}>
          <rect x={x} y={y} width={w} height={178 - y} fill={color} />
          <rect x={x} y={y} width={w} height="5" fill="#b9b2c9" />
        </g>
      ))}
    </g>
  );
}

/** Posters: big smiling faces. All the pupils turn together, to watch you. */
function Posters({ count, brush }: { count: number; brush: number }) {
  const spots = POSTER_SPOTS.slice(0, Math.min(8, count));
  const wide = 10 + brush * 2;
  return (
    <g>
      {spots.map(([x, y]) => (
        <g key={x}>
          <rect x={x} y={y} width="28" height="34" fill="#ffd1dc" />
          <rect x={x + 2} y={y + 2} width="24" height="30" fill="#fff4f6" />
          <circle
            cx={x + 9}
            cy={y + 12}
            r="4"
            fill="#fff"
            stroke={INK}
            strokeWidth="1"
          />
          <circle
            cx={x + 19}
            cy={y + 12}
            r="4"
            fill="#fff"
            stroke={INK}
            strokeWidth="1"
          />
        </g>
      ))}
      <g className="ms-eyes" fill={INK}>
        {spots.flatMap(([x, y]) => [
          <rect key={`${x}a`} x={x + 8} y={y + 11} width="3" height="3" />,
          <rect key={`${x}b`} x={x + 18} y={y + 11} width="3" height="3" />,
        ])}
      </g>
      <g className="ms-grin" fill="#e23b5a">
        {spots.map(([x, y]) => (
          <rect
            key={x}
            x={x + 14 - wide / 2}
            y={y + 22}
            width={wide}
            height="5"
          />
        ))}
      </g>
    </g>
  );
}

function Towers({ count }: { count: number }) {
  return (
    <g>
      {TOWER_SPOTS.slice(0, Math.min(6, count)).map(([x, y], i) => (
        <g key={x}>
          <rect x={x} y={y} width="6" height={178 - y} fill="#9aa5b8" />
          <rect x={x - 5} y={y - 6} width="16" height="8" fill="#ff5d73" />
          <rect x={x - 1} y={y + 20} width="8" height="3" fill="#ffe29a" />
          {i < 2 && (
            <circle
              cx={x + 3}
              cy={y - 2}
              r="8"
              fill="none"
              stroke="#ff9eb0"
              strokeWidth="2"
              className={i ? "ms-ring-b" : "ms-ring"}
            />
          )}
        </g>
      ))}
    </g>
  );
}

function Speakers({ count }: { count: number }) {
  return (
    <g>
      {SPEAKER_SPOTS.slice(0, Math.min(6, count)).map(([x, y], i) => (
        <g key={x}>
          <rect x={x} y={y} width="3" height={178 - y} fill="#5b6b82" />
          <rect x={x - 8} y={y - 8} width="20" height="9" fill="#ffd23f" />
          <rect x={x - 12} y={y - 10} width="6" height="13" fill="#ff9f43" />
          {i < 2 && (
            <circle
              cx={x - 12}
              cy={y - 4}
              r="8"
              fill="none"
              stroke="#ffd23f"
              strokeWidth="2"
              className={i ? "ms-ring-b" : "ms-ring"}
            />
          )}
        </g>
      ))}
    </g>
  );
}

function Blimps({ count }: { count: number }) {
  const n = Math.min(3, count);
  return (
    <g className="ms-drift">
      {Array.from({ length: n }, (_, i) => (
        <g
          key={i}
          transform={`translate(${70 + i * 110} ${22 + (i % 2) * 14})`}
        >
          <rect x="0" y="4" width="56" height="18" fill="#dfe6f0" />
          <rect x="6" y="0" width="44" height="4" fill="#dfe6f0" />
          <rect x="6" y="22" width="44" height="4" fill="#dfe6f0" />
          <rect x="12" y="8" width="6" height="6" fill="#fff" />
          <rect x="24" y="8" width="6" height="6" fill="#fff" />
          <rect x="14" y="10" width="3" height="3" fill={INK} />
          <rect x="26" y="10" width="3" height="3" fill={INK} />
          <rect x="14" y="16" width="26" height="4" fill="#e23b5a" />
          <rect x="52" y="0" width="8" height="6" fill="#aeb8c9" />
          <rect x="22" y="26" width="12" height="5" fill="#8a94a6" />
        </g>
      ))}
    </g>
  );
}

function MaskBooth({ level }: { level: number }) {
  return (
    <g>
      <rect x="300" y="200" width="70" height="4" fill="#8a5a2b" />
      {Array.from({ length: level * 3 }, (_, i) => (
        <g key={i}>
          <rect
            x={304 + (i % 6) * 10}
            y={i < 6 ? 186 : 170}
            width="8"
            height="12"
            fill="#fff"
          />
          <rect
            x={306 + (i % 6) * 10}
            y={(i < 6 ? 186 : 170) + 7}
            width="4"
            height="2"
            fill="#e23b5a"
          />
        </g>
      ))}
      <rect x="296" y="168" width="3" height="36" fill="#8a5a2b" />
      <rect x="372" y="168" width="3" height="36" fill="#8a5a2b" />
    </g>
  );
}

function Sign() {
  return (
    <g>
      <rect
        x="84"
        y="182"
        width="232"
        height="26"
        fill="#fff4f6"
        stroke="#e23b5a"
        strokeWidth="3"
      />
      <PixelText x={200} y={200} fill="#e23b5a">
        NO BAD DAYS
      </PixelText>
    </g>
  );
}

function Satellite() {
  return (
    <g>
      <g className="ms-drift">
        <rect x="170" y="6" width="18" height="12" fill="#c7d6e8" />
        <rect x="150" y="9" width="18" height="6" fill="#4cc9f0" />
        <rect x="190" y="9" width="18" height="6" fill="#4cc9f0" />
        <rect x="177" y="2" width="4" height="4" fill="#ffd23f" />
      </g>
      <g className="ms-glow" fill="#ffe29a" fillOpacity="0.5">
        <rect x="186" y="20" width="12" height="60" />
      </g>
    </g>
  );
}

function Broadcast() {
  return (
    <g fill="none" stroke="#ffd23f" strokeWidth="3">
      <circle cx="200" cy="120" r="30" className="ms-ring" />
      <circle cx="200" cy="120" r="30" className="ms-ring-b" />
    </g>
  );
}

/** The World: posters, loudspeakers and towers, and everyone smiling. */
export default function WorldLayer({ info }: LayerProps) {
  return (
    <g>
      <defs>
        <linearGradient id="ms-sky-world" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d8f5" />
          <stop offset="1" stopColor="#f6efe2" />
        </linearGradient>
      </defs>
      <rect x="-1200" y="-1200" width="2800" height="2700" fill="#d8d2c4" />
      <rect x="0" y="0" width="400" height="180" fill="url(#ms-sky-world)" />
      <Walls />
      <rect x="0" y="178" width="400" height="122" fill="#e2dccd" />
      {info.d > 0 && <Blimps count={info.d} />}
      {info.c > 0 && <Towers count={info.c} />}
      {info.b > 0 && <Speakers count={info.b} />}
      {info.a > 0 && <Posters count={info.a} brush={info.scaling} />}
      {info.fork > 0 && <WorldForkArt side={info.fork === 1 ? 0 : 1} />}
      {info.extraA > 0 && <MaskBooth level={info.extraA} />}
      {info.extraB > 0 && <Sign />}
      {info.ended && <Satellite />}
      {info.parade && <Broadcast />}
      {(info.projects & 1) !== 0 && (
        <g>
          <rect x="344" y="136" width="30" height="16" fill="#fff" />
          <rect x="358" y="140" width="2" height="6" fill={INK} />
          <rect x="358" y="144" width="5" height="2" fill={INK} />
        </g>
      )}
      <WorldFaces info={info} />
      <WorldMoments info={info} />
    </g>
  );
}
