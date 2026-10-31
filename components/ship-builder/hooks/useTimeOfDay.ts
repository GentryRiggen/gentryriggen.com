"use client";

import {
  DEFAULT_TIME_OF_DAY,
  isTimeOfDay,
  type TimeOfDay,
} from "../scene/timeOfDay";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { createStoredSetting } from "./createStoredSetting";

const timeSetting = createStoredSetting<TimeOfDay>({
  key: "ship-builder:ui:time",
  parse: (raw) => (isTimeOfDay(raw) ? raw : DEFAULT_TIME_OF_DAY),
  serialize: (value) => value,
  fallback: DEFAULT_TIME_OF_DAY,
});

interface TimeOfDayControl {
  /** The time on show: the trial's while one is on, else the main choice. */
  timeOfDay: TimeOfDay;
  /** Changes the main-screen choice (never a trial's). */
  setTimeOfDay: (next: TimeOfDay) => void;
}

/**
 * The time of day the scene shows. The main-screen choice is remembered per
 * device and not saved with the ship; while a trial is on (aiming, running or
 * its result) its own look's time shows instead, without changing that choice.
 */
export default function useTimeOfDay(): TimeOfDayControl {
  const chosen = timeSetting.useValue();
  const trialTime = useShipBuilderStore((s) =>
    s.trial.status === "idle" ? null : s.trial.look.time
  );
  return {
    timeOfDay: trialTime ?? chosen,
    setTimeOfDay: timeSetting.set,
  };
}

/**
 * The main-screen time of day itself, whatever a trial shows: for the time
 * chips, which set it and must not light up a trial's time.
 */
export function useMainTimeOfDay(): TimeOfDayControl {
  return { timeOfDay: timeSetting.useValue(), setTimeOfDay: timeSetting.set };
}

/** The main-screen time of day right now, for code outside React (the store). */
export function getTimeOfDay(): TimeOfDay {
  return timeSetting.get();
}
