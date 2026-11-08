import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import ForkArt from "./ForkArt";
import {
  COTTAGE,
  DEPOT,
  FAR_LIGHT_GAP,
  FAR_LIGHT_X,
  LAMP,
  QUAY,
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

/** Ships on the water: more with each lens and a full crew (at most the six slots). */
function visibleShips(info: LightSceneInfo): number {
  const crew = info.keepers >= 10 ? 1 : 0;
  return Math.min(HARBOR_SLOTS.length, 2 + info.lensLevel + crew);
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

/** Fill classes, one per tenth (full class names, so Tailwind sees each). */
const FILL = [
  "scale-y-[0.04]",
  "scale-y-[0.1]",
  "scale-y-[0.2]",
  "scale-y-[0.3]",
  "scale-y-[0.4]",
  "scale-y-[0.5]",
  "scale-y-[0.6]",
  "scale-y-[0.7]",
  "scale-y-[0.8]",
  "scale-y-[0.9]",
  "scale-y-100",
] as const;

/**
 * The oil depot on the shelf by the rock: a tank that shows how much oil is
 * left, filling when barrels land, with a bigger tank for each tank upgrade.
 */
function Depot({ info }: { info: LightSceneInfo }) {
  const height = DEPOT_HEIGHTS[Math.min(2, info.tankTier)];
  const top = DEPOT.y + 20 - height;
  const tenths = Math.round(info.oilFraction * 10);
  const fill = FILL[Math.min(10, Math.max(0, tenths))];
  const fillHeight = height - 4;
  return (
    <g transform="translate(0 -26)">
      <rect x="0" y="272" width="58" height="60" fill="#10172b" />
      <g className={info.tankTier > 0 ? "lm-pop-svg" : ""} key={info.tankTier}>
        {info.barrels > 0 && (
          <rect
            x="2"
            y={top - 8}
            width="32"
            height={height + 12}
            fill="#ffb347"
            className="lc-tank-glow"
          />
        )}
        <rect
          x="6"
          y={top}
          width="24"
          height={height}
          fill="#2a3350"
          stroke="#7fc8ff"
          strokeWidth="1.4"
        />
        <g transform={`translate(8 ${top + 2})`}>
          <rect
            x="0"
            y="0"
            width="20"
            height={fillHeight}
            fill="#ffb347"
            data-testid="lm-tank-fill"
            data-level={tenths}
            className={`origin-bottom transition-transform duration-[1500ms] ease-out [transform-box:fill-box] ${fill}`}
          />
        </g>
        <rect x="5" y={top - 2} width="26" height="3" fill="#5b6a8c" />
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
      {info.contract > 0 && (
        <g transform="translate(40 262)">
          <g className="lm-pop-svg">
            <rect
              x="0"
              y="0"
              width="9"
              height="10"
              rx="2"
              fill="#c0602a"
              stroke="#ffb347"
              strokeWidth="0.7"
            />
            <rect x="0" y="3" width="9" height="1.2" fill="#ffb347" />
          </g>
        </g>
      )}
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
        <g
          key={i}
          transform={`translate(${COTTAGE.x - 4 + (i % 5) * 8} ${249 + Math.floor(i / 5) * 9})`}
        >
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

/**
 * Where the harbor's six ships sail: the row (y), where each ties up (x) and
 * when it arrives. On a phone the picture is small and the bottom is under
 * the caption, so every ship sails in the upper part of the sea (y 200-250).
 */
const HARBOR_SLOTS = [
  { row: 214, dock: 214, delay: "[animation-delay:0s]" },
  { row: 232, dock: 236, delay: "[animation-delay:-2.4s]" },
  { row: 246, dock: 222, delay: "[animation-delay:-4.8s]" },
  { row: 206, dock: 248, delay: "[animation-delay:-7.1s]" },
  { row: 224, dock: 256, delay: "[animation-delay:-9.5s]" },
  { row: 240, dock: 244, delay: "[animation-delay:-11.8s]" },
] as const;
/** Where ships turn away (the sea road to the rival, x). */
const SHIP_X = 250;
/** Ships are drawn this much bigger than the old drifters, to read on a phone. */
const SHIP_SIZE = 1.45;

const shipScale = (row: number): number =>
  (0.55 + (row - 200) / 110) * SHIP_SIZE;

/** One ship's hull and sails. */
function ShipBody({ isDark = false }: { isDark?: boolean }) {
  return (
    <g>
      {!isDark && <circle cy="-26" r="7" fill="url(#lm-lamp)" opacity="0.6" />}
      <polygon
        points="0,-26 0,-3 13,-3"
        fill={isDark ? "#d8d4c4" : "#e8e3d0"}
      />
      <polygon
        points="-2,-22 -2,-3 -11,-3"
        fill={isDark ? "#b9b5a3" : "#cfc9b4"}
      />
      <path d="M-15 -2 L15 -2 L10 5 L-10 5 Z" fill="#2a3350" />
      {!isDark && <circle cy="-27" r="1.6" fill="#ffd76a" />}
    </g>
  );
}

/** A ship that chose your harbor: it sails in, ties up and pays, coins popping. */
function DockShip({
  slot,
  step,
}: {
  slot: (typeof HARBOR_SLOTS)[number];
  step: number;
}) {
  const coins = 1 + (step >= 3 ? 1 : 0) + (step >= 4 ? 1 : 0);
  const radius = 3.4 + step * 0.9;
  return (
    <g
      data-testid="lm-ship-dock"
      transform={`translate(${slot.dock} ${slot.row}) scale(${shipScale(slot.row)})`}
    >
      <g className={`lc-dock ${slot.delay}`}>
        <g className="lm-bob">
          <ShipBody />
        </g>
        {Array.from({ length: coins }, (_, i) => (
          <g key={i} transform={`translate(${-8 + i * 14} -36)`}>
            <g className={`lc-coin ${slot.delay}`}>
              <circle
                r={radius}
                fill="#ffd54a"
                stroke="#7a4a00"
                strokeWidth="1.2"
              />
              <circle r={radius * 0.45} fill="none" stroke="#b8860b" />
            </g>
          </g>
        ))}
      </g>
    </g>
  );
}

/** A ship that did not: it sails up to the quay, huffs at the sign and goes on to the rival. */
function PassShip({
  slot,
  isTalker,
  isDark,
}: {
  slot: (typeof HARBOR_SLOTS)[number];
  isTalker: boolean;
  isDark: boolean;
}) {
  return (
    <g
      data-testid="lm-ship-pass"
      transform={`translate(${SHIP_X} ${slot.row})`}
    >
      <g className={`lc-pass ${slot.delay}`}>
        <g transform={`scale(${shipScale(slot.row)})`}>
          <g className={`lc-turn ${slot.delay}`}>
            <g className="lm-bob">
              <ShipBody />
            </g>
          </g>
        </g>
        {!isDark && (
          <g
            transform={`translate(0 ${-30 * shipScale(slot.row) - 14}) scale(1.5)`}
          >
            <g className={`lc-huff ${slot.delay}`}>
              {isTalker ? (
                <>
                  <rect
                    x="-37"
                    y="-11"
                    width="74"
                    height="13"
                    rx="2"
                    fill="#fff7e0"
                    stroke="#7a1d1d"
                    strokeWidth="1.2"
                  />
                  <polygon points="-3,2 3,2 0,7" fill="#fff7e0" />
                  <text
                    y="-1.5"
                    textAnchor="middle"
                    fontSize="7"
                    fill="#9b1c1c"
                    className="font-[family-name:var(--font-eo-pixel)]"
                  >
                    TOO PRICEY!
                  </text>
                </>
              ) : (
                <text
                  textAnchor="middle"
                  fontSize="11"
                  fill="#ff6b6b"
                  stroke="#2b0a0a"
                  strokeWidth="2.5"
                  paintOrder="stroke"
                  className="font-[family-name:var(--font-eo-pixel)]"
                >
                  !?
                </text>
              )}
            </g>
          </g>
        )}
      </g>
    </g>
  );
}

/** The rival harbor's light on the far shore, where the ships that turn away go. */
function RivalHarbor() {
  return (
    <g transform="translate(392 190) scale(0.26)" aria-hidden="true">
      <use href="#lm-mini" />
      <circle cy="-123" r="34" fill="url(#lm-lamp)" opacity="0.9" />
      <polygon
        points="0,-123 -380,-170 -380,-80"
        fill="url(#lm-beam)"
        opacity="0.28"
      />
    </g>
  );
}

/** The toll sign on the quay: a stack of coins that grows with the toll. */
function TollSign({ step }: { step: number }) {
  return (
    <g
      data-testid="lm-toll-sign"
      data-step={step}
      transform="translate(194 252)"
    >
      <g className="lm-pop-svg" key={step}>
        <rect x="-1.5" y="-18" width="3" height="20" fill="#8a5a2b" />
        <rect
          x="-12"
          y="-30"
          width="24"
          height="13"
          fill="#2a3350"
          stroke="#ffd76a"
          strokeWidth="1.2"
        />
        {Array.from({ length: step + 1 }, (_, i) => (
          <rect
            key={i}
            x={-9 + i * 4}
            y={-26 + (4 - i) * 0.6}
            width="3"
            height={4 + i * 1.5}
            fill="#ffd54a"
          />
        ))}
      </g>
    </g>
  );
}

/** The tanker: it sails in glowing, with a deal on a tag, and barrels ready to roll. */
function Tanker({ deal }: { deal: number }) {
  return (
    <g
      data-testid="lm-tanker-scene"
      data-deal={deal}
      transform="translate(84 238)"
    >
      <g className="lc-tanker-in">
        <circle r="58" cy="-14" fill="url(#lm-lamp)" className="lc-glow" />
        <g transform="scale(1.7)">
          <g className="lm-bob">
            <path d="M-20 -3 L20 -3 L14 6 L-14 6 Z" fill="#7a2f2b" />
            <rect x="-20" y="-5" width="40" height="2.4" fill="#c0602a" />
            {[-11, -3.5, 4, 11.5].map((x) => (
              <rect
                key={x}
                x={x - 3}
                y="-12"
                width="6.5"
                height="7"
                fill="#c0602a"
                stroke="#ffb347"
                strokeWidth="0.7"
              />
            ))}
            <rect x="12" y="-16" width="8" height="11" fill="#e9e4d6" />
            <rect x="13.5" y="-14" width="5" height="3" fill="#ffd76a" />
            <line x1="-18" y1="-5" x2="-18" y2="-20" stroke="#e9e4d6" />
            <polygon points="-18,-20 -9,-17 -18,-14" fill="#5ee08a" />
          </g>
        </g>
        <g transform="translate(-22 -50) scale(1.6)">
          <rect
            x="-14"
            y="-8"
            width="28"
            height="11"
            rx="2"
            fill="#103a22"
            stroke="#5ee08a"
            strokeWidth="1.2"
          />
          <text
            y="0"
            textAnchor="middle"
            fontSize="8.5"
            fill="#baffcf"
            className="font-[family-name:var(--font-eo-pixel)]"
          >
            {deal >= 2 ? "-70%" : "-50%"}
          </text>
        </g>
      </g>
    </g>
  );
}

/** Barrels hop across the water from the tanker into the depot's tanks. */
function Barrels() {
  const delays = [
    "[animation-delay:0s]",
    "[animation-delay:0.3s]",
    "[animation-delay:0.6s]",
    "[animation-delay:0.9s]",
    "[animation-delay:1.2s]",
    "[animation-delay:1.5s]",
  ];
  return (
    <g data-testid="lm-barrels" transform="translate(62 214) scale(1.5)">
      {delays.map((delay) => (
        <g key={delay} className={`lc-barrel ${delay}`}>
          <rect
            x="-4.5"
            y="-6"
            width="9"
            height="11"
            rx="2"
            fill="#c0602a"
            stroke="#ffb347"
            strokeWidth="1"
          />
          <rect x="-4.5" y="-3" width="9" height="1.4" fill="#ffb347" />
        </g>
      ))}
    </g>
  );
}

/** The reef at the harbor mouth: black rocks and a ring of foam, which the dark makes dangerous. */
function Reef() {
  return (
    <g aria-hidden="true" transform="translate(172 246)">
      <polygon
        points="0,6 6,-8 11,-1 16,-14 22,-2 27,-9 32,6"
        fill="#0b1224"
        stroke="#6b7fb0"
        strokeWidth="1.4"
      />
      <polygon points="14,6 19,-4 25,6" fill="#070d1c" />
      <path
        d="M-4 8 Q16 12 36 8"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.9"
        strokeWidth="1.8"
        strokeDasharray="3 2"
      />
    </g>
  );
}

/** A ship in the dark: it drifts toward the rocks, nearly hits them, and veers off. */
function DarkShip() {
  return (
    <g data-testid="lm-dark-ship" transform="translate(238 236)">
      <g className="lc-wreck">
        <g transform="scale(1.7)">
          <g className="lm-bob">
            <ShipBody isDark />
          </g>
        </g>
        <g transform="translate(-4 -62)">
          <g className="lc-blink">
            <text
              textAnchor="middle"
              fontSize="32"
              fill="#ff5a5a"
              stroke="#1a0505"
              strokeWidth="3"
              paintOrder="stroke"
              className="font-[family-name:var(--font-eo-pixel)]"
            >
              !!
            </text>
          </g>
        </g>
      </g>
    </g>
  );
}

type Banner = { text: string; fill: string; stroke: string; testId: string };

/** The one banner on show: a loss or a win outranks the market's news. */
function bannerFor(info: LightSceneInfo): Banner | null {
  if (info.darkBanner > 0)
    return {
      text: "DARK!",
      fill: "#ff6b6b",
      stroke: "#2b0a0a",
      testId: "lm-banner-dark",
    };
  if (info.relit > 0)
    return {
      text: "LIT AGAIN!",
      fill: "#fff3a0",
      stroke: "#7a4a00",
      testId: "lm-banner-relit",
    };
  if (info.tanker > 0)
    return {
      text: "CHEAP OIL!",
      fill: "#9dffbf",
      stroke: "#06361b",
      testId: "lm-banner-cheap",
    };
  return null;
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

/**
 * Gulls, a jumping fish, and what lives further out: now and then a tentacle
 * curls up out of the dark water. When the lamp runs dry, eyes watch from the
 * sea until the light comes back.
 */
function SeaLife({ isDry }: { isDry: boolean }) {
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id="lm-deep-clip">
          <rect x="296" y="150" width="70" height="104" />
        </clipPath>
      </defs>
      <g className="gg-fly" fill="#dfe8ff">
        <rect x="0" y="86" width="3" height="1" />
        <rect x="3" y="87" width="2" height="1" />
        <rect x="5" y="86" width="3" height="1" />
      </g>
      <g className="gg-fly-b" fill="#dfe8ff">
        <rect x="0" y="62" width="3" height="1" />
        <rect x="3" y="63" width="2" height="1" />
        <rect x="5" y="62" width="3" height="1" />
      </g>
      <g className="gg-jump">
        <rect x="236" y="226" width="7" height="3" fill="#9bc3ff" />
        <rect x="243" y="225" width="2" height="5" fill="#9bc3ff" />
      </g>
      <g clipPath="url(#lm-deep-clip)">
        <g className="gg-surface" fill="#6a3a80">
          <rect x="326" y="226" width="8" height="28" />
          <rect x="328" y="212" width="7" height="16" />
          <rect x="332" y="202" width="6" height="12" />
          <rect x="336" y="196" width="6" height="8" />
          <rect x="341" y="194" width="4" height="5" />
          <rect x="344" y="197" width="3" height="4" />
          <g fill="#d9a8e6">
            <rect x="327" y="232" width="2" height="2" />
            <rect x="327" y="242" width="2" height="2" />
            <rect x="329" y="218" width="2" height="2" />
            <rect x="333" y="206" width="2" height="2" />
          </g>
        </g>
      </g>
      {isDry && (
        <g className="gg-peek-often" fill="#ffe14d">
          <rect x="250" y="246" width="3" height="2" />
          <rect x="258" y="246" width="3" height="2" />
        </g>
      )}
    </g>
  );
}

export default function CoastLayer({ info }: { info: LightSceneInfo }) {
  const isStorm = info.storm > 0;
  // A dry lamp is dark: the beam sputters and goes out until oil is bought.
  const isDry = info.lampDry === 1;
  const isRelit = info.relit > 0;
  // Lit again: a big burst of beam for a few seconds.
  const burst = isRelit ? 1.7 : 1;
  const beamOpacity = isDry ? 0.12 : isRelit ? 1 : 0.25 + 0.6 * info.beam;
  const halfWidth = (8 + 34 * info.beam) * burst;
  const length = (220 + 110 * info.beam) * burst;
  const windows = keeperWindows(info.keepers);
  const farCount = Math.min(FAR_LIGHTHOUSES, Math.max(0, info.lighthouses - 1));
  const ships = visibleShips(info);
  const docking = Math.round((info.traffic / 10) * ships);
  const banner = bannerFor(info);

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
      {info.tollOpen > 0 && <RivalHarbor />}
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
      <SeaLife isDry={isDry} />
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="2800"
        fill="#04060d"
        className={`transition-opacity duration-1000 ${isStorm ? "opacity-60" : "opacity-0"}`}
      />
      {info.tollOpen > 0 ? (
        <g data-testid="lm-harbor-ships" data-traffic={info.traffic}>
          {Array.from({ length: ships }, (_, i) =>
            i < docking ? (
              <DockShip
                key={`d${i}`}
                slot={HARBOR_SLOTS[i]}
                step={info.tollStep}
              />
            ) : (
              <PassShip
                key={`p${i}`}
                slot={HARBOR_SLOTS[i]}
                isTalker={i === docking}
                isDark={isDry}
              />
            )
          )}
        </g>
      ) : (
        Array.from({ length: ships }, (_, i) => (
          <Ship
            key={i}
            row={SHIP_ROWS[i]}
            cls={SHIP_CLASSES[i]}
            coins={info.feesTier}
          />
        ))
      )}
      {info.trainTier >= 3 && <RescueBoats />}
      <Reef />
      {info.tollOpen > 0 && <TollSign step={info.tollStep} />}
      {/* the main lighthouse, its rock and the keepers' cottage */}
      <Depot info={info} />
      {info.tanker > 0 && <Tanker deal={info.tankerDeal} />}
      {info.barrels > 0 && <Barrels />}
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
      <Crew keepers={Math.min(10, info.keepers)} drills={info.trainTier} />
      <rect x="97" y="130" width="26" height="5" fill="#2b2f3d" />
      <rect x="103" y="114" width="14" height="16" fill="#ffd76a" />
      <polygon points="100,114 120,114 110,102" fill="#2b2f3d" />
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
      {isDry && (
        <rect
          data-testid="lm-dark-dim"
          x="-1200"
          y="-1200"
          width="2800"
          height="2800"
          fill="#02030a"
          opacity="0.5"
        />
      )}
      {isDry && <DarkShip />}
      <g transform={`translate(${LAMP.x} ${LAMP.y})`}>
        {isRelit && (
          <g aria-hidden="true">
            <circle r="120" fill="url(#lm-lamp)" className="lc-relit-flash" />
            {[
              "[animation-delay:0s]",
              "[animation-delay:0.5s]",
              "[animation-delay:1s]",
            ].map((delay) => (
              <circle
                key={delay}
                r="30"
                fill="none"
                stroke="#fff3a0"
                strokeWidth="3"
                className={`lc-ring ${delay}`}
              />
            ))}
          </g>
        )}
        <g className={isDry ? "lc-sputter" : undefined} opacity={beamOpacity}>
          <g className="lm-sweep">
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
        </g>
        <circle
          r={(22 + 10 * info.beam) * (isDry ? 0.45 : isRelit ? 1.8 : 1)}
          fill="url(#lm-lamp)"
          className={isDry ? "lc-sputter" : undefined}
        />
        <LensRings lenses={info.lensLevel} />
      </g>
      {banner && (
        <text
          data-testid={banner.testId}
          x="262"
          y="130"
          textAnchor="middle"
          fontSize="25"
          fill={banner.fill}
          stroke={banner.stroke}
          strokeWidth="6"
          paintOrder="stroke"
          className="lc-shout font-[family-name:var(--font-eo-pixel)]"
          key={banner.testId}
        >
          {banner.text}
        </text>
      )}
      <ForkArt info={info} />
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
