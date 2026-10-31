"use client";

import type { LifeboatMode } from "@/lib/ship-builder/sim/types";
import { isSeaState, type SeaState } from "../scene/seaState";
import { createStoredSetting } from "./createStoredSetting";
import { getSeaState, useMainSeaState } from "./useSeaState";

/** What the device remembers; a missing sea means "the main-screen sea". */
interface StoredChoices {
  waveSea?: SeaState;
  lifeboats: LifeboatMode;
}

const DEFAULT_LIFEBOATS: LifeboatMode = "fill";

const FALLBACK: StoredChoices = { lifeboats: DEFAULT_LIFEBOATS };

function isLifeboatMode(value: unknown): value is LifeboatMode {
  return value === "fill" || value === "titanic";
}

function parse(raw: string | null): StoredChoices {
  if (raw === null) return FALLBACK;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return FALLBACK;
  }
  if (typeof value !== "object" || value === null) return FALLBACK;
  const { waveSea, lifeboats } = value as Record<string, unknown>;
  return {
    ...(isSeaState(waveSea) ? { waveSea } : {}),
    lifeboats: isLifeboatMode(lifeboats) ? lifeboats : DEFAULT_LIFEBOATS,
  };
}

/**
 * The trial setup cards' remembered choices: the Waves card's sea and the
 * lifeboat switch. Per device, never saved with the ship. Time is not here:
 * each card opens on the main-screen time.
 */
export const trialChoicesSetting = createStoredSetting<StoredChoices>({
  key: "ship-builder:ui:trial-choices",
  parse,
  serialize: (value) => JSON.stringify(value),
  fallback: FALLBACK,
});

export interface TrialChoices {
  /** The Waves card's sea; the main-screen sea until one is picked. */
  waveSea: SeaState;
  lifeboats: LifeboatMode;
}

interface TrialChoicesControl extends TrialChoices {
  setWaveSea: (sea: SeaState) => void;
  setLifeboats: (mode: LifeboatMode) => void;
}

function update(patch: Partial<StoredChoices>): void {
  trialChoicesSetting.set({ ...trialChoicesSetting.get(), ...patch });
}

/** The remembered trial choices, for the setup cards. */
export default function useTrialChoices(): TrialChoicesControl {
  const stored = trialChoicesSetting.useValue();
  const { seaState: mainSea } = useMainSeaState();
  return {
    waveSea: stored.waveSea ?? mainSea,
    lifeboats: stored.lifeboats,
    setWaveSea: (waveSea) => update({ waveSea }),
    setLifeboats: (lifeboats) => update({ lifeboats }),
  };
}

/** The remembered choices right now, for code outside React (the store). */
export function getTrialChoices(): TrialChoices {
  const stored = trialChoicesSetting.get();
  return {
    waveSea: stored.waveSea ?? getSeaState(),
    lifeboats: stored.lifeboats,
  };
}
