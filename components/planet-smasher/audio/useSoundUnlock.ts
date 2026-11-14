"use client";

import { useEffect } from "react";
import {
  closeSfx,
  enableSfx,
  isAudioSupported,
  isSfxEnabled,
  pauseSfx,
  resumeSfx,
} from "./sfx";
import { soundSetting } from "./soundSetting";

/**
 * Gestures that may unlock audio. iOS Safari only counts touchend and click
 * as user activation for audio, so those join pointerdown and keydown.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

/**
 * Browsers only let audio start from a tap or key press. While sound is on
 * (the default) the first tap or key press anywhere starts it. The listeners
 * go away once the audio has started, when sound is off, and on unmount. If
 * the engine cannot start, the setting is switched back off. The audio also
 * pauses while the tab is hidden and goes quiet when the game unmounts.
 */
export default function useSoundUnlock(isOn: boolean) {
  useEffect(() => {
    if (!isOn || !isAudioSupported() || isSfxEnabled()) return;
    const remove = () => {
      for (const type of UNLOCK_EVENTS) {
        window.removeEventListener(type, unlock);
      }
    };
    const unlock = () => {
      remove();
      if (!enableSfx()) soundSetting.set(false);
    };
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock);
    return remove;
  }, [isOn]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") pauseSfx();
      else resumeSfx();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      closeSfx();
    };
  }, []);
}
