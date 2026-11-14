"use client";

import { Square, Waves } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  formatStoryTime,
  storyClockSeconds,
  storyMinutesSinceImpact,
} from "@/lib/ship-builder/sim/story";
import { isTimelineTrial, trialKindOf } from "@/lib/ship-builder/sim/trialKind";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { SEA_LABELS, STRIKE_TRIAL_NAME } from "./seaTrialText";
import { strikeOf } from "@/lib/ship-builder/sim/strike";
import SoundToggle from "./SoundToggle";
import TrialSpeedSwitch from "./TrialSpeedSwitch";
import { panelClass } from "./styles";

/** The trial's name in the pill: the storm's wild sea goes without saying. */
function trialName(input: TrialInput): string {
  switch (trialKindOf(input)) {
    case "storm":
      return "Shipwreck storm";
    case "iceberg":
      return `${STRIKE_TRIAL_NAME[strikeOf(input.iceberg)]} · ${SEA_LABELS[input.sea]}`;
    case "waves":
      return `Sea trial · ${SEA_LABELS[input.sea]}`;
    case "boom":
      return "Boom!";
  }
}

/** "1:05": minutes and seconds, for the Boom! clock. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/** Boom!'s clock: real time since the first bomb, and how many have gone off. */
function boomClock(input: TrialInput, time: number): string {
  const bombs = input.boom?.bombs ?? [];
  const first = bombs[0]?.at ?? 0;
  const gone = bombs.filter((bomb) => bomb.at <= time).length;
  return `${formatClock(time - first)} · ${gone} ${gone === 1 ? "bomb" : "bombs"}`;
}

/**
 * The pill that shows while a sea trial is playing, with a way to stop.
 */
export default function SeaTrialStatus() {
  const trial = useShipBuilderStore((s) => s.trial);
  const endTrial = useShipBuilderStore((s) => s.endTrial);
  const stopButton = useRef<HTMLButtonElement>(null);
  const isRunning = trial.status === "running";
  const runId = trial.status === "running" ? trial.runId : null;
  const live = useLiveTrialState();

  // The button that started this run (Sea trial or Try again) is gone, so
  // focus would drop to the page: hand it to Stop instead. Not while walking:
  // Space jumps there, and a focused Stop button would take it as a press.
  useEffect(() => {
    const isWalking = useShipBuilderStore.getState().walk.status === "walking";
    if (isRunning && !isWalking) stopButton.current?.focus();
  }, [isRunning, runId]);

  if (trial.status !== "running") return null;
  // The iceberg and the storm: the story clock and the trial's sounds.
  const isTimeline = isTimelineTrial(trial.input);
  return (
    <div
      role="status"
      className={`absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border max-sm:rounded-3xl max-sm:pb-1 py-1 pl-4 pr-1 text-sm font-medium shadow-lg ${panelClass}`}
    >
      <Waves
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
      />
      {/* Narrow screens keep the strip slim by dropping the name. */}
      <span className="whitespace-nowrap max-sm:hidden">
        {trialName(trial.input)}
      </span>
      {isTimeline && (
        // Hidden from the live region: a clock ticking ten times a second
        // would flood a screen reader. Wide enough for the longest time
        // ("· 2 hours 40 minutes"), so the pill and its Stop button don't
        // slide as the words change.
        <span
          aria-hidden="true"
          data-testid="story-clock"
          className="inline-block min-w-[20ch] whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400"
        >
          ·{" "}
          {trial.input.boom
            ? boomClock(trial.input, live?.time ?? 0)
            : formatStoryTime(
                storyMinutesSinceImpact(
                  storyClockSeconds(live?.time ?? 0, live?.events ?? [])
                )
              )}
        </span>
      )}
      {isTimeline && <SoundToggle />}
      {/* Below sm the switch gets its own row so the pill fits a phone. */}
      <div className="flex max-sm:order-last max-sm:basis-full max-sm:justify-center max-sm:pr-1">
        <TrialSpeedSwitch />
      </div>
      <button
        ref={stopButton}
        type="button"
        onClick={() => {
          endTrial();
          focusSeaTrialButton();
        }}
        className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:outline-sky-400"
      >
        <Square aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Stop
      </button>
    </div>
  );
}
