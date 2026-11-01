import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import {
  COTTAGE,
  DEPOT,
  FAR_LIGHT_GAP,
  FAR_LIGHT_X,
  LAMP,
  QUAY,
  TIDE,
} from "./anchors";
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
const DEPOT_HEIGHTS = [12, 17, 22] as const;

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

function Ship({
  row,
  cls,
  coins,
}: {
  row: number;
  cls: string;
  coins: number;
}) {
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
          {Array.from({ length: coins }, (_, i) => (
            <circle
              key={i}
              cx="8"
              cy={-8 - i * 4.5}
              r="2.6"
              fill="#ffd54a"
              stroke="#8a5a00"
              strokeWidth="0.8"
            />
          ))}
        </g>
      </g>
    </g>
  );
}

/** The far shore's trade: a fish market, a ferry landing, a cruise terminal. */
function Quay({ tier }: { tier: number }) {
  return (
    <g>
      {tier >= 1 && (
        <g transform={`translate(${QUAY.market} 190)`}>
          <g className="lm-pop-svg">
            <circle cy="-6" r="14" fill="url(#lm-lamp)" opacity="0.7" />
            <rect x="-8" y="-9" width="16" height="9" fill="#3a2e3b" />
            <polygon points="-10,-9 10,-9 8,-15 -8,-15" fill="#e0533d" />
            <polygon points="-3,-9 3,-9 2,-15 -2,-15" fill="#f4e9d0" />
            <rect x="-4" y="-6" width="8" height="4" fill="#ffd76a" />
          </g>
        </g>
      )}
      {tier >= 2 && (
        <g className="lm-pop-svg">
          <rect x="354" y="188" width="22" height="3" fill="#4a3f3a" />
          <g transform={`translate(${QUAY.ferry} 195)`}>
            <g className="lm-bob">
              <path d="M-11 -2 L11 -2 L8 3 L-8 3 Z" fill="#e8e3d0" />
              <rect x="-6" y="-8" width="12" height="6" fill="#3a82c4" />
              <rect x="-4" y="-6" width="3" height="2" fill="#ffd76a" />
              <rect x="1" y="-6" width="3" height="2" fill="#ffd76a" />
            </g>
          </g>
        </g>
      )}
      {tier >= 3 && (
        <g transform={`translate(${QUAY.terminal} 190)`}>
          <g className="lm-pop-svg">
            <circle cy="-12" r="18" fill="url(#lm-lamp)" opacity="0.6" />
            <rect x="-10" y="-22" width="20" height="22" fill="#2a3350" />
            <rect x="-12" y="-25" width="24" height="4" fill="#e9e4d6" />
            {[0, 1, 2].flatMap((col) =>
              [0, 1].map((row) => (
                <rect
                  key={`${col}-${row}`}
                  x={-8 + col * 6}
                  y={-18 + row * 8}
                  width="4"
                  height="4"
                  fill="#ffd76a"
                />
              ))
            )}
          </g>
        </g>
      )}
    </g>
  );
}

/** The oil depot on the shelf by the rock: the tank shows how much oil is left. */
function Depot({ info }: { info: LightSceneInfo }) {
  const height = DEPOT_HEIGHTS[Math.min(2, info.tankTier)];
  const top = DEPOT.y + 20 - height;
  return (
    <g transform="translate(0 -10)">
      <rect x="0" y="272" width="58" height="28" fill="#10172b" />
      <g className={info.tankTier > 0 ? "lm-pop-svg" : ""} key={info.tankTier}>
        <rect
          x="8"
          y={top}
          width="20"
          height={height}
          fill="#2a3350"
          stroke="#7fc8ff"
          strokeWidth="1.2"
        />
        <rect
          x="10"
          y={top + 2 + (height - 4) * (1 - info.oilFraction)}
          width="16"
          height={(height - 4) * info.oilFraction}
          fill="#ffb347"
        />
        <rect x="7" y={top - 2} width="22" height="3" fill="#5b6a8c" />
      </g>
      {info.tankTier > 0 &&
        Array.from({ length: info.tankTier }, (_, i) => (
          <rect
            key={i}
            x={10 + i * 5}
            y="266"
            width="4"
            height="6"
            fill="#c0602a"
            stroke="#ffb347"
            strokeWidth="0.6"
          />
        ))}
      {info.trainTier >= 2 && (
        <g className="lm-pop-svg">
          <rect x="34" y="258" width="20" height="14" fill="#e9e4d6" />
          <polygon points="32,258 56,258 44,250" fill="#b7413b" />
          <rect x="40" y="263" width="8" height="9" fill="#2a3350" />
          <circle
            cx="44"
            cy="248"
            r="2.6"
            fill="#5ec8ff"
            className="lm-twinkle"
          />
        </g>
      )}
    </g>
  );
}

/** Keepers in front of the cottage, a flag on its roof once the crew drills. */
function Crew({ keepers, drills }: { keepers: number; drills: number }) {
  return (
    <g>
      {Array.from({ length: keepers }, (_, i) => (
        <g key={i} transform={`translate(${COTTAGE.x - 4 + i * 9} 249)`}>
          <g className="lm-pop-svg">
            <rect x="-2" y="-8" width="4" height="8" fill="#f4b860" />
            <circle cy="-10.5" r="2.4" fill="#ffd9b0" />
            <circle cx="4" cy="-4" r="1.6" fill="#ffe28a" />
          </g>
        </g>
      ))}
      {drills >= 1 && (
        <g className="lm-pop-svg">
          <line
            x1="156"
            y1="226"
            x2="156"
            y2="211"
            stroke="#e9e4d6"
            strokeWidth="1.2"
          />
          <polygon points="156,211 168,214 156,218" fill="#ff8a3a" />
        </g>
      )}
    </g>
  );
}

function RescueBoats() {
  return (
    <g className="lm-pop-svg">
      {[215, 252].map((x, i) => (
        <g key={x} transform={`translate(${x} ${270 + i * 8})`}>
          <g className="lm-bob">
            <path d="M-12 -2 L12 -2 L8 4 L-8 4 Z" fill="#ff7a2e" />
            <rect x="-5" y="-9" width="9" height="7" fill="#f4f1e8" />
            <circle cy="-12" r="3" fill="#5ec8ff" className="lm-twinkle" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Tanker() {
  return (
    <g transform="translate(304 290)">
      <g className="lm-pop-svg">
        <g className="lm-bob">
          <path d="M-18 -3 L18 -3 L13 5 L-13 5 Z" fill="#7a2f2b" />
          {[-9, 0, 9].map((x) => (
            <rect
              key={x}
              x={x - 3}
              y="-10"
              width="6"
              height="7"
              fill="#c0602a"
              stroke="#ffb347"
              strokeWidth="0.6"
            />
          ))}
          <line x1="14" y1="-3" x2="14" y2="-16" stroke="#e9e4d6" />
          <polygon points="14,-16 22,-13 14,-10" fill="#ffd54a" />
        </g>
      </g>
    </g>
  );
}

/** Rings of glass in front of the lamp, one for each lens. */
function LensRings({ lenses }: { lenses: number }) {
  const angle = 0.75;
  return (
    <g>
      {Array.from({ length: lenses }, (_, i) => {
        const r = 12 + i * 4;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        return (
          <path
            key={i}
            d={`M${x} ${-y} A${r} ${r} 0 0 1 ${x} ${y}`}
            fill="none"
            stroke="#bff1ff"
            strokeOpacity="0.85"
            strokeWidth="1.3"
            className="lm-pop-svg"
          />
        );
      })}
    </g>
  );
}

/** The tide clock by the rock: a tide pole the water climbs, nets and a mill. */
function Tide({ info }: { info: LightSceneInfo }) {
  const isFull = info.nets >= 2;
  const rise = 5 + info.tideLevel * 19;
  return (
    <g data-testid="lm-tide" data-level={info.tideLevel} data-nets={info.nets}>
      <g transform={`translate(${TIDE.poleX} ${TIDE.y})`}>
        <rect x="-1.5" y="-30" width="3" height="32" fill="#8a5a2b" />
        {[-24, -16, -8].map((y) => (
          <rect key={y} x="-4" y={y} width="8" height="1.2" fill="#e9e4d6" />
        ))}
        <rect
          x="-13"
          y={-rise}
          width="26"
          height={rise + 4}
          fill="#5ec8ff"
          fillOpacity="0.4"
        />
        <line
          x1="-13"
          x2="13"
          y1={-rise}
          y2={-rise}
          stroke="#e0f7ff"
          strokeWidth="1.2"
        />
      </g>
      {info.tideMill > 0 && (
        <g transform={`translate(${TIDE.millX} ${TIDE.y})`}>
          <g className="lm-pop-svg">
            <rect x="-9" y="-12" width="18" height="12" fill="#3a2e3b" />
            <polygon points="-11,-12 11,-12 0,-20" fill="#b7413b" />
            <rect x="-6" y="-8" width="5" height="8" fill="#ffd76a" />
            <g transform="translate(8 -6)">
              <g className="lm-wheel">
                <circle r="7" fill="none" stroke="#c9a66b" strokeWidth="1.4" />
                <path
                  d="M-7 0 H7 M0 -7 V7 M-5 -5 L5 5 M-5 5 L5 -5"
                  stroke="#c9a66b"
                  strokeWidth="1"
                />
              </g>
            </g>
          </g>
        </g>
      )}
      {info.nets > 0 && (
        <g transform={`translate(${TIDE.netsX} ${TIDE.y})`}>
          <g className="lm-pop-svg">
            {Array.from({ length: info.biggerNets > 0 ? 2 : 1 }, (_, n) => (
              <g key={n} transform={`translate(${n * 34} ${n * -3})`}>
                <path
                  d="M0 -2 Q14 12 28 -2"
                  fill={isFull ? "#bff1ff" : "none"}
                  fillOpacity="0.3"
                  stroke="#dfe8ff"
                  strokeWidth="1"
                  strokeDasharray="2 1.4"
                />
                {[0, 28].map((bx) => (
                  <g key={bx} transform={`translate(${bx} -2)`}>
                    <g className="lm-bob">
                      <circle
                        r="2.8"
                        fill="#ff7a2e"
                        stroke="#fff3b0"
                        strokeWidth="0.8"
                      />
                    </g>
                  </g>
                ))}
                {isFull &&
                  [6, 13, 20].map((fx, i) => (
                    <g
                      key={fx}
                      transform={`translate(${fx} ${3 + (i % 2) * 2})`}
                    >
                      <g className="lm-twinkle">
                        <ellipse rx="3" ry="1.5" fill="#fde68a" />
                        <polygon points="3,0 5.5,-1.6 5.5,1.6" fill="#fde68a" />
                      </g>
                    </g>
                  ))}
              </g>
            ))}
          </g>
        </g>
      )}
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
      <Quay tier={info.dockTier} />
      {Array.from({ length: farCount }, (_, i) => (
        <g
          key={i}
          transform={`translate(${FAR_LIGHT_X + i * FAR_LIGHT_GAP} 190) scale(0.3)`}
        >
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
        <Ship
          key={i}
          row={SHIP_ROWS[i]}
          cls={SHIP_CLASSES[i]}
          coins={info.feesTier}
        />
      ))}
      {info.contract > 0 && <Tanker />}
      {info.trainTier >= 3 && <RescueBoats />}
      {/* the main lighthouse, its rock and the keepers' cottage */}
      <Depot info={info} />
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
      <Crew keepers={windows} drills={info.trainTier} />
      <rect x="97" y="130" width="26" height="5" fill="#2b2f3d" />
      <rect x="103" y="114" width="14" height="16" fill="#ffd76a" />
      <polygon points="100,114 120,114 110,102" fill="#2b2f3d" />
      {info.tideOpen > 0 && <Tide info={info} />}
      {info.wickTier >= 1 && (
        <ellipse
          cx="110"
          cy="123"
          rx="2.6"
          ry="5.5"
          fill="#fffbe0"
          className="lm-flicker"
        />
      )}
      {info.wickTier >= 2 && (
        <g className="lm-pop-svg">
          <rect x="102" y="128" width="16" height="3" fill="#d9a441" />
          <rect x="96" y="129" width="28" height="2" fill="#d9a441" />
        </g>
      )}
      {info.shuttersTier >= 1 && (
        <g className="lm-pop-svg">
          <rect x="98" y="113" width="5" height="18" fill="#2f5d7a" />
          <rect x="117" y="113" width="5" height="18" fill="#2f5d7a" />
        </g>
      )}
      {info.shuttersTier >= 2 && (
        <path
          d="M101 131 L101 118 Q110 98 119 118 L119 131 Z"
          fill="#7fe0ff"
          fillOpacity="0.2"
          stroke="#bff1ff"
          strokeWidth="1.2"
          className="lm-pop-svg"
        />
      )}
      <g transform={`translate(${LAMP.x} ${LAMP.y})`}>
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
        <LensRings lenses={info.lensLevel} />
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
