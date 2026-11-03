import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { GaugeView } from "@/lib/ever-onward/engine/types";
import { pixelClass } from "./retro/retroStyles";

interface GaugeMeterProps {
  gauge: GaugeView;
  /** "hud" is the slim bar on the sticky bar; "panel" is the big one. */
  size?: "hud" | "panel";
  testId?: string;
}

const BAR = {
  ok: "border-slate-600 [&::-webkit-progress-value]:bg-amber-400 [&::-moz-progress-bar]:bg-amber-400",
  low: "border-orange-400 [&::-webkit-progress-value]:bg-orange-500 [&::-moz-progress-bar]:bg-orange-500",
  critical:
    "animate-pulse border-red-400 [&::-webkit-progress-value]:bg-red-500 [&::-moz-progress-bar]:bg-red-500 motion-reduce:animate-none",
} as const;

/**
 * A resource the player has to keep topped up (the lamp's oil): a big number
 * and a thick bar that turns orange when it is getting low and red when it is
 * about to run out. The text slots keep a fixed size so nothing around it
 * shifts as the numbers change.
 */
export default function GaugeMeter({
  gauge,
  size = "hud",
  testId = "lm-gauge",
}: GaugeMeterProps) {
  const { label, current, max, isLow, isCritical } = gauge;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeCurrent = Math.min(
    safeMax,
    Math.max(0, Number.isFinite(current) ? current : 0)
  );
  const tone = isCritical ? "critical" : isLow ? "low" : "ok";
  const status = safeCurrent <= 0 ? "EMPTY" : isCritical || isLow ? "LOW" : "";
  const isBig = size === "panel";
  const color =
    tone === "critical"
      ? "text-red-300"
      : tone === "low"
        ? "text-orange-300"
        : "text-amber-100";
  return (
    <div
      data-testid={testId}
      data-tone={tone}
      role="group"
      aria-label={`${label}: ${formatNumber(Math.floor(safeCurrent))} of ${formatNumber(Math.floor(safeMax))}${status ? `, ${status.toLowerCase()}` : ""}`}
    >
      <p className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span
            className={`${pixelClass} ${isBig ? "text-sm" : "text-xs"} leading-none text-cyan-200`}
          >
            {label}
          </span>
          <span
            className={`${pixelClass} ${isBig ? "w-16 text-xs" : "w-12 text-[10px]"} leading-none ${color}`}
          >
            {status}
          </span>
        </span>
        <span
          data-testid={`${testId}-count`}
          className={`${pixelClass} shrink-0 ${isBig ? "text-xl" : "text-xs"} leading-none tabular-nums ${color}`}
        >
          {formatNumber(Math.floor(safeCurrent))} /{" "}
          {formatNumber(Math.floor(safeMax))}
        </span>
      </p>
      <progress
        aria-hidden="true"
        value={safeCurrent / safeMax}
        max={1}
        className={`mt-1.5 block w-full appearance-none overflow-hidden border-2 [&::-webkit-progress-bar]:bg-slate-900 ${
          isBig ? "h-6" : "h-3"
        } ${BAR[tone]}`}
      />
    </div>
  );
}
