/** Metres a second to miles an hour. */
const MPH = 2.237;
/**
 * Under this share of the stall speed the plane is dropping fast: red, "Slow!".
 * Between it and the stall speed the plane is sinking: amber.
 */
const DROPPING = 0.75;
/** The dial sweeps from -SWEEP to +SWEEP degrees, 0 pointing straight up. */
const SWEEP = 120;
const CX = 50;
const CY = 52;
const R = 40;

interface SpeedometerProps {
  /** m/s. */
  speed: number;
  /** Below this speed the wings can't hold the plane level, m/s. */
  stall: number;
  /** Full scale of the gauge, m/s. */
  top: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Dial angle for a share of full scale, degrees. */
const angleOf = (share: number) => -SWEEP + 2 * SWEEP * clamp01(share);

function pointAt(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

/** SVG path for the dial's arc between two shares of full scale. */
function arc(from: number, to: number): string {
  const a = angleOf(from);
  const b = angleOf(to);
  const start = pointAt(a, R);
  const end = pointAt(b, R);
  const isLarge = b - a > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${isLarge} 1 ${end.x} ${end.y}`;
}

/** A round dial with a needle: red when dropping, amber when sinking, then green. */
export default function Speedometer({ speed, stall, top }: SpeedometerProps) {
  const mph = Math.round(speed * MPH);
  const isStalling = speed < stall * DROPPING;
  const stallShare = clamp01((stall * DROPPING) / top);
  const lowShare = clamp01(stall / top);
  const needle = angleOf(speed / top);

  return (
    <div
      role="meter"
      aria-label="Speed"
      aria-valuemin={0}
      aria-valuemax={Math.round(top * MPH)}
      aria-valuenow={mph}
      aria-valuetext={`${mph} mph${isStalling ? ", too slow" : ""}`}
      className="relative h-24 w-24"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
        <circle
          cx={CX}
          cy={CY}
          r={48}
          className="fill-white/75 stroke-slate-300 dark:fill-slate-900/75 dark:stroke-slate-600"
          strokeWidth={1.5}
        />
        <g fill="none" strokeWidth={7}>
          <path
            d={arc(0, stallShare)}
            className="stroke-red-500 dark:stroke-red-400"
          />
          <path
            d={arc(stallShare, lowShare)}
            className="stroke-amber-500 dark:stroke-amber-400"
          />
          <path
            d={arc(lowShare, 1)}
            className="stroke-emerald-500 dark:stroke-emerald-400"
          />
        </g>
        <line
          x1={CX}
          y1={CY + 6}
          x2={CX}
          y2={CY - R + 6}
          transform={`rotate(${needle} ${CX} ${CY})`}
          strokeWidth={3}
          strokeLinecap="round"
          className="stroke-slate-900 dark:stroke-slate-100"
        />
        <circle
          cx={CX}
          cy={CY}
          r={4.5}
          className="fill-slate-900 dark:fill-slate-100"
        />
      </svg>
      <p className="absolute inset-x-0 bottom-1 flex flex-col items-center leading-none text-slate-900 dark:text-slate-100">
        {isStalling ? (
          <span className="text-xs font-extrabold text-red-700 dark:text-red-300">
            Slow!
          </span>
        ) : null}
        <span className="text-base font-extrabold tabular-nums">
          {mph}
          <span className="ml-0.5 text-[0.6rem] font-bold">mph</span>
        </span>
      </p>
    </div>
  );
}
