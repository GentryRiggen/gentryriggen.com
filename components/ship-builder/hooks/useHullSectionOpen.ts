"use client";

import { createStoredSetting } from "./createStoredSetting";

const CLOSED = "0";

const hullOpenSetting = createStoredSetting<boolean>({
  key: "ship-builder:ui:hull-open",
  parse: (raw) => raw !== CLOSED,
  serialize: (value) => (value ? null : CLOSED),
  fallback: true,
});

/** Whether the Parts panel's Hull section is open; open until closed once. */
export default function useHullSectionOpen(): [
  boolean,
  (next: boolean) => void,
] {
  return [hullOpenSetting.useValue(), hullOpenSetting.set];
}
