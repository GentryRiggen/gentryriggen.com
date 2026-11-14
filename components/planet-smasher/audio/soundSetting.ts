"use client";

import { createStoredSetting } from "@/components/ship-builder/hooks/createStoredSetting";

/**
 * Sound is on until someone turns it off, and is remembered per device. (A
 * browser still needs one tap before it lets any sound out; see
 * `useSoundUnlock`.)
 */
export const soundSetting = createStoredSetting<boolean>({
  key: "planet-smasher:ui:sound",
  parse: (raw) => raw !== "off",
  serialize: (value) => (value ? null : "off"),
  fallback: true,
});

export function useSoundEnabled(): boolean {
  return soundSetting.useValue();
}
