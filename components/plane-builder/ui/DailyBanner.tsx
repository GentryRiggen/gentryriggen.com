"use client";

import { TWIST_INFO } from "@/lib/plane-builder/daily/daily";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";

/** In the hangar of a daily challenge: today's twist and your best time. */
export default function DailyBanner() {
  const daily = usePlaneBuilderStore((s) => s.daily);
  const dailyBest = usePlaneBuilderStore((s) => s.progress.dailyBest);
  if (!daily) return null;
  const twist = TWIST_INFO[daily.twist];
  const best = dailyBest?.date === daily.date ? dailyBest.time : null;
  return (
    <section
      aria-label="Daily challenge"
      data-testid="daily-banner"
      className="rounded-xl bg-violet-100 p-3 text-violet-950 dark:bg-violet-950/60 dark:text-violet-100 short:p-2"
    >
      <p className="font-extrabold">
        <span aria-hidden="true">⚡ </span>Daily challenge
      </p>
      <p className="font-semibold">
        <span aria-hidden="true">{twist.emoji} </span>
        {twist.name}: {twist.blurb}
      </p>
      <p className="text-sm font-semibold">
        {best === null
          ? "Reach the finish to set today's time."
          : `Your best today: ${best.toFixed(1)} s`}
      </p>
    </section>
  );
}
