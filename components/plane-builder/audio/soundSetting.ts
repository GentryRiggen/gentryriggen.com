"use client";

import { createStoredSetting } from "@/components/ship-builder/hooks/createStoredSetting";

/** Sound is off until the player turns it on, and is remembered per device. */
export const soundSetting = createStoredSetting<boolean>({
  key: "plane-builder:ui:sound",
  parse: (raw) => raw === "on",
  serialize: (value) => (value ? "on" : null),
  fallback: false,
});

export function useSoundEnabled(): boolean {
  return soundSetting.useValue();
}
