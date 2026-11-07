import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { Face, PixelText } from "./parts";

interface LayerProps {
  info: SmileSceneInfo;
}

const RAINBOW = [
  "#ff6b6b",
  "#ffa94d",
  "#ffd43b",
  "#69db7c",
  "#4dabf7",
  "#9775fa",
] as const;

/** Static delay classes (Tailwind only sees whole class names). */
const STAGGER = [
  "[animation-delay:0s]",
  "[animation-delay:0.2s]",
  "[animation-delay:0.4s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.8s]",
  "[animation-delay:1s]",
] as const;

/** The head of the friend on the step. */
const HEAD = { x: 175, y: 153 };

/** How strongly the bubble shows: a hunch is faint, a sure face is bold. */
const BUBBLE_OPACITY = ["opacity-60", "opacity-85", "opacity-100"] as const;

function Ear() {
  return (
    <g>
      <rect x="222" y="104" width="12" height="4" fill="#e58f9d" />
      <rect x="218" y="108" width="5" height="16" fill="#e58f9d" />
      <rect x="234" y="108" width="5" height="12" fill="#e58f9d" />
      <rect x="222" y="124" width="10" height="4" fill="#e58f9d" />
      <rect x="226" y="112" width="8" height="10" fill="#ffd0d8" />
      <rect x="230" y="128" width="4" height="4" fill="#e58f9d" />
    </g>
  );
}

function Ball() {
  return (
    <g>
      <rect x="220" y="108" width="16" height="16" fill="#2b2140" />
      <rect x="222" y="110" width="12" height="12" fill="#ff5d73" />
      <rect x="224" y="112" width="4" height="4" fill="#ffd0d8" />
      <rect x="218" y="126" width="6" height="2" fill="#9a8a6a" />
      <rect x="228" y="126" width="6" height="2" fill="#9a8a6a" />
    </g>
  );
}

/** What the friend's face seems to want next. It can be wrong. */
function Hint({ hint, sure }: { hint: number; sure: number }) {
  return (
    <g aria-hidden="true" data-testid="eo-face-hint" data-hint={hint}>
      <g className={BUBBLE_OPACITY[sure]}>
        <rect x="192" y="98" width="68" height="38" fill="#2b2140" />
        <rect x="195" y="101" width="62" height="32" fill="#fff6d6" />
        <rect x="192" y="128" width="6" height="4" fill="#2b2140" />
        <rect x="188" y="132" width="6" height="4" fill="#2b2140" />
        <rect x="184" y="136" width="6" height="4" fill="#2b2140" />
        <rect x="195" y="128" width="3" height="3" fill="#fff6d6" />
        <rect x="191" y="132" width="3" height="3" fill="#fff6d6" />
        {hint === 0 && <Face x={218} y={105} size={22} mood="grin" />}
        {hint === 1 && <Ball />}
        {hint === 2 && <Ear />}
      </g>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={214 + i * 10}
          y="141"
          width="6"
          height="6"
          fill={i <= sure ? "#ff7a00" : "#d6c9a0"}
          stroke="#2b2140"
          strokeWidth="1"
        />
      ))}
      {sure === 0 && (
        <g className="ms-t-pulse">
          <PixelText x={252} y={110} size={14} fill="#7a5cff">
            ?
          </PixelText>
        </g>
      )}
    </g>
  );
}

/** What you are doing together, going on while you do it. */
function Doing({ doing, switching }: { doing: number; switching: boolean }) {
  if (switching)
    return (
      <g aria-hidden="true" fill="#fff6d6">
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            className={`ms-t-pulse ${STAGGER[i]}`}
            x={210 + i * 9}
            y="154"
            width="5"
            height="5"
          />
        ))}
      </g>
    );
  if (doing === 0)
    return (
      <g aria-hidden="true">
        {[
          [110, 126, "#ff7a00"],
          [286, 120, "#ff5d73"],
          [302, 172, "#4cc9f0"],
        ].map(([x, y, color], i) => (
          <g key={x} className={`ms-t-pop ${STAGGER[i * 2]}`}>
            <PixelText
              x={x as number}
              y={y as number}
              size={12}
              fill={color as string}
            >
              HA!
            </PixelText>
          </g>
        ))}
      </g>
    );
  if (doing === 1)
    return (
      <g aria-hidden="true">
        <g className="ms-t-fetch">
          <rect x="92" y="236" width="9" height="9" fill="#2b2140" />
          <rect x="93" y="237" width="7" height="7" fill="#ff5d73" />
          <rect x="94" y="238" width="2" height="2" fill="#ffd0d8" />
        </g>
      </g>
    );
  return (
    <g aria-hidden="true" fill="#ff5d73">
      {[0, 1, 2].map((i) => (
        <g key={i} className={`ms-t-heart ${STAGGER[i * 2]}`}>
          <rect x={118 + i * 5} y="196" width="3" height="3" />
          <rect x={121 + i * 5} y="196" width="3" height="3" />
          <rect x={118 + i * 5} y="199" width="6" height="3" />
          <rect x={120 + i * 5} y="202" width="2" height="2" />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          className={`ms-t-pulse ${STAGGER[i]}`}
          x={194 + i * 8}
          y="164"
          width="4"
          height="4"
          fill="#fff6d6"
        />
      ))}
    </g>
  );
}

function Cloud({
  x,
  y,
  fill,
  k = 1,
}: {
  x: number;
  y: number;
  fill: string;
  k?: number;
}) {
  return (
    <g fill={fill}>
      <rect x={x} y={y + 8 * k} width={44 * k} height={12 * k} />
      <rect x={x + 6 * k} y={y + 2 * k} width={18 * k} height={10 * k} />
      <rect x={x + 20 * k} y={y} width={18 * k} height={12 * k} />
      <rect
        x={x + 4 * k}
        y={y + 20 * k}
        width={36 * k}
        height={3 * k}
        fill="#6b7585"
      />
    </g>
  );
}

/** Worn thin: a small grey cloud that stays until it recovers. */
function ThinCloud() {
  return (
    <g aria-hidden="true" className="ms-bob" data-testid="eo-thin-cloud">
      <Cloud x={132} y={116} fill="#aab3c2" />
    </g>
  );
}

/** They lit up: a flash, a sun, rings, sparks and a shout. */
function LitUp() {
  return (
    <g aria-hidden="true" data-testid="eo-lit-up">
      <rect
        className="ms-t-flash"
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill="#fff3a0"
      />
      <g className="ms-t-sun">
        <circle
          cx={HEAD.x}
          cy={HEAD.y}
          r="50"
          fill="#ffe14d"
          fillOpacity="0.55"
        />
        <circle
          cx={HEAD.x}
          cy={HEAD.y}
          r="32"
          fill="#fff3a0"
          fillOpacity="0.8"
        />
      </g>
      {[0, 1, 2].map((k) => (
        <circle
          key={k}
          className={`ms-t-ring ${STAGGER[k]}`}
          cx={HEAD.x}
          cy={HEAD.y}
          r={14 + k * 5}
          fill="none"
          stroke={["#ffd23f", "#ff9eb0", "#7bed9f"][k]}
          strokeWidth="3"
        />
      ))}
      {Array.from({ length: 12 }, (_, k) => (
        <rect
          key={k}
          className={`ms-t-spark ms-t-spark-${k}`}
          x={HEAD.x - 4}
          y={HEAD.y - 4}
          width="8"
          height="8"
          fill={RAINBOW[k % RAINBOW.length]}
        />
      ))}
      <text
        x="200"
        y="76"
        textAnchor="middle"
        className="ms-t-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="17"
        fill="#fff3a0"
        stroke="#d9480f"
        strokeWidth="3"
        paintOrder="stroke"
      >
        THEY SMILED!
      </text>
    </g>
  );
}

/** A gentle sigh: a grey cloud, a little drizzle, nothing harsh. */
function Sigh({ isThin }: { isThin: boolean }) {
  return (
    <g
      aria-hidden="true"
      data-testid="eo-sigh"
      data-why={isThin ? "thin" : "miss"}
    >
      <rect
        className="ms-t-grey"
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill="#475569"
      />
      <g className="ms-t-cloud">
        <Cloud x={142} y={110} fill="#8b95a5" k={1.5} />
      </g>
      {[0, 1, 2, 3].map((k) => (
        <rect
          key={k}
          className={`ms-t-drop ${STAGGER[k]}`}
          x={152 + k * 14}
          y="142"
          width="3"
          height="6"
          fill="#7aa2d6"
        />
      ))}
      <text
        x="200"
        y="76"
        textAnchor="middle"
        className="ms-t-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="15"
        fill="#e2e8f0"
        stroke="#334155"
        strokeWidth="3"
        paintOrder="stroke"
      >
        {isThin ? "WORN THIN..." : "*SIGH*"}
      </text>
    </g>
  );
}

/**
 * What you do together, drawn over the step: the friend's face hint, what you
 * are doing, and the big moments (lit up for a right guess, a gentle sigh for a
 * miss or an activity worn thin).
 */
export default function TogetherLayer({ info }: LayerProps) {
  if (info.hint < 0) return null;
  return (
    <g data-testid="eo-together-scene" data-doing={info.doing}>
      <Hint hint={info.hint} sure={info.sure} />
      <Doing doing={info.doing} switching={info.switching} />
      {info.thin >= 3 && !info.sigh && <ThinCloud />}
      {info.lit && <LitUp />}
      {info.sigh && <Sigh isThin={info.sighThin} />}
    </g>
  );
}
