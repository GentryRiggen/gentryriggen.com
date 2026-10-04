"use client";

import {
  DEFAULT_TIME_OF_DAY,
  isTimeOfDay,
  type TimeOfDay,
} from "../scene/timeOfDay";
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

/** The chosen time of day, remembered per device and not saved with the ship. */
export default function useTimeOfDay(): TimeOfDayControl {
  const timeOfDay = timeSetting.useValue();
  return { timeOfDay, setTimeOfDay: timeSetting.set };
}
