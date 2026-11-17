"use client";

import { useEffect, useState } from "react";
import {
  UNLOCK_EVENTS,
  createResilientAudioContext,
  type ResilientAudio,
  type ResilientAudioOptions,
} from "./resilientAudio";

/**
 * The one audio hook a game needs: it creates a resilient context holder,
 * unlocks it on the player's first gesture (the right iOS events, kept for
 * the life of the screen so any later tap also repairs dead sound), suspends
 * it when the page hides and resumes it when the page returns (visibility and
 * `pageshow`), and closes it on unmount.
 *
 * Play through `audio.engine()`; it is null until a gesture has unlocked
 * sound, and while paused or broken, so voices simply don't fire.
 */
export function useResilientAudio(
  options: ResilientAudioOptions = {}
): ResilientAudio {
  const [audio] = useState(() => createResilientAudioContext(options));

  useEffect(() => {
    if (!audio.isSupported()) return;
    const unlock = () => {
      audio.wake();
    };
    for (const type of UNLOCK_EVENTS) {
      window.addEventListener(type, unlock, { passive: true });
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") audio.pause();
      else audio.resume();
    };
    const onPageShow = () => audio.resume();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      for (const type of UNLOCK_EVENTS)
        window.removeEventListener(type, unlock);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      audio.dispose();
    };
  }, [audio]);

  return audio;
}
