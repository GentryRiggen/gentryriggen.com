import { tidiness } from "@/lib/flamelings/status";
import type { Pet } from "@/lib/flamelings/types";
import FlIcon, { type FlIconName } from "./FlIcon";

const RING_RADIUS = 24;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const LOW_BELOW = 30;

interface GaugeProps {
  icon: FlIconName;
  label: string;
  value: number;
  /** The ring colour while the need is fine. */
  colour: string;
}

function Gauge({ icon, label, value, colour }: GaugeProps) {
  const low = value < LOW_BELOW;
  const shown = Math.round(value);
  const fraction = Math.min(1, Math.max(0, value / 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={shown}
      aria-valuemin={0}
      aria-valuemax={100}
      data-low={low ? "true" : "false"}
      className={`relative grid size-14 shrink-0 place-items-center rounded-full bg-[#fff6e6]/95 shadow-[0_4px_0_#e7c9a3,0_10px_24px_rgba(30,10,40,.35)] sm:size-[58px] ${
        low ? "fl-pulse-soft" : ""
      }`}
    >
      <svg viewBox="0 0 58 58" aria-hidden="true" className="absolute inset-0">
        <circle
          cx="29"
          cy="29"
          r={RING_RADIUS}
          fill="none"
          stroke="#f3dcc0"
          strokeWidth="5"
        />
        <circle
          cx="29"
          cy="29"
          r={RING_RADIUS}
          fill="none"
          stroke={low ? "#ef4444" : colour}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - fraction)}
          transform="rotate(-90 29 29)"
        />
      </svg>
      <FlIcon name={icon} className="size-6 sm:size-[26px]" />
      {low && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 grid size-[22px] place-items-center rounded-full bg-[#ef4444] text-[13px] font-bold leading-none text-white shadow-[0_0_0_3px_#fff6e6]"
        >
          !
        </span>
      )}
    </div>
  );
}

/** Fuel, joy and tidiness as round gauges: nothing to read. */
export default function Meters({ pet }: { pet: Pet }) {
  return (
    <div className="flex gap-2">
      <Gauge icon="fuel" label="Fuel" value={pet.fuel} colour="#ff8a3d" />
      <Gauge icon="joy" label="Joy" value={pet.joy} colour="#f43f5e" />
      <Gauge icon="tidy" label="Tidy" value={tidiness(pet)} colour="#38bdf8" />
    </div>
  );
}
