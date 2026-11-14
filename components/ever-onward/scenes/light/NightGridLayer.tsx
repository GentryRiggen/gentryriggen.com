import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { PLANET } from "./anchors";

/**
 * The night's grid, drawn big: the day and the evening rush in the sky, the
 * battery bank charging by day and draining at dusk, humming wires, districts
 * that snap dark, the "lit all night" wave, the crews at their posts, and a
 * storm on an unwatched town. Everything is drawn from `LightSceneInfo` (flat
 * numbers), so it only redraws when the picture changes.
 */

const fmt = (n: number): string => n.toFixed(1);

// ----------------------------------------------------------------- the day

/**
 * Where the sun is at each twentieth of the day (static class names, so
 * Tailwind sees every one): up across the sky, then down behind the planet.
 */
const SUN_AT = [
  "[transform:translate(108px,132px)]",
  "[transform:translate(125px,109px)]",
  "[transform:translate(142px,88px)]",
  "[transform:translate(159px,71px)]",
  "[transform:translate(176px,57px)]",
  "[transform:translate(193px,50px)]",
  "[transform:translate(210px,48px)]",
  "[transform:translate(227px,53px)]",
  "[transform:translate(244px,63px)]",
  "[transform:translate(261px,79px)]",
  "[transform:translate(278px,99px)]",
  "[transform:translate(295px,121px)]",
  "[transform:translate(295px,190px)]",
  "[transform:translate(295px,190px)]",
  "[transform:translate(295px,190px)]",
  "[transform:translate(295px,190px)]",
  "[transform:translate(295px,190px)]",
  "[transform:translate(295px,190px)]",
  "[transform:translate(295px,190px)]",
  "[transform:translate(295px,190px)]",
] as const;

/** How blue the sky is, and how orange, at each twentieth (day, dusk, rush, night). */
const DAY_SKY = [
  0.6, 0.62, 0.62, 0.62, 0.62, 0.62, 0.6, 0.55, 0.5, 0.4, 0.2, 0.05, 0, 0, 0, 0,
  0, 0, 0, 0.3,
] as const;
const DUSK_SKY = [
  0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.35, 0.6, 0.7, 0.45, 0.25, 0.2, 0.2, 0.15, 0.05,
  0, 0,
] as const;
/** The moon is out from dusk until the sun comes back. */
const MOON_SKY = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.7, 1, 1, 1, 1, 1, 1, 1, 0.6,
] as const;

const FADE = "transition-opacity duration-[6000ms] ease-linear";

/** The sky: blue by day, orange at dusk, the sun and moon crossing it. */
export function NightSky({ info }: { info: LightSceneInfo }) {
  if (info.gridOpen <= 0) return null;
  const s = info.dayStep;
  return (
    <g aria-hidden="true" data-testid="lm-night-sky" data-step={s}>
      <defs>
        <linearGradient id="ln-day" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3d8bff" />
          <stop offset="1" stopColor="#bfe3ff" />
        </linearGradient>
        <linearGradient id="ln-dusk" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2b1466" />
          <stop offset="0.7" stopColor="#d9467a" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
        <radialGradient id="ln-sun-glow">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="1500"
        fill="url(#ln-day)"
        opacity={DAY_SKY[s]}
        className={FADE}
      />
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="1500"
        fill="url(#ln-dusk)"
        opacity={DUSK_SKY[s]}
        className={FADE}
      />
      <g
        className={`transition-transform duration-[6000ms] ease-linear ${SUN_AT[s]}`}
      >
        <circle r="30" fill="url(#ln-sun-glow)" />
        <circle r="11" fill="#fff0a8" stroke="#ffb347" strokeWidth="2" />
      </g>
      <g opacity={MOON_SKY[s]} className={FADE}>
        <circle cx="150" cy="58" r="9" fill="#eef2ff" />
        <circle cx="154" cy="55" r="8" fill="#02030a" opacity="0.55" />
      </g>
    </g>
  );
}

// ------------------------------------------------------------- blackouts

const DISTRICTS = 10;
/** Districts snap dark in this order (a few at a time, never one sweep). */
const DARK_ORDER = [4, 7, 2, 9, 0, 5, 3, 8, 1, 6] as const;

/** True when a district is one of the first `dark` to have gone out. */
export const isDistrictDark = (district: number, dark: number): boolean =>
  DARK_ORDER.indexOf(district as never) < dark;

/** Where the planet's rim is at a given x (the houses of a district sit on it). */
const rimY = (x: number): number =>
  PLANET.cy - Math.sqrt(PLANET.r ** 2 - (x - PLANET.cx) ** 2);

/** Three house silhouettes at these offsets from a district's middle. */
const HOUSE_OFFSETS = [-14, 0, 14] as const;

/**
 * A tenth of the picture's width, darkened, for each district that is out:
 * the houses on its rim go black with a red cross over them, a white flash
 * snaps the lights off, and a red edge keeps it shouting.
 */
function DarkBands({ dark }: { dark: number }) {
  const width = 400 / DISTRICTS;
  return (
    <g data-testid="lm-dark-bands">
      <defs>
        <clipPath id="ln-planet-clip">
          <circle cx={PLANET.cx} cy={PLANET.cy} r={PLANET.r} />
        </clipPath>
      </defs>
      <g clipPath="url(#ln-planet-clip)">
        {Array.from({ length: DISTRICTS }, (_, d) =>
          isDistrictDark(d, dark) ? (
            <g key={d} data-district={d}>
              <rect
                x={d * width}
                y="120"
                width={width + 0.5}
                height="170"
                fill="#010208"
                fillOpacity="0.88"
                className="ln-band"
              />
              <rect
                x={d * width}
                y="120"
                width={width + 0.5}
                height="170"
                fill="#ffffff"
                className="ln-cut"
              />
              <rect
                x={d * width}
                y="120"
                width="2.4"
                height="170"
                fill="#ff4a3a"
                fillOpacity="0.85"
              />
              <rect
                x={(d + 1) * width - 2.4}
                y="120"
                width="2.4"
                height="170"
                fill="#ff4a3a"
                fillOpacity="0.85"
              />
            </g>
          ) : null
        )}
      </g>
      {/* the houses that went dark, black against the rim with a red cross */}
      {Array.from({ length: DISTRICTS }, (_, d) =>
        isDistrictDark(d, dark)
          ? HOUSE_OFFSETS.map((dx) => {
              const x = d * width + width / 2 + dx;
              const y = rimY(x) + 5;
              return (
                <g
                  key={`${d}-${dx}`}
                  data-testid="lm-dark-house"
                  className="ln-band"
                  transform={`translate(${fmt(x)} ${fmt(y)}) scale(1.7)`}
                >
                  <rect
                    x="-5"
                    y="-8"
                    width="10"
                    height="8"
                    fill="#05060f"
                    stroke="#ff4a3a"
                    strokeWidth="1.2"
                  />
                  <polygon
                    points="-6.5,-8 0,-14 6.5,-8"
                    fill="#05060f"
                    stroke="#ff4a3a"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M-3 -6 L3 -1 M3 -6 L-3 -1"
                    stroke="#ff4a3a"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })
          : null
      )}
    </g>
  );
}

// ---------------------------------------------------------------- stations

/**
 * The lower band of the picture (below the planet's towns) holds the grid's
 * yard: the battery bank, and five posts in a row, left to right: the build
 * site, the school, then the three storm-watch towns. Big enough to read on
 * a phone, where the whole picture is only about 200 pixels tall.
 */
const STATION_X = {
  build: 62,
  school: 128,
  river: 200,
  hill: 266,
  harbor: 332,
};
const STATION_Y = 284;

function station(x: number): { x: number; y: number; angle: number } {
  return { x, y: STATION_Y, angle: 0 };
}

/** A crew member in a hard hat; the tool shows what the post is. */
function CrewFigure({
  x = 0,
  tool,
  delay = "",
}: {
  x?: number;
  tool: "hammer" | "book" | "glasses" | "walk";
  delay?: string;
}) {
  return (
    <g transform={`translate(${x} 0) scale(2.5)`}>
      <g className={tool === "walk" ? "ln-walk" : ""}>
        <rect x="-2.5" y="-10" width="5" height="2.2" fill="#ffd23f" />
        <rect x="-3" y="-8" width="6" height="1" fill="#e0a800" />
        <rect x="-1.6" y="-7" width="3.2" height="2.4" fill="#f2c9a0" />
        <rect x="-2.4" y="-4.6" width="4.8" height="4" fill="#ff8a3d" />
        <rect x="-2.4" y="-0.6" width="2" height="3.2" fill="#27408b" />
        <rect x="0.4" y="-0.6" width="2" height="3.2" fill="#27408b" />
        {tool === "hammer" && (
          <g className={`ln-hammer ${delay}`}>
            <rect x="2" y="-5" width="1.2" height="5" fill="#8a5a2b" />
            <rect x="0.8" y="-6.4" width="3.6" height="1.8" fill="#c9d3e6" />
          </g>
        )}
        {tool === "book" && (
          <g className="ln-page">
            <rect x="1.6" y="-4" width="4" height="3.2" fill="#fff6d6" />
            <rect x="1.6" y="-4" width="0.8" height="3.2" fill="#d9467a" />
          </g>
        )}
        {tool === "glasses" && (
          <g className={`ln-look ${delay}`}>
            <rect x="-1.8" y="-6.6" width="1.6" height="1.6" fill="#10162b" />
            <rect x="0.2" y="-6.6" width="1.6" height="1.6" fill="#10162b" />
            <rect x="-0.4" y="-6.2" width="0.8" height="0.8" fill="#10162b" />
            <rect x="-1.5" y="-6.5" width="0.6" height="0.6" fill="#9be8ff" />
          </g>
        )}
      </g>
    </g>
  );
}

/** A dark plate behind each station, so it reads over the towns. */
function Plate({ w = 56, h = 46 }: { w?: number; h?: number }) {
  return (
    <rect
      x={-w / 2}
      y={-h + 4}
      width={w}
      height={h}
      rx="3"
      fill="#050816"
      fillOpacity="0.72"
      stroke="#7fc8ff"
      strokeOpacity="0.4"
      strokeWidth="1"
    />
  );
}

function BuildSite({ crews }: { crews: number }) {
  const s = station(STATION_X.build);
  return (
    <g
      data-testid="lm-station-build"
      data-crews={crews}
      transform={`translate(${fmt(s.x)} ${fmt(s.y)})`}
    >
      <Plate />
      <g transform="scale(1.25)">
        {/* a plant going up: scaffold, a crane and sparks from the welding */}
        <rect x="-15" y="-24" width="2" height="25" fill="#ffb454" />
        <rect x="-3" y="-24" width="2" height="25" fill="#ffb454" />
        <rect x="-15" y="-24" width="14" height="2" fill="#ffb454" />
        <rect x="-15" y="-13" width="14" height="1.6" fill="#ffb454" />
        <rect
          x="-12"
          y="-8"
          width="8"
          height="8"
          fill="#5b6a8c"
          stroke="#ffd98a"
        />
        <rect x="5" y="-29" width="2.4" height="30" fill="#9ab" />
        <rect x="1" y="-29" width="17" height="2.4" fill="#9ab" />
        <rect x="16" y="-27" width="0.9" height="7" fill="#dfe8ff" />
        {crews > 0 && (
          <g className="ln-weld" fill="#fff3a0">
            <rect x="-6" y="-11" width="2" height="2" />
            <rect x="-10" y="-14" width="1.5" height="1.5" />
            <rect x="-2" y="-9" width="1.5" height="1.5" />
          </g>
        )}
      </g>
      {Array.from({ length: Math.min(crews, 3) }, (_, i) => (
        <CrewFigure
          key={i}
          x={14 + i * 9 - Math.min(crews, 3) * 2}
          tool="hammer"
          delay={["", "[animation-delay:-0.3s]", "[animation-delay:-0.6s]"][i]}
        />
      ))}
    </g>
  );
}

function School({ crews }: { crews: number }) {
  const s = station(STATION_X.school);
  return (
    <g
      data-testid="lm-station-school"
      data-crews={crews}
      transform={`translate(${fmt(s.x)} ${fmt(s.y)})`}
    >
      <Plate />
      <g transform="scale(1.25)">
        <rect x="-16" y="-14" width="32" height="14" fill="#e8c9a0" />
        <polygon points="-18,-14 0,-26 18,-14" fill="#c8453a" />
        <rect x="-2.5" y="-9" width="5" height="9" fill="#6b4423" />
        <rect x="-13" y="-11" width="5" height="5" fill="#9be8ff" />
        <rect x="8" y="-11" width="5" height="5" fill="#9be8ff" />
        <circle cy="-19" r="2" fill="#ffd23f" />
        {crews > 0 && (
          <g className="ln-bulb" fill="#ffe27a">
            <rect x="-1" y="-37" width="2.4" height="2.4" />
            <rect x="-9" y="-33" width="1.8" height="1.8" />
            <rect x="8" y="-33" width="1.8" height="1.8" />
          </g>
        )}
      </g>
      {Array.from({ length: Math.min(crews, 3) }, (_, i) => (
        <CrewFigure
          key={i}
          x={(i - (Math.min(crews, 3) - 1) / 2) * 13}
          tool="book"
        />
      ))}
    </g>
  );
}

const TOWN_X = [STATION_X.river, STATION_X.hill, STATION_X.harbor] as const;

/** A watch tower by a town: a lookout with binoculars when a crew is posted. */
function Town({
  index,
  crews,
  isOut,
  isHit,
}: {
  index: number;
  crews: number;
  isOut: boolean;
  isHit: boolean;
}) {
  const s = station(TOWN_X[index]);
  const glass = isOut ? "#243049" : "#ffd45e";
  return (
    <g
      data-testid={`lm-station-town-${index}`}
      data-crews={crews}
      data-out={isOut}
      transform={`translate(${fmt(s.x)} ${fmt(s.y)})`}
    >
      <Plate />
      <g transform="scale(1.25)">
        <rect x="-17" y="-10" width="11" height="10" fill="#3a4a73" />
        <polygon points="-18,-10 -11.5,-16 -5,-10" fill="#6b4a7a" />
        <rect x="-14" y="-7" width="4" height="4" fill={glass} />
        <rect x="-3" y="-8" width="9" height="8" fill="#3a4a73" />
        <polygon points="-4,-8 1.5,-13 7,-8" fill="#6b4a7a" />
        <rect x="0" y="-6" width="4" height="4" fill={glass} />
        {/* the tower: stilts and a platform, where the crew keeps watch */}
        <rect x="9" y="-16" width="1.6" height="16" fill="#c9a66b" />
        <rect x="16" y="-16" width="1.6" height="16" fill="#c9a66b" />
        <rect x="8" y="-18" width="11" height="2.4" fill="#c9a66b" />
        {crews === 0 && (
          <rect x="11" y="-23" width="4" height="5" fill="#5b6a8c" />
        )}
      </g>
      {crews > 0 && (
        <g transform="translate(17 -22)">
          <CrewFigure tool="glasses" />
          {crews > 1 && (
            <CrewFigure
              x={-13}
              tool="glasses"
              delay="[animation-delay:-0.5s]"
            />
          )}
          <circle
            cy="-12"
            r="15"
            fill="none"
            stroke="#6ef0a0"
            strokeOpacity="0.85"
            strokeWidth="1.6"
            strokeDasharray="4 4"
            className="lm-glow"
          />
        </g>
      )}
      {isOut && (
        <g className="lm-flicker">
          <polygon points="-3,-58 3,-58 1.6,-48 -1.6,-48" fill="#ff5a4a" />
          <rect x="-1.6" y="-45" width="3.2" height="3.2" fill="#ff5a4a" />
        </g>
      )}
      {isHit && crews === 0 && <StormStrike />}
      {isHit && crews > 0 && <StormHeld />}
    </g>
  );
}

/** A lightning strike on an unwatched town: a bolt, sparks and a downed line. */
function StormStrike() {
  return (
    <g data-testid="lm-storm-strike">
      <circle r="46" cy="-40" fill="#fff6a8" className="ln-warm" />
      <polygon
        className="ln-bolt"
        points="-16,-210 20,-210 3,-150 26,-150 -16,-62 -8,-122 -28,-122"
        fill="#fff6a8"
        stroke="#ff9a3d"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* the pole leans and the fat wire drops, spitting */}
      <g className="ln-pole">
        <rect x="-6" y="-44" width="5.5" height="44" fill="#c9a66b" />
      </g>
      <path
        className="ln-wire"
        d="M-3 -42 q-14 14 -4 25 t8 17"
        fill="none"
        stroke="#ff7a3d"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g fill="#fff3a0">
        <rect className="ln-spark-a" x="-8" y="-8" width="5.5" height="5.5" />
        <rect className="ln-spark-b" x="0" y="-8" width="5.5" height="5.5" />
        <rect className="ln-spark-c" x="-4" y="-13" width="4.5" height="4.5" />
        <rect className="ln-spark-d" x="5" y="-4" width="4.5" height="4.5" />
      </g>
    </g>
  );
}

/** A watched town: a blue dome of sandbags holds the storm off. */
function StormHeld() {
  return (
    <g data-testid="lm-storm-held">
      <circle
        r="34"
        cy="-14"
        fill="#4ab8ff"
        fillOpacity="0.22"
        stroke="#9be8ff"
        strokeWidth="3"
        className="ln-dome"
      />
      <polygon
        className="ln-bolt"
        points="-16,-210 20,-210 3,-150 26,-150 -16,-84 -8,-122 -28,-122"
        fill="#d8f2ff"
        stroke="#4ab8ff"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </g>
  );
}

// ----------------------------------------------------------------- batteries

/** The bank stands in the band under the towns, wires dropping into it. */
const BANK = { top: 198, cellH: 40, gap: 6 } as const;
/** The bank is about this wide whatever its size, so one cell is a big, readable block. */
const BANK_WIDTH = 200;
/** A cell is at least this wide and at most this wide. */
const CELL_MIN = 22;
const CELL_MAX = 64;
/** Where the feeder wires leave the ring below the towns. */
const FEED_FROM = 192;
const FEED_X = [96, 200, 304] as const;

/** A row of battery cells that fill by day and drain at the rush. */
function Bank({ info }: { info: LightSceneInfo }) {
  const cells = Math.min(8, info.batteries);
  if (cells <= 0) return null;
  const cellW = Math.min(
    CELL_MAX,
    Math.max(CELL_MIN, BANK_WIDTH / cells - BANK.gap)
  );
  const segments = Math.max(4, Math.ceil(8 / cells));
  const total = cells * segments;
  const lit = Math.round(info.charge * total);
  const colour =
    info.flow === 2 ? "#ff9a3d" : info.flow === 1 ? "#b6ff5a" : "#ffe27a";
  const anim =
    info.flow === 2 ? "ln-drain" : info.flow === 1 ? "ln-charge" : "";
  const stride = cellW + BANK.gap;
  const x0 = PLANET.cx - (cells * stride - BANK.gap) / 2;
  const segH = (BANK.cellH - 4) / segments;
  const feed =
    info.flow === 2
      ? "ln-spark ln-spark-fast"
      : info.flow === 1
        ? "ln-spark ln-spark-in"
        : "";
  return (
    <g data-testid="lm-bank" data-flow={info.flow} data-lit={lit}>
      {/* wires between the ring below the towns and the bank: lime sparks run
          in while it charges, orange ones race out at the rush */}
      {FEED_X.map((x) => (
        <g key={x}>
          <path
            d={`M${x} ${FEED_FROM} L${x} ${BANK.top - 3}`}
            stroke="#7fc8ff"
            strokeOpacity="0.5"
            strokeWidth="2"
          />
          {feed && (
            <path
              d={`M${x} ${FEED_FROM} L${x} ${BANK.top - 3}`}
              pathLength="100"
              stroke={colour}
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeDasharray="4 21"
              className={feed}
            />
          )}
        </g>
      ))}
      <rect
        x={x0 - 6}
        y={BANK.top - 6}
        width={cells * stride - BANK.gap + 12}
        height={BANK.cellH + 12}
        rx="3"
        fill="#050816"
        fillOpacity="0.8"
        stroke={colour}
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      {Array.from({ length: cells }, (_, i) => (
        <g key={i} transform={`translate(${fmt(x0 + i * stride)} ${BANK.top})`}>
          <rect
            width={cellW}
            height={BANK.cellH}
            fill="#0a1020"
            stroke={colour}
            strokeWidth="1.4"
          />
          {Array.from({ length: segments }, (_, k) => {
            const isOn = i * segments + k < lit;
            return (
              <rect
                key={k}
                x="2"
                y={BANK.cellH - 2 - (k + 1) * segH + 0.8}
                width={cellW - 4}
                height={segH - 1.4}
                fill={isOn ? colour : "#1b2440"}
                className={
                  isOn
                    ? `${anim} ${k % 2 ? "[animation-delay:-0.4s]" : ""}`
                    : ""
                }
              />
            );
          })}
        </g>
      ))}
      {info.flow === 1 && (
        <g className="ln-charge" data-testid="lm-bank-bolt">
          <polygon
            points="190,196 203,196 198,206 207,206 192,224 196,212 188,212"
            fill="#b6ff5a"
            stroke="#10260a"
            strokeWidth="1.6"
            transform="translate(-6 -34) scale(1.4)"
          />
        </g>
      )}
    </g>
  );
}

// -------------------------------------------------------------------- the rest

interface Banner {
  /** The shout, one line or two (two words stack, so they can be big on a phone). */
  lines: readonly string[];
  fill: string;
  stroke: string;
  testId: string;
}

/** The one moment on show: a blackout outranks a storm, which outranks a lit night. */
function bannerFor(info: LightSceneInfo): Banner | null {
  if (info.gridBanner === 2)
    return {
      lines: ["BLACKOUT!"],
      fill: "#ff6b6b",
      stroke: "#2b0a0a",
      testId: "lm-banner-blackout",
    };
  if (info.stormHit > 0 && info.stormHeld === 0)
    return {
      lines: ["LINE", "DOWN!"],
      fill: "#ffb347",
      stroke: "#2b1400",
      testId: "lm-banner-linedown",
    };
  if (info.stormHit > 0)
    return {
      lines: ["STORM", "HELD!"],
      fill: "#9be8ff",
      stroke: "#06243a",
      testId: "lm-banner-held",
    };
  if (info.gridBanner === 1)
    return {
      lines: ["LIT ALL", "NIGHT!"],
      fill: "#fff3a0",
      stroke: "#7a4a00",
      testId: "lm-banner-lit",
    };
  return null;
}

/** The pixel font is about this many times as wide as it is tall. */
const SHOUT_WIDTH = 1.45;
/** A shout fills this much of the picture's width, at most. */
const SHOUT_FILL = 340;

/** A big shout over the picture: as large as fits, stacked in lines. */
function BannerText({ banner }: { banner: Banner }) {
  const longest = Math.max(...banner.lines.map((line) => line.length));
  const size = Math.min(46, SHOUT_FILL / (longest * SHOUT_WIDTH));
  return (
    <text
      data-testid={banner.testId}
      x="200"
      y="78"
      textAnchor="middle"
      fontSize={fmt(size)}
      fill={banner.fill}
      stroke={banner.stroke}
      strokeWidth="9"
      paintOrder="stroke"
      className="lc-shout font-[family-name:var(--font-eo-pixel)]"
      aria-label={banner.lines.join(" ")}
    >
      {banner.lines.map((line, i) => (
        <tspan key={line} x="200" dy={i === 0 ? 0 : fmt(size * 1.15)}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Everything the grid and the crews add on top of the night's art. */
export default function NightGridEffects({ info }: { info: LightSceneInfo }) {
  if (info.gridOpen <= 0) return null;
  const banner = bannerFor(info);
  const watch: readonly number[] = [info.watch0, info.watch1, info.watch2];
  const hasCrews = info.crewBuild + info.crewSchool + info.crewRoad > 0;
  const walkers = Math.min(2, info.crewRoad);
  return (
    <g aria-hidden="true" data-testid="lm-night-grid">
      {info.dark > 0 && <DarkBands dark={info.dark} />}
      <Bank info={info} />
      {hasCrews && (
        <>
          <BuildSite crews={info.crewBuild} />
          <School crews={info.crewSchool} />
        </>
      )}
      {info.weatherOpen > 0 &&
        [0, 1, 2].map((town) => (
          <Town
            key={town}
            index={town}
            crews={watch[town]}
            isOut={(info.townsOut & (1 << town)) !== 0}
            isHit={info.stormHit > 0 && info.stormTown === town}
          />
        ))}
      {walkers > 0 && (
        <g
          data-testid="lm-crews-road"
          transform={`translate(${PLANET.cx + 70} ${STATION_Y + 14})`}
        >
          {Array.from({ length: walkers }, (_, i) => (
            <CrewFigure key={i} x={(i - 0.5) * 22} tool="walk" />
          ))}
        </g>
      )}
      {/* a blackout: the sky flashes red and the rim of the planet alarms */}
      {info.gridBanner === 2 && (
        <g data-testid="lm-blackout">
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="1500"
            fill="#ff2a2a"
            className="ln-flash"
          />
          <circle
            cx={PLANET.cx}
            cy={PLANET.cy}
            r={PLANET.r + 3}
            fill="none"
            stroke="#ff4a3a"
            strokeWidth="7"
            className="ln-alarm"
          />
        </g>
      )}
      {/* a lit night: a warm wave rolls out over the towns */}
      {info.gridBanner === 1 && (
        <g data-testid="lm-lit-wave">
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={PLANET.cx}
              cy={PLANET.cy - PLANET.r + 60}
              r="40"
              fill="none"
              stroke="#ffe27a"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              className={`ln-wave ${["", "[animation-delay:0.45s]", "[animation-delay:0.9s]"][i]}`}
            />
          ))}
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="1500"
            fill="#ffd45e"
            className="ln-warm"
          />
        </g>
      )}
      {banner && <BannerText banner={banner} key={banner.testId} />}
    </g>
  );
}
