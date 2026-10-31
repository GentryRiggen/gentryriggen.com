"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  DEFAULT_SEA_STATE,
  isSeaState,
  type SceneSea,
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
  /** The sea on show: the trial's while one is on, else the main choice. */
  seaState: SceneSea;
  /** Changes the main-screen choice (never a trial's). */
  setSeaState: (next: SeaState) => void;
}

/**
 * The sea the scene shows. The main-screen choice is remembered per device
 * and not saved with the ship; while a trial is on (aiming, running or its
 * result) its own look's sea shows instead, without changing that choice.
 */
export default function useSeaState(): SeaStateControl {
  const chosen = seaSetting.useValue();
  const trialSea = useShipBuilderStore((s) =>
    s.trial.status === "idle" ? null : s.trial.look.sea
  );
  return { seaState: trialSea ?? chosen, setSeaState: seaSetting.set };
}

/** The main-screen sea right now, for code outside React (the store). */
export function getSeaState(): SeaState {
  return seaSetting.get();
}
