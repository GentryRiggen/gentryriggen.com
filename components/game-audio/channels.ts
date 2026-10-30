import {
  createStoredSetting,
  type StoredSetting,
} from "@/components/ship-builder/hooks/createStoredSetting";

/** The two things a player can switch off once sound is unlocked. */
export interface ChannelSettings {
  music: StoredSetting<boolean>;
  effects: StoredSetting<boolean>;
}

/**
 * Music and sound-effects settings for one game, remembered per device. Both
 * default to on, but nothing is heard until the game's own sound setting has
 * unlocked the audio (that one stays off until the player turns it on).
 */
export function createChannelSettings(game: string): ChannelSettings {
  function make(name: string) {
    return createStoredSetting<boolean>({
      key: `${game}:ui:${name}`,
      parse: (raw) => raw !== "off",
      serialize: (value) => (value ? null : "off"),
      fallback: true,
    });
  }
  return { music: make("music"), effects: make("effects") };
}

export interface ChannelState {
  /** The existing sound setting has unlocked the audio. */
  isUnlocked: boolean;
  isMusicOn: boolean;
  isEffectsOn: boolean;
  isTabHidden: boolean;
}

/** Whether the music bed should be running. */
export function shouldPlayMusic(state: ChannelState): boolean {
  return state.isUnlocked && state.isMusicOn && !state.isTabHidden;
}

/** Whether sound effects (one-shots and held beds) should be heard. */
export function shouldPlayEffects(state: ChannelState): boolean {
  return state.isUnlocked && state.isEffectsOn && !state.isTabHidden;
}

/** Whether the OS asks for less motion; a calmer mix follows. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Loudness multiplier for the whole mix under reduced motion. */
export const REDUCED_MOTION_GAIN = 0.7;

/** Master loudness for the current preference. */
export function softnessGain(): number {
  return prefersReducedMotion() ? REDUCED_MOTION_GAIN : 1;
}

/**
 * Calls `onChange` whenever the reduced-motion preference changes; returns the
 * function that stops listening.
 */
export function watchReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (typeof media.addEventListener !== "function") return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
