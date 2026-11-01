import type { LightSceneInfo } from "@/lib/little-machines/universes/light";
import { makeStars } from "./random";

const SHIP_CLASSES = [
  "lm-ship-a",
  "lm-ship-b",
  "lm-ship-c",
  "lm-ship-d",
  "lm-ship-e",
  "lm-ship-f",
  "lm-ship-g",
  "lm-ship-h",
] as const;
/** Where each ship sails (y), so they spread over the sea. */
const SHIP_ROWS = [216, 238, 258, 226, 276, 246, 206, 266] as const;
const RAIN_CLASSES = ["lm-rain", "lm-rain-b", "lm-rain-c"] as const;
const COAST_STARS = makeStars(11, 16);
const RAIN = Array.from({ length: 22 }, (_, i) => ({
  x: -30 + ((i * 53) % 460),
  y: 20 + ((i * 37) % 160),
  cls: RAIN_CLASSES[i % 3],
}));
const FAR_LIGHTHOUSES = 7;

function visibleShips(info: LightSceneInfo): number {
  const fromLenses = Math.floor(Math.log2(1 + info.shipsPerFlash) * 1.2);
  const crew = info.keepers > 0 ? 1 : 0;
  return Math.min(SHIP_ROWS.length, 1 + fromLenses + crew);
}

function keeperWindows(keepers: number): number {
  if (keepers <= 0) return 0;
  if (keepers < 3) return 1;
  if (keepers < 10) return 2;
  return 3;
}

function Ship({ row, cls }: { row: number; cls: string }) {
  const scale = 0.5 + (row - 200) / 110;
  return (
    <g transform={`translate(230 ${row}) scale(${scale})`}>
      <g className={cls}>
        <g className="lm-bob">
          <circle cy="-26" r="7" fill="url(#lm-lamp)" opacity="0.6" />
          <polygon points="0,-26 0,-3 13,-3" fill="#e8e3d0" />
          <polygon points="-2,-22 -2,-3 -11,-3" fill="#cfc9b4" />
          <path d="M-15 -2 L15 -2 L10 5 L-10 5 Z" fill="#2a3350" />
          <circle cy="-27" r="1.6" fill="#ffd76a" />
        </g>
      </g>
    </g>
  );
}

export default function CoastLayer({ info }: { info: LightSceneInfo }) {
  const isStorm = info.storm > 0;
  const beamOpacity = 0.25 + 0.6 * info.beam;
  const halfWidth = 8 + 34 * info.beam;
  const length = 220 + 110 * info.beam;
  const windows = keeperWindows(info.keepers);
  const farCount = Math.min(FAR_LIGHTHOUSES, Math.max(0, info.lighthouses - 1));
  const ships = visibleShips(info);

  return (
    <g>
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="1390"
        fill="url(#lm-coast-sky)"
      />
      <rect x="-1200" y="190" width="2800" height="1200" fill="url(#lm-sea)" />
      {COAST_STARS.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y * 0.5}
          r={s.r}
          fill="#dfe8ff"
          className={s.twinkle}
        />
      ))}
      <circle cx="334" cy="46" r="13" fill="#eef2ff" opacity="0.92" />
      <circle cx="334" cy="46" r="34" fill="url(#lm-lamp)" opacity="0.25" />
      {/* far coast and the lighthouses that light it */}
      <path
        d="M170 190 Q200 183 235 187 T300 186 T360 188 L460 190 Z"
        fill="#070d1c"
      />
      {Array.from({ length: farCount }, (_, i) => (
        <g key={i} transform={`translate(${190 + i * 27} 190) scale(0.26)`}>
          <g className="lm-pop-svg">
            <use href="#lm-mini" />
            <circle cy="-123" r="30" fill="url(#lm-lamp)" opacity="0.85" />
            <polygon
              points="0,-123 380,-160 380,-86"
              fill="url(#lm-beam)"
              opacity="0.32"
            />
          </g>
        </g>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={20 + i * 80}
          y={202 + i * 18}
          width={30 + i * 6}
          height="1"
          fill="#9bc3ff"
          opacity="0.18"
        />
      ))}
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="2800"
        fill="#04060d"
        className={`transition-opacity duration-1000 ${isStorm ? "opacity-60" : "opacity-0"}`}
      />
      {Array.from({ length: ships }, (_, i) => (
        <Ship key={i} row={SHIP_ROWS[i]} cls={SHIP_CLASSES[i]} />
      ))}
      {/* the main lighthouse, its rock and the keepers' cottage */}
      <path
        d="M52 300 Q66 256 92 249 L140 249 Q166 258 178 300 Z"
        fill="#10172b"
      />
      <g transform="translate(0 0)">
        <rect x="132" y="236" width="28" height="13" fill="#232a44" />
        <polygon points="129,236 163,236 146,225" fill="#3a2e3b" />
        {Array.from({ length: windows }, (_, i) => (
          <rect
            key={i}
            x={136 + i * 8}
            y="240"
            width="4"
            height="5"
            fill="#ffd76a"
          />
        ))}
      </g>
      <polygon points="97,249 123,249 118,135 102,135" fill="#e9e4d6" />
      <polygon points="100,205 120,205 119,190 101,190" fill="#b7413b" />
      <polygon points="104,165 116,165 115,150 105,150" fill="#b7413b" />
      {[222, 176].map((y, i) => (
        <rect
          key={y}
          x="107.5"
          y={y}
          width="5"
          height="8"
          fill={i < windows ? "#ffd76a" : "#3a3f52"}
        />
      ))}
      <rect x="97" y="130" width="26" height="5" fill="#2b2f3d" />
      <rect x="103" y="114" width="14" height="16" fill="#ffd76a" />
      <polygon points="100,114 120,114 110,102" fill="#2b2f3d" />
      <g transform="translate(110 122)">
        <g className="lm-sweep" opacity={beamOpacity}>
          <polygon
            points={`0,0 ${length},${-halfWidth} ${length},${halfWidth}`}
            fill="url(#lm-beam)"
          />
          <g transform="scale(-1 1)">
            <polygon
              points={`0,0 ${length},${-halfWidth} ${length},${halfWidth}`}
              fill="url(#lm-beam)"
            />
          </g>
        </g>
        <circle r={22 + 10 * info.beam} fill="url(#lm-lamp)" />
      </g>
      {/* storm: rain and lightning (the darker sky is drawn behind the ships) */}
      {isStorm && (
        <g>
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="2800"
            fill="#dbeafe"
            className="lm-lightning"
          />
          {RAIN.map((r, i) => (
            <g key={i} transform={`translate(${r.x} ${r.y})`}>
              <line
                className={r.cls}
                x1="0"
                y1="0"
                x2="-3"
                y2="13"
                stroke="#a9bde8"
                strokeWidth="1"
                strokeOpacity="0.7"
              />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
