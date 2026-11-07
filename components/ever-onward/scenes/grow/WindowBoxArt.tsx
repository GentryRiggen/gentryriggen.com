import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type {
  LeafMood,
  PotStage,
  SkyId,
} from "@/lib/ever-onward/universes/grow/windowbox";
import { POT, SILL_Y } from "./anchors";

/** The window's glass, so the weather and the blind stay inside the frame. */
export const WINDOW = { x: 100, y: 24, w: 200, h: 162 } as const;

const SKY_COLORS: Record<SkyId, readonly [string, string]> = {
  rain: ["#4b5b73", "#93a4b4"],
  cloud: ["#8da2bd", "#d6dee7"],
  bright: ["#3f9cf5", "#c4e8ff"],
  heat: ["#ff8f2e", "#ffe8a3"],
};

export const skyColors = (sky: SkyId): readonly [string, string] =>
  SKY_COLORS[sky];

const RAIN: readonly (readonly [number, string])[] = [
  [112, "[animation-delay:0s]"],
  [134, "[animation-delay:0.35s]"],
  [156, "[animation-delay:0.15s]"],
  [178, "[animation-delay:0.5s]"],
  [200, "[animation-delay:0.05s]"],
  [222, "[animation-delay:0.4s]"],
  [244, "[animation-delay:0.2s]"],
  [266, "[animation-delay:0.55s]"],
  [286, "[animation-delay:0.1s]"],
];

/** The weather in the window: sun, clouds, rain or a hot spell. */
export function WeatherOutside({ sky }: { sky: SkyId }) {
  return (
    <g aria-hidden="true" data-sky={sky}>
      {(sky === "bright" || sky === "heat") && (
        <g>
          <g className="gb-sun-rays">
            {[0, 45, 90, 135].map((a) => (
              <rect
                key={a}
                x="146"
                y={sky === "heat" ? 34 : 50}
                width="8"
                height={sky === "heat" ? 92 : 60}
                fill="#fff1a8"
                fillOpacity={sky === "heat" ? 0.55 : 0.4}
                transform={`rotate(${a} 150 80)`}
              />
            ))}
          </g>
          <circle
            cx="150"
            cy="80"
            r={sky === "heat" ? 30 : 20}
            fill="#fff7c2"
            fillOpacity="0.55"
          />
          <circle
            cx="150"
            cy="80"
            r={sky === "heat" ? 22 : 14}
            fill={sky === "heat" ? "#fff0a0" : "#ffe14d"}
          />
        </g>
      )}
      {sky !== "bright" && sky !== "heat" && (
        <g className="gw-drift">
          <rect
            x="130"
            y="52"
            width="70"
            height="16"
            fill={sky === "rain" ? "#5e6f86" : "#f3f6fa"}
          />
          <rect
            x="146"
            y="40"
            width="42"
            height="14"
            fill={sky === "rain" ? "#5e6f86" : "#f3f6fa"}
          />
          <rect
            x="214"
            y="72"
            width="64"
            height="14"
            fill={sky === "rain" ? "#56677e" : "#e8edf4"}
          />
          <rect
            x="226"
            y="62"
            width="34"
            height="12"
            fill={sky === "rain" ? "#56677e" : "#e8edf4"}
          />
        </g>
      )}
      {sky === "bright" && (
        <g className="gw-drift">
          <rect x="220" y="46" width="40" height="8" fill="#ffffff" />
          <rect x="230" y="40" width="20" height="7" fill="#ffffff" />
        </g>
      )}
      {sky === "rain" &&
        RAIN.map(([x, delay]) => (
          <rect
            key={x}
            x={x}
            y="40"
            width="2"
            height="12"
            fill="#cfe6ff"
            fillOpacity="0.85"
            className={`gb-rain ${delay}`}
          />
        ))}
      {sky === "heat" && (
        <g fill="#fff6d0" className="gb-shimmer">
          <rect x="108" y="150" width="184" height="3" fillOpacity="0.5" />
          <rect x="118" y="160" width="164" height="3" fillOpacity="0.4" />
          <rect x="108" y="170" width="184" height="3" fillOpacity="0.3" />
        </g>
      )}
    </g>
  );
}

/** The slatted roman blind, rolled down from the top of the window. */
export function Blind({ light }: { light: number }) {
  return (
    <g
      data-testid="eo-blind"
      data-light={light}
      aria-hidden="true"
      className={`gb-blind gb-open-${light}`}
    >
      <rect
        x={WINDOW.x}
        y={WINDOW.y}
        width={WINDOW.w}
        height={WINDOW.h}
        fill="#e3d2a8"
      />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
        <rect
          key={i}
          x={WINDOW.x}
          y={WINDOW.y + 8 + i * 10}
          width={WINDOW.w}
          height="2"
          fill="#c4ae80"
        />
      ))}
      <rect
        x={WINDOW.x}
        y={WINDOW.y + WINDOW.h - 6}
        width={WINDOW.w}
        height="6"
        fill="#9a7a4a"
      />
      <rect
        x={WINDOW.x + WINDOW.w / 2 - 2}
        y={WINDOW.y + WINDOW.h - 14}
        width="4"
        height="14"
        fill="#7a5a30"
      />
    </g>
  );
}

const GLARE_FILL = [0, 0.16, 0.3, 0.46] as const;

/** Light pouring through the window onto the pot, as strong as the glare. */
export function SunBeam({ glare, sky }: { glare: number; sky: SkyId }) {
  if (glare <= 0) return null;
  const hot = glare >= 3;
  return (
    <g aria-hidden="true" data-testid="eo-sunbeam" data-glare={glare}>
      <g className="gb-beam">
        <path
          d="M104 26 L236 26 L286 186 L128 186 Z"
          fill={hot ? "#ffd24a" : "#fff0a0"}
          fillOpacity={GLARE_FILL[glare] * 0.7}
        />
        <path
          d="M140 26 L196 26 L244 186 L170 186 Z"
          fill={hot ? "#ffb02e" : "#ffe36a"}
          fillOpacity={GLARE_FILL[glare] * 0.8}
        />
      </g>
      {sky !== "rain" && glare >= 2 && (
        <g fill="#fffbd6" className="gb-motes">
          <rect x="150" y="70" width="3" height="3" />
          <rect x="190" y="104" width="2" height="2" />
          <rect x="222" y="82" width="3" height="3" />
          <rect x="176" y="130" width="2" height="2" />
        </g>
      )}
    </g>
  );
}

/** A dim blue wash on the room when the blind is mostly down. */
export function ShadeWash({ light }: { light: number }) {
  if (light > 3) return null;
  return (
    <rect
      aria-hidden="true"
      data-testid="eo-shade"
      x="-1200"
      y="-1200"
      width="2800"
      height="2700"
      fill="#0b1a3a"
      fillOpacity={light <= 1 ? 0.34 : 0.2}
      className="pointer-events-none"
    />
  );
}

interface LeafLook {
  /** Degrees up from level (negative hangs down). */
  up: number;
  scale: number;
  color: string;
  tip: string;
}

const LEAF_LOOK: Record<LeafMood, LeafLook> = {
  perky: { up: 28, scale: 1.15, color: "#4fd04a", tip: "#8cf070" },
  curl: { up: 62, scale: 0.8, color: "#b4c64a", tip: "#a8742c" },
  dry: { up: 80, scale: 0.55, color: "#a8742c", tip: "#6e4a1c" },
  droop: { up: -48, scale: 1, color: "#2f8a4a", tip: "#2f8a4a" },
  soggy: { up: -72, scale: 1, color: "#79b8a0", tip: "#9fd0c0" },
};

/** The plant's soil colours by mood (and a puddle when it is too wet). */
const SOIL: Record<LeafMood, string> = {
  perky: "#3b2412",
  curl: "#7b5a36",
  dry: "#b58a54",
  droop: "#2a1a0c",
  soggy: "#1e1208",
};

export const soilColor = (leaf: LeafMood): string => SOIL[leaf];

interface LeafSpec {
  side: -1 | 1;
  at: number;
  len: number;
}

const LEAVES: readonly LeafSpec[] = [
  { side: -1, at: 0.38, len: 14 },
  { side: 1, at: 0.56, len: 15 },
  { side: -1, at: 0.74, len: 13 },
  { side: 1, at: 0.88, len: 12 },
];

/** The leaves: they stand perky or hang, curl or crisp up, as the soil is. */
function Leaves({
  stage,
  h,
  leaf,
}: {
  stage: PotStage;
  h: number;
  leaf: LeafMood;
}) {
  const look = LEAF_LOOK[leaf];
  const count = stage === "sprout" ? 2 : h > 30 ? 4 : 3;
  return (
    <g data-testid="eo-leaves" data-leaf={leaf}>
      {LEAVES.slice(0, count).map(({ side, at, len }) => {
        const ax = POT.x;
        const ay = POT.y - h * at;
        const l = Math.round(len * look.scale * (stage === "sprout" ? 0.8 : 1));
        return (
          <g
            key={`${side}-${at}`}
            transform={`rotate(${-side * look.up} ${ax} ${ay})`}
          >
            <rect
              x={side < 0 ? ax - l : ax}
              y={ay - 3}
              width={l}
              height="6"
              fill={look.color}
            />
            <rect
              x={side < 0 ? ax - l : ax + l - 4}
              y={ay - 3}
              width="4"
              height="6"
              fill={look.tip}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * The plant, reading its soil: perky green leaves when it is just right,
 * curling and crisp when dry, hanging pale and floppy when soggy. The flower
 * head droops with the leaves.
 */
export function LeafPlant({
  stage,
  growth,
  leaf = "perky",
  isThriving = false,
}: {
  stage: PotStage;
  growth: number;
  leaf?: LeafMood;
  isThriving?: boolean;
}) {
  const h = stage === "soil" ? 0 : Math.round(8 + growth * 0.5);
  const top = POT.y - h;
  const sag = leaf === "droop" ? 14 : leaf === "soggy" ? 24 : 0;
  const crisp = leaf === "dry" || leaf === "curl";
  const stem = leaf === "soggy" ? "#6aa88c" : crisp ? "#9a8a3a" : "#3f9d3a";
  return (
    <g
      data-testid="eo-plant"
      data-leaf={leaf}
      className={
        isThriving ? "gb-thrive" : leaf === "dry" ? "gb-parched" : undefined
      }
    >
      {stage === "bloom" && (
        <circle cx={POT.x} cy={top} r="34" fill="url(#gs-bloom)" />
      )}
      {stage === "soil" && (
        <rect x={POT.x - 2} y={POT.y - 3} width="4" height="3" fill="#5a3a22" />
      )}
      <g
        className={stage === "soil" || leaf !== "perky" ? undefined : "gg-sway"}
      >
        {stage !== "soil" && (
          <rect x={POT.x - 1} y={top} width="3" height={h} fill={stem} />
        )}
        {stage !== "soil" && <Leaves stage={stage} h={h} leaf={leaf} />}
        <g
          transform={sag > 0 ? `rotate(${sag} ${POT.x} ${top + 8})` : undefined}
        >
          {stage === "bud" && (
            <g>
              <rect
                x={POT.x - 4}
                y={top - 8}
                width="9"
                height="10"
                fill={crisp ? "#b9768f" : "#e879a8"}
              />
              <rect
                x={POT.x - 3}
                y={top - 10}
                width="7"
                height="3"
                fill={crisp ? "#cfa0b0" : "#f9a8c9"}
              />
            </g>
          )}
          {stage === "bloom" && (
            <g>
              <rect
                x={POT.x - 12}
                y={top - 12}
                width="25"
                height="22"
                fill="#fb7185"
              />
              <rect
                x={POT.x - 16}
                y={top - 7}
                width="33"
                height="12"
                fill="#fda4af"
              />
              <rect
                x={POT.x - 8}
                y={top - 17}
                width="17"
                height="8"
                fill="#fda4af"
              />
              <rect
                x={POT.x - 4}
                y={top - 7}
                width="9"
                height="9"
                fill="#fde047"
              />
            </g>
          )}
        </g>
      </g>
    </g>
  );
}

/** What the soil does while the leaves tell their story: cracks or puddles. */
export function SoilState({ leaf }: { leaf: LeafMood }) {
  if (leaf === "dry" || leaf === "curl")
    return (
      <g aria-hidden="true" fill="#5a3a1c">
        <rect x={POT.x - 12} y={POT.y - 2} width="8" height="2" />
        <rect x={POT.x + 3} y={POT.y - 2} width="10" height="2" />
        <rect x={POT.x - 3} y={POT.y} width="2" height="3" />
      </g>
    );
  if (leaf === "droop" || leaf === "soggy")
    return (
      <g aria-hidden="true">
        <rect
          x={POT.x - 30}
          y={SILL_Y - 2}
          width="60"
          height="4"
          fill="#7cc4ff"
          fillOpacity={leaf === "soggy" ? 0.8 : 0.5}
          className="gb-puddle"
        />
        <g className="gb-drip" fill="#9fd8ff">
          <rect x={POT.x - 17} y={POT.y + 6} width="3" height="5" />
        </g>
        {leaf === "soggy" && (
          <g className="gb-drip [animation-delay:0.7s]" fill="#9fd8ff">
            <rect x={POT.x + 14} y={POT.y + 8} width="3" height="5" />
          </g>
        )}
      </g>
    );
  return null;
}

const SPARKLES: readonly (readonly [number, number, string])[] = [
  [-34, -10, "[animation-delay:0s]"],
  [30, -22, "[animation-delay:0.25s]"],
  [-18, -44, "[animation-delay:0.5s]"],
  [22, -52, "[animation-delay:0.15s]"],
  [-40, -34, "[animation-delay:0.7s]"],
  [42, -6, "[animation-delay:0.4s]"],
  [2, -62, "[animation-delay:0.6s]"],
  [-8, -24, "[animation-delay:0.1s]"],
];

const MOMENT_WORDS = {
  thrive: { text: "THRIVING!", fill: "#fff3bf", stroke: "#b8860b" },
  dry: { text: "DRIED OUT!", fill: "#ffd8a8", stroke: "#8a3b00" },
  soggy: { text: "TOO WET!", fill: "#d0ebff", stroke: "#1c4a7a" },
} as const;

/**
 * The big moment in the scene: a thrive (gold glow, rising sparkles, rings,
 * "THRIVING!"), or a dry or soggy spell (a flash, dust or drips, and the
 * word). Small and recoverable: the leaves perk back up once the blind moves.
 */
export function PotMoment({
  moment,
}: {
  moment: Exclude<GrowSceneInfo["moment"], "">;
}) {
  const word = MOMENT_WORDS[moment];
  return (
    <g aria-hidden="true" data-testid="eo-moment" data-moment={moment}>
      {moment === "thrive" && (
        <g>
          <circle
            cx={POT.x}
            cy={POT.y - 20}
            r="64"
            fill="#ffe066"
            fillOpacity="0.32"
            className="gp-poof"
          />
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="2700"
            fill="#fff3bf"
            className="gp-flash"
          />
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={POT.x}
              cy={POT.y - 18}
              r="12"
              fill="none"
              stroke={i === 1 ? "#ffd43b" : "#fff3bf"}
              strokeWidth="3"
              className={`gp-ring ${["[animation-delay:0s]", "[animation-delay:0.5s]", "[animation-delay:1s]"][i]}`}
            />
          ))}
          {SPARKLES.map(([dx, dy, delay]) => (
            <g key={`${dx}-${dy}`} className={`gb-sparkle ${delay}`}>
              <rect
                x={POT.x + dx - 1}
                y={POT.y + dy - 4}
                width="3"
                height="9"
                fill="#fff3bf"
              />
              <rect
                x={POT.x + dx - 4}
                y={POT.y + dy - 1}
                width="9"
                height="3"
                fill="#ffd43b"
              />
            </g>
          ))}
        </g>
      )}
      {moment === "dry" && (
        <g>
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="2700"
            fill="#ff922b"
            className="gp-flash"
          />
          {[-16, 0, 16].map((dx, i) => (
            <circle
              key={dx}
              cx={POT.x + dx}
              cy={POT.y - 2}
              r="8"
              fill="#d9b382"
              fillOpacity="0.8"
              className={`gp-poof ${["[animation-delay:0s]", "[animation-delay:0.3s]", "[animation-delay:0.6s]"][i]}`}
            />
          ))}
          {[-20, -6, 10, 22].map((dx, i) => (
            <rect
              key={dx}
              x={POT.x + dx}
              y={POT.y - 30}
              width="4"
              height="5"
              fill="#a8742c"
              className={`gp-fall ${["[animation-delay:0s]", "[animation-delay:0.4s]", "[animation-delay:0.8s]", "[animation-delay:0.2s]"][i]}`}
            />
          ))}
        </g>
      )}
      {moment === "soggy" && (
        <g>
          <rect
            x="-1200"
            y="-1200"
            width="2800"
            height="2700"
            fill="#4dabf7"
            className="gp-flash"
          />
          {[-22, -8, 8, 24, -30, 30].map((dx, i) => (
            <rect
              key={dx}
              x={POT.x + dx}
              y={POT.y - 40}
              width="5"
              height="8"
              fill="#74c0fc"
              stroke="#1c4a7a"
              strokeWidth="1"
              className={`gp-fall ${["[animation-delay:0s]", "[animation-delay:0.3s]", "[animation-delay:0.6s]", "[animation-delay:0.15s]", "[animation-delay:0.45s]", "[animation-delay:0.75s]"][i]}`}
            />
          ))}
          <rect
            x={POT.x - 46}
            y={SILL_Y - 3}
            width="92"
            height="6"
            fill="#74c0fc"
            fillOpacity="0.85"
            className="gb-puddle"
          />
        </g>
      )}
      <g className="gp-shout">
        <rect
          x="-1200"
          y="58"
          width="2800"
          height="30"
          fill={word.stroke}
          fillOpacity="0.85"
        />
        <text
          x={POT.x}
          y="82"
          textAnchor="middle"
          className="font-[family-name:var(--font-eo-pixel)]"
          fontSize="19"
          fill={word.fill}
          stroke={word.stroke}
          strokeWidth="5"
          paintOrder="stroke"
        >
          {word.text}
        </text>
      </g>
    </g>
  );
}
