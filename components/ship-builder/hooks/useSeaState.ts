"use client";

import {
  DEFAULT_SEA_STATE,
  isSeaState,
  type SeaState,
} from "../scene/seaState";
import { createStoredSetting } from "./createStoredSetting";

const seaSetting = createStoredSetting<SeaState>({
  key: "ship-builder:ui:sea",
  parse: (raw) => (isSeaState(raw) ? raw : DEFAULT_SEA_STATE),
  serialize: (value) => value,
  fallback: DEFAULT_SEA_STATE,
});

interface SeaStateControl {
  seaState: SeaState;
  setSeaState: (next: SeaState) => void;
}

/** The chosen sea state, remembered per device and not saved with the ship. */
export default function useSeaState(): SeaStateControl {
  const seaState = seaSetting.useValue();
  return { seaState, setSeaState: seaSetting.set };
}
