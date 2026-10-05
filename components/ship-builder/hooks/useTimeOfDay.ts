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
  timeOfDay: TimeOfDay;
  setTimeOfDay: (next: TimeOfDay) => void;
}

/**
 * The chosen time of day, remembered per device and not saved with the ship.
 * An iceberg trial (running or showing its result) always happens at night;
 * that only changes what is reported, never the saved choice.
 */
export default function useTimeOfDay(): TimeOfDayControl {
  const chosen = timeSetting.useValue();
  const isIcebergTrial = useShipBuilderStore(
    (s) =>
      (s.trial.status === "running" || s.trial.status === "result") &&
      s.trial.input.iceberg !== undefined
  );
  return {
    timeOfDay: isIcebergTrial ? "night" : chosen,
    setTimeOfDay: timeSetting.set,
  };
}
