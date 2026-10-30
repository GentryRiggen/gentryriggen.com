"use client";

import { createStoredSetting } from "@/components/ship-builder/hooks/createStoredSetting";

/** Ghost planes are on unless the player turns them off; kept per device. */
export const ghostSetting = createStoredSetting<boolean>({
  key: "plane-builder:ui:ghost",
  parse: (raw) => raw !== "off",
  serialize: (value) => (value ? null : "off"),
  fallback: true,
});

export function useGhostEnabled(): boolean {
  return ghostSetting.useValue();
}
