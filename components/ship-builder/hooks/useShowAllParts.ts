"use client";

import { createStoredSetting } from "./createStoredSetting";

const ON = "1";

const showAllSetting = createStoredSetting<boolean>({
  key: "ship-builder:ui:show-all-parts",
  parse: (raw) => raw === ON,
  serialize: (value) => (value ? ON : null),
  fallback: false,
});

interface ShowAllPartsControl {
  showAll: boolean;
  setShowAll: (next: boolean) => void;
}

/** Whether the Parts panel lists every part; remembered per device. */
export default function useShowAllParts(): ShowAllPartsControl {
  const showAll = showAllSetting.useValue();
  return { showAll, setShowAll: showAllSetting.set };
}
