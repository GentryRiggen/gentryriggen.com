import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import { TUNING } from "@/lib/ever-onward/universes/grow/tuning";

/**
 * The prize pumpkin on its podium in front of the fair tent. It swells a
 * step at a time (and starts to strain, with hairline cracks, when it is
 * big). On a feeding that goes wrong it SPLITS: a crack of red light, pieces
 * of pumpkin flying, a splat on the ground and "SPLAT!". Entered, the judges
 * walk the row and it comes home with a giant rosette and a rain of confetti.
 */

/** The podium's middle and its top (the pumpkin sits on it). */
const CX = 238;
const TOP = 150;
/** The pumpkin's banners sit low in the picture, under the harvest day's. */
const BANNER_Y = 218;

const STAGGER = [
  "[animation-delay:0s]",
  "[animation-delay:0.12s]",
  "[animation-delay:0.24s]",
  "[animation-delay:0.36s]",
  "[animation-delay:0.48s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.72s]",
  "[animation-delay:0.84s]",
  "[animation-delay:0.96s]",
  "[animation-delay:1.08s]",
  "[animation-delay:1.2s]",
  "[animation-delay:1.32s]",
] as const;

const CONFETTI = [
  "#ff6b6b",
  "#ffd43b",
  "#69db7c",
  "#4dabf7",
  "#da77f2",
  "#ffa94d",
] as const;

const RIBBON_STYLES = {
  blue: {
    outer: "#1c4fd0",
    inner: "#4c7ff7",
    tail: "#1c4fd0",
    word: "BLUE RIBBON!",
    ink: "#1b2f7a",
    fill: "#dbe7ff",
  },
  red: {
    outer: "#b81d1d",
    inner: "#f05252",
    tail: "#b81d1d",
    word: "RED RIBBON!",
    ink: "#5c0d0d",
    fill: "#ffe0e0",
  },
  green: {
    outer: "#1f7a34",
    inner: "#4cc26a",
    tail: "#1f7a34",
    word: "GARDEN RIBBON!",
    ink: "#0e3d1a",
    fill: "#dcf7e2",
  },
} as const;

type RibbonKind = keyof typeof RIBBON_STYLES;

/** A pumpkin drawn 28 wide and 20 tall, its bottom middle at (0, 0). */
function Pumpkin({
  step,
  strain,
  glow,
}: {
  step: number;
  strain: boolean;
  glow: boolean;
}) {
  return (
    <g className={`gf-pk gf-pk-${step}`} data-testid="eo-pumpkin-body">
      <rect x="-12" y="-18" width="24" height="18" fill="#f08a24" />
      <rect x="-14" y="-15" width="28" height="12" fill="#f08a24" />
      <rect x="-9" y="-20" width="18" height="20" fill="#f6a04a" />
      <rect x="-14" y="-9" width="28" height="3" fill="#e07814" />
      <rect x="-8" y="-20" width="1.5" height="20" fill="#c96a10" />
      <rect x="-0.8" y="-20" width="1.5" height="20" fill="#c96a10" />
      <rect x="6.5" y="-20" width="1.5" height="20" fill="#c96a10" />
      <rect x="-10" y="-16" width="4" height="4" fill="#ffc78a" />
      <rect x="-1.5" y="-25" width="3" height="6" fill="#3f7a2a" />
      <rect x="1.5" y="-24" width="6" height="2.5" fill="#58bf4f" />
      {glow && (
        <rect
          x="-14"
          y="-19"
          width="28"
          height="19"
          fill="#fff3bf"
          fillOpacity="0.18"
        />
      )}
      {strain && (
        <g fill="#7c2d12">
          <rect x="3" y="-18" width="1.2" height="5" />
          <rect x="4.2" y="-14" width="1.2" height="4" />
          <rect x="-6" y="-12" width="1.2" height="6" />
          <rect x="-4.8" y="-7" width="1.2" height="4" />
        </g>
      )}
    </g>
  );
}

function Rosette({ kind }: { kind: RibbonKind }) {
  const r = RIBBON_STYLES[kind];
  return (
    <g className="gp-pop" data-testid="eo-rosette" data-ribbon={kind}>
      <rect x="-9" y="8" width="7" height="22" fill={r.tail} />
      <rect x="2" y="8" width="7" height="22" fill={r.tail} />
      <rect x="-9" y="26" width="7" height="4" fill="#fff3bf" />
      <rect x="2" y="26" width="7" height="4" fill="#fff3bf" />
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * Math.PI * 2;
        return (
          <rect
            key={k}
            x={Math.cos(a) * 12 - 3.5}
            y={Math.sin(a) * 12 - 3.5}
            width="7"
            height="7"
            fill={r.outer}
          />
        );
      })}
      <circle cx="0" cy="0" r="11" fill={r.inner} />
      <circle cx="0" cy="0" r="6" fill={r.fill} />
      <rect x="-1.5" y="-4" width="3" height="8" fill={r.ink} />
    </g>
  );
}

function Confetti({ count }: { count: number }) {
  return (
    <g aria-hidden="true">
      {Array.from({ length: count }, (_, k) => (
        <rect
          key={k}
          className={`gf-confetti ${STAGGER[k % STAGGER.length]}`}
          x={CX - 70 + ((k * 23) % 140)}
          y={52 + (k % 4) * 8}
          width="4"
          height="6"
          fill={CONFETTI[k % CONFETTI.length]}
        />
      ))}
    </g>
  );
}

/** A ribbon win: the pumpkin wears a giant rosette, with confetti and rings. */
function Win({ kind, step }: { kind: RibbonKind; step: number }) {
  const r = RIBBON_STYLES[kind];
  const big = kind === "blue";
  return (
    <g data-testid="eo-pumpkin-win">
      <g aria-hidden="true">
        <rect
          className="gp-flash"
          x="-10"
          y="60"
          width="420"
          height="240"
          fill={r.inner}
        />
        {[0, 1, 2, 3].map((k) => (
          <circle
            key={k}
            className={`gp-ring ${STAGGER[k * 2]}`}
            cx={CX}
            cy={TOP - 28}
            r={10 + k * 5}
            fill="none"
            stroke={k % 2 ? "#fff3bf" : r.inner}
            strokeWidth="3"
          />
        ))}
        {Array.from({ length: 12 }, (_, k) => (
          <rect
            key={k}
            className={`gp-spark gp-spark-${k}`}
            x={CX - 2}
            y={TOP - 30}
            width="4"
            height="4"
            fill={CONFETTI[k % CONFETTI.length]}
          />
        ))}
      </g>
      <Confetti count={big ? 24 : kind === "red" ? 16 : 10} />
      <g transform={`translate(${CX + 10 + step * 4} ${TOP - 14 - step * 6})`}>
        <g transform={`scale(${big ? 2 : kind === "red" ? 1.6 : 1.3})`}>
          <Rosette kind={kind} />
        </g>
      </g>
      <text
        x={CX}
        y={BANNER_Y}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="17"
        fill="#fff3bf"
        stroke={r.ink}
        strokeWidth="4"
        paintOrder="stroke"
      >
        {r.word}
      </text>
    </g>
  );
}

const BIT_COLORS = [
  "#f08a24",
  "#f6a04a",
  "#c96a10",
  "#ffe066",
  "#f08a24",
] as const;

/** A split: red flash, pumpkin pieces everywhere, a splat and a shout. */
function Split({ step }: { step: number }) {
  const scale = [0.35, 0.7, 1.1, 1.6, 2.2, 3][step] ?? 1;
  return (
    <g data-testid="eo-pumpkin-split">
      <g aria-hidden="true">
        <rect
          className="gp-flash"
          x="-10"
          y="60"
          width="420"
          height="240"
          fill="#ff6b6b"
        />
        <ellipse
          className="gf-splat"
          cx={CX}
          cy={TOP + 2}
          rx={20 + step * 6}
          ry={4 + step}
          fill="#f08a24"
        />
        {Array.from({ length: 14 }, (_, k) => (
          <rect
            key={k}
            className={`gf-bit gf-bit-${k}`}
            x={CX - 3}
            y={TOP - 12 - step * 3}
            width={6 + (k % 3) * 3 + step * 2}
            height={6 + ((k + 1) % 3) * 3 + step * 2}
            fill={BIT_COLORS[k % BIT_COLORS.length]}
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <rect
            key={k}
            className={`gf-bit gf-bit-${k + 4}`}
            x={CX + 1}
            y={TOP - 14 - step * 3}
            width="2"
            height="4"
            fill="#fff3bf"
          />
        ))}
        {/* the two broken halves left on the podium */}
        <g transform={`translate(${CX} ${TOP}) scale(${Math.min(scale, 1.4)})`}>
          <rect x="-15" y="-9" width="12" height="9" fill="#f08a24" />
          <rect x="-13" y="-7" width="8" height="5" fill="#ffe066" />
          <rect x="4" y="-7" width="12" height="7" fill="#e07814" />
          <rect x="6" y="-5" width="7" height="3" fill="#ffe066" />
        </g>
      </g>
      <text
        x={CX}
        y={BANNER_Y}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="26"
        fill="#ffd8a8"
        stroke="#7c2d12"
        strokeWidth="5"
        paintOrder="stroke"
      >
        SPLAT!
      </text>
    </g>
  );
}

/** A judge with a clipboard walks the row while the pumpkin waits. */
function Judge() {
  return (
    <g aria-hidden="true" data-testid="eo-judge" className="gf-judge">
      <rect x="0" y={TOP - 18} width="7" height="7" fill="#e8c27a" />
      <rect x="-1" y={TOP - 21} width="9" height="4" fill="#1b1b24" />
      <rect x="-1" y={TOP - 11} width="9" height="10" fill="#5c3b9a" />
      <rect x="9" y={TOP - 10} width="7" height="9" fill="#f8f9fa" />
      <rect x="10.5" y={TOP - 8} width="4" height="1" fill="#868e96" />
      <rect x="1" y={TOP - 1} width="2.5" height="5" fill="#1b1b24" />
      <rect x="4.5" y={TOP - 1} width="2.5" height="5" fill="#1b1b24" />
    </g>
  );
}

export default function PrizePumpkin({ info }: { info: GrowSceneInfo }) {
  if (!info.pumpkinOpen) return null;
  const [kind, stepText] = info.pumpkinShow.split(":");
  const showStep = Number(stepText) || 0;
  const steps = TUNING.pumpkin.steps;
  const isOutcome =
    kind === "blue" || kind === "red" || kind === "green" || kind === "split";
  const isJudging = kind === "judging";
  // While a ribbon or a split shows, the pumpkin that was entered is the
  // one on the podium; a new seedling waits beside it.
  const step = isOutcome || isJudging ? showStep : info.pumpkinStep;
  const isBig = step >= steps - 1;
  return (
    <g
      data-testid="eo-prize-pumpkin"
      data-step={info.pumpkinStep}
      data-show={info.pumpkinShow}
    >
      {/* the podium */}
      <rect x={CX - 26} y={TOP} width="52" height="7" fill="#9c6b30" />
      <rect x={CX - 26} y={TOP} width="52" height="2" fill="#b78545" />
      <rect x={CX - 22} y={TOP + 7} width="44" height="3" fill="#6b4423" />
      <rect x={CX - 1} y={TOP + 10} width="2" height="6" fill="#6b4423" />
      <rect x={CX - 12} y={TOP + 10} width="24" height="7" fill="#fff3bf" />
      <text
        x={CX}
        y={TOP + 15.6}
        textAnchor="middle"
        className="font-[family-name:var(--font-eo-pixel)]"
        fontSize="5"
        fill="#7c2d12"
      >
        PRIZE
      </text>
      {kind === "split" ? (
        <g key={`split-${info.pumpkinN}`}>
          <Split step={showStep} />
        </g>
      ) : (
        <g transform={`translate(${CX} ${TOP})`}>
          {isBig && !isOutcome && (
            <circle
              className="gp-glow"
              cx="0"
              cy={-step * 4}
              r={step * 9}
              fill="#ffe066"
              fillOpacity="0.25"
            />
          )}
          <g
            className={
              isJudging ? "gf-wobble" : isBig ? "gp-shiver" : undefined
            }
          >
            <Pumpkin step={step} strain={step >= steps - 2} glow={isBig} />
          </g>
        </g>
      )}
      {isJudging && <Judge />}
      {isJudging && (
        <text
          x={CX}
          y={BANNER_Y}
          textAnchor="middle"
          className="gp-blink font-[family-name:var(--font-eo-pixel)]"
          fontSize="10"
          fill="#fff3bf"
          stroke="#365314"
          strokeWidth="3"
          paintOrder="stroke"
        >
          THE JUDGES ARE LOOKING...
        </text>
      )}
      {(kind === "blue" || kind === "red" || kind === "green") && (
        <Win key={`win-${info.pumpkinN}`} kind={kind} step={showStep} />
      )}
      {/* After a ribbon or a split, a new seedling grows beside the podium. */}
      {isOutcome && (
        <g transform={`translate(${CX + 36} ${TOP + 6})`}>
          <Pumpkin step={0} strain={false} glow={false} />
        </g>
      )}
      {info.pumpkinFree && !isOutcome && !isJudging && (
        <text
          x={CX}
          y={TOP - 56 - step * 4}
          textAnchor="middle"
          className="gp-blink font-[family-name:var(--font-eo-pixel)]"
          fontSize="6"
          fill="#fff3bf"
          stroke="#365314"
          strokeWidth="2.5"
          paintOrder="stroke"
        >
          FAIR DAY! FEED OR ENTER
        </text>
      )}
    </g>
  );
}
