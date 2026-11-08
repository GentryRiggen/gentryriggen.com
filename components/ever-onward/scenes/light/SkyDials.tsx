import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { SUN } from "./anchors";

const fmt = (n: number): string => n.toFixed(1);

/** The little robot that sends the probes out, and where they set off from. */
const ROBOT = { x: 262, y: 262 } as const;
const HAND = { x: ROBOT.x - 12, y: ROBOT.y - 22 } as const;
/** The red cluster wild probes break off to, up in the corner of the picture. */
const CLUSTER = { x: 62, y: 70 } as const;
const MAX_STREAM = 12;
const MAX_WILD_DOTS = 10;

/** How long one probe's flight takes, by speed points (0..8): faster looks faster. */
const FLIGHT = [
  "[--sk-len:4.4s]",
  "[--sk-len:3.8s]",
  "[--sk-len:3.2s]",
  "[--sk-len:2.7s]",
  "[--sk-len:2.3s]",
  "[--sk-len:2s]",
  "[--sk-len:1.7s]",
  "[--sk-len:1.5s]",
  "[--sk-len:1.3s]",
] as const;
/** Each probe's start is spread out so the stream never bunches. */
const DELAYS = [
  "[--sk-late:-0.1s]",
  "[--sk-late:-1.3s]",
  "[--sk-late:-2.2s]",
  "[--sk-late:-0.7s]",
  "[--sk-late:-1.8s]",
  "[--sk-late:-2.9s]",
  "[--sk-late:-0.4s]",
  "[--sk-late:-1.5s]",
  "[--sk-late:-2.5s]",
  "[--sk-late:-1s]",
  "[--sk-late:-2s]",
  "[--sk-late:-3.2s]",
] as const;
/** Flight paths: where each probe ends up, relative to the robot's hand, fanned a little. */
const AIMS = Array.from({ length: MAX_STREAM }, (_, i) => {
  const fan = ((i % 6) - 2.5) * 11;
  return {
    dx: SUN.x - HAND.x + fan,
    dy: SUN.y + 18 - HAND.y - (i % 3) * 6,
    fan,
  };
});
/** Written out in full so Tailwind sees every class (they must match AIMS above). */
const AIM_CLASS = [
  "[--sk-dx:-77.5px] [--sk-dy:-72.0px]",
  "[--sk-dx:-66.5px] [--sk-dy:-78.0px]",
  "[--sk-dx:-55.5px] [--sk-dy:-84.0px]",
  "[--sk-dx:-44.5px] [--sk-dy:-72.0px]",
  "[--sk-dx:-33.5px] [--sk-dy:-78.0px]",
  "[--sk-dx:-22.5px] [--sk-dy:-84.0px]",
  "[--sk-dx:-77.5px] [--sk-dy:-72.0px]",
  "[--sk-dx:-66.5px] [--sk-dy:-78.0px]",
  "[--sk-dx:-55.5px] [--sk-dy:-84.0px]",
  "[--sk-dx:-44.5px] [--sk-dy:-72.0px]",
  "[--sk-dx:-33.5px] [--sk-dy:-78.0px]",
  "[--sk-dx:-22.5px] [--sk-dy:-84.0px]",
] as const;

/** Points of the flare's rays around the sun. */
const RAYS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;
const rad = (deg: number): number => (deg * Math.PI) / 180;

interface Shout {
  lines: readonly string[];
  sub?: string;
  fill: string;
  stroke: string;
  testId: string;
}

/** The one moment on show: a flare outranks a stray break-away, which outranks a homecoming. */
function shoutFor(info: LightSceneInfo): Shout | null {
  if (info.flareHit > 0)
    return {
      lines: ["FLARE!"],
      sub:
        info.flareLost > 0
          ? `${info.flareLost * 10}% burned${info.flareSaved > 0 ? ", shields held" : ""}`
          : "the fleet is safe",
      fill: info.flareLost > 0 ? "#ff8a3d" : "#9be8ff",
      stroke: "#2b0a00",
      testId: "lm-banner-flare",
    };
  if (info.goneWild > 0)
    return {
      lines: ["GONE", "WILD!"],
      fill: "#ff5d5d",
      stroke: "#2b0505",
      testId: "lm-banner-wild",
    };
  if (info.homeAgain > 0)
    return {
      lines: ["HOME!"],
      fill: "#8dff9b",
      stroke: "#06260e",
      testId: "lm-banner-home",
    };
  return null;
}

const SHOUT_WIDTH = 1.45;
const SHOUT_FILL = 340;

function ShoutText({ shout }: { shout: Shout }) {
  const longest = Math.max(...shout.lines.map((line) => line.length));
  const size = Math.min(46, SHOUT_FILL / (longest * SHOUT_WIDTH));
  return (
    <g className="lc-shout" data-testid={shout.testId}>
      <text
        x="200"
        y="58"
        textAnchor="middle"
        fontSize={fmt(size)}
        fill={shout.fill}
        stroke={shout.stroke}
        strokeWidth="9"
        paintOrder="stroke"
        className="font-[family-name:var(--font-eo-pixel)]"
        aria-label={shout.lines.join(" ")}
      >
        {shout.lines.map((line, i) => (
          <tspan key={line} x="200" dy={i === 0 ? 0 : fmt(size * 1.15)}>
            {line}
          </tspan>
        ))}
      </text>
      {shout.sub && (
        <text
          x="200"
          y={fmt(58 + size * 0.95)}
          textAnchor="middle"
          fontSize="13"
          fill="#fff3d0"
          stroke="#2b0a00"
          strokeWidth="5"
          paintOrder="stroke"
          className="font-[family-name:var(--font-eo-pixel)]"
        >
          {shout.sub}
        </text>
      )}
    </g>
  );
}

/** One probe in the stream: its look is its design. */
function StreamProbe({ info, index }: { info: LightSceneInfo; index: number }) {
  const trail = 8 + 4 * info.dsSpeed;
  const shield = info.dsShields;
  const hit = info.flareHit > 0;
  return (
    <g transform={`translate(${HAND.x} ${HAND.y})`}>
      <g
        className={`sk-fly ${AIM_CLASS[index]} ${FLIGHT[Math.min(8, info.dsSpeed)]} ${DELAYS[index]}`}
      >
        <g transform="scale(1.7)">
          {/* speed: a long streak behind it */}
          <line
            x1={-AIMS[index].dx * (trail / 130)}
            y1={-AIMS[index].dy * (trail / 130)}
            x2="0"
            y2="0"
            stroke="#bfe9ff"
            strokeWidth={fmt(1.2 + info.dsSpeed * 0.25)}
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          {/* copying: little copies splitting off to the sides */}
          {Array.from({ length: Math.floor(info.dsCopying / 2) }, (_, k) => (
            <circle
              key={k}
              r="1.8"
              fill="#c8ff7a"
              className={`sk-split ${k % 2 ? "[--sk-side:7px]" : "[--sk-side:-7px]"}`}
              cx={-4 - k * 4}
            />
          ))}
          {/* mirrors: a bright glint on the probe */}
          {info.dsMirrors >= 2 && (
            <polygon
              points="0,-6 1.4,-1.4 6,0 1.4,1.4 0,6 -1.4,1.4 -6,0 -1.4,-1.4"
              fill="#fff7c2"
              transform={`scale(${fmt(0.6 + info.dsMirrors * 0.14)})`}
              className="sk-glint"
            />
          )}
          <circle r="3.4" fill="#ffffff" stroke="#7fd8ff" strokeWidth="1" />
          {/* shields: a bubble that grows with the points */}
          {shield > 0 && (
            <circle
              r={fmt(5 + shield * 0.9)}
              fill="#7fe8ff"
              fillOpacity="0.14"
              stroke="#9ff0ff"
              strokeWidth="1.2"
              className={hit ? "sk-shimmer" : ""}
            />
          )}
        </g>
      </g>
    </g>
  );
}

function Robot({ info }: { info: LightSceneInfo }) {
  return (
    <g transform={`translate(${ROBOT.x} ${ROBOT.y}) scale(1.5)`}>
      <rect
        x="-9"
        y="-12"
        width="18"
        height="12"
        fill="#9aa7c4"
        stroke="#1d2540"
      />
      <rect
        x="-6"
        y="-22"
        width="12"
        height="9"
        fill="#c3cde6"
        stroke="#1d2540"
      />
      <rect x="-4" y="-19" width="3" height="3" fill="#ffd35a" />
      <rect x="1" y="-19" width="3" height="3" fill="#ffd35a" />
      <line x1="0" y1="-22" x2="0" y2="-27" stroke="#c3cde6" />
      <circle
        cx="0"
        cy="-28"
        r="1.8"
        fill={info.dsMoving > 0 ? "#ffd35a" : "#ff6b6b"}
      />
      <line
        x1="-9"
        y1="-8"
        x2="-14"
        y2="-14"
        stroke="#c3cde6"
        strokeWidth="2"
      />
      <rect x="-7" y="0" width="5" height="5" fill="#59627f" />
      <rect x="2" y="0" width="5" height="5" fill="#59627f" />
    </g>
  );
}

/** Red probes that broke away and keep their light for themselves. */
function WildCluster({ info }: { info: LightSceneInfo }) {
  const dots = Math.min(MAX_WILD_DOTS, info.wild * 2 + 1);
  return (
    <g data-testid="lm-wild-cluster" data-level={info.wild}>
      <circle
        cx={CLUSTER.x}
        cy={CLUSTER.y}
        r={fmt(14 + info.wild * 5)}
        fill="#ff2d2d"
        fillOpacity="0.16"
        className="sk-wild-glow"
      />
      <g transform={`translate(${CLUSTER.x} ${CLUSTER.y})`}>
        <g className="sk-wild">
          {Array.from({ length: dots }, (_, i) => {
            const a = rad((i * 360) / dots + 20);
            const r = 6 + (i % 3) * 5 + info.wild * 2;
            return (
              <g
                key={i}
                transform={`translate(${fmt(r * Math.cos(a))} ${fmt(r * Math.sin(a))})`}
              >
                <circle
                  r="3.6"
                  fill="#ff4b4b"
                  stroke="#ffd0d0"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="0"
                  x2={fmt(-5 * Math.cos(a))}
                  y2={fmt(-5 * Math.sin(a))}
                  stroke="#ff9a9a"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </g>
      </g>
      {info.tether > 0 && (
        <g data-testid="lm-tether">
          <line
            x1={CLUSTER.x}
            y1={CLUSTER.y}
            x2={HAND.x - 30}
            y2={HAND.y - 60}
            stroke="#52ff8a"
            strokeWidth="3.5"
            strokeDasharray="6 5"
            strokeLinecap="round"
            className="sk-tether"
          />
          <line
            x1={CLUSTER.x}
            y1={CLUSTER.y}
            x2={HAND.x - 30}
            y2={HAND.y - 60}
            stroke="#52ff8a"
            strokeOpacity="0.25"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}

/** The sun's edge, the probe stream, flares, wild probes and the shouts. */
export default function SkyDials({ info }: { info: LightSceneInfo }) {
  if (info.dialsOpen <= 0) return null;
  const probes = info.probes;
  const sunScale = 0.7 + 0.3 * info.sunDist;
  const hot = Math.max(0, info.sunDist - 5);
  const shout = shoutFor(info);
  const flare = info.flareHit;
  const lost = info.flareLost;
  const warns = info.flareFore;
  return (
    <g aria-hidden="true" data-testid="lm-sky-dials">
      <defs>
        <radialGradient
          id="sk-hot"
          gradientUnits="userSpaceOnUse"
          cx={SUN.x}
          cy={SUN.y}
          r="250"
        >
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="1" />
        </radialGradient>
      </defs>
      {/* the sun's mood: a restless sun spits fire off its edge */}
      {info.sunMood === 2 &&
        [0, 1, 2].map((k) => (
          <path
            key={k}
            d={`M${SUN.x - 20 + k * 20} ${SUN.y - 24 * sunScale} q${6 + k * 4} -26 ${14 - k * 4} -${10 + k * 6}`}
            fill="none"
            stroke="#ff7a2a"
            strokeWidth="4"
            strokeLinecap="round"
            className="gg-prominence"
          />
        ))}
      {warns > 0 && (
        <g data-testid="lm-flare-warn" data-size={warns}>
          <circle
            cx={SUN.x}
            cy={SUN.y}
            r={fmt(30 * sunScale + 10)}
            fill="none"
            stroke="#ff4d2e"
            strokeWidth={fmt(1.5 + warns)}
            strokeDasharray="5 5"
            className="sk-warn"
          />
        </g>
      )}
      <Robot info={info} />
      {Array.from({ length: Math.min(MAX_STREAM, probes) }, (_, i) => (
        <StreamProbe key={i} info={info} index={i} />
      ))}
      {info.wild > 0 && <WildCluster info={info} />}
      {/* a flare: a wave from the sun that pops probes, and shielded ones shimmer */}
      {flare > 0 && (
        <g data-testid="lm-flare" data-size={flare} data-lost={lost}>
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="2800"
            fill="#ff7a1a"
            className="sk-flash"
          />
          {RAYS.map((a) => (
            <line
              key={a}
              x1={fmt(30 * sunScale * Math.cos(rad(a)))}
              y1={fmt(30 * sunScale * Math.sin(rad(a)))}
              x2={fmt(
                SUN.x * 0 + (60 + flare * 20) * sunScale * Math.cos(rad(a))
              )}
              y2={fmt((60 + flare * 20) * sunScale * Math.sin(rad(a)))}
              stroke="#fff3b0"
              strokeWidth="5"
              strokeLinecap="round"
              transform={`translate(${SUN.x} ${SUN.y})`}
            />
          ))}
          <circle
            cx={SUN.x}
            cy={SUN.y}
            r="40"
            fill="none"
            stroke="#ffb347"
            strokeWidth={fmt(6 + flare * 3)}
            className="sk-wave"
          />
          <circle
            cx={SUN.x}
            cy={SUN.y}
            r="40"
            fill="none"
            stroke="#fff3b0"
            strokeWidth="3"
            className="sk-wave [animation-delay:0.25s]"
          />
          {/* probes that burned pop where the wave caught them */}
          {Array.from(
            { length: Math.min(6, lost + (lost > 0 ? 1 : 0)) },
            (_, k) => (
              <g
                key={k}
                transform={`translate(${fmt(HAND.x + 10 + k * 14)} ${fmt(HAND.y - 28 - ((k * 37) % 70))})`}
              >
                <g className="sk-pop">
                  <polygon
                    points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3"
                    fill="#ffdf6b"
                    stroke="#ff5a1a"
                    strokeWidth="1.4"
                  />
                </g>
              </g>
            )
          )}
          {info.flareSaved > 0 && info.dsShields > 0 && (
            <g data-testid="lm-flare-shimmer">
              {[0, 1, 2].map((k) => (
                <circle
                  key={k}
                  cx={fmt(HAND.x - 8 + k * 26)}
                  cy={fmt(HAND.y - 46 - k * 24)}
                  r="12"
                  fill="#9ff0ff"
                  fillOpacity="0.2"
                  stroke="#c8f8ff"
                  strokeWidth="2.4"
                  className="sk-shimmer"
                />
              ))}
            </g>
          )}
        </g>
      )}
      {/* flying brushing the sun: the edge of the picture goes hot-white */}
      {hot > 0 && (
        <rect
          data-testid="lm-hot-edge"
          x="-1200"
          y="-1200"
          width="2800"
          height="2800"
          fill="url(#sk-hot)"
          opacity={fmt(0.15 * hot)}
        />
      )}
      {shout && <ShoutText shout={shout} />}
    </g>
  );
}
