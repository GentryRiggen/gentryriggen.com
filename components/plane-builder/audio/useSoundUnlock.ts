"use client";

import { useEffect } from "react";
import { planeSynth, isAudioSupported } from "./planeSynth";
import { soundSetting } from "./soundSetting";

/**
 * Browsers only let audio start from a tap or key press. When sound is
 * remembered as on, the first tap or key press anywhere starts it. The
 * listeners go away once the audio has started, when sound is off, and on
 * unmount. If the engine cannot start, the setting is switched back off.
 *
 * It also pauses the synth while the tab is hidden and wakes it again.
 */
export default function useSoundUnlock(isOn: boolean) {
  useEffect(() => {
    if (!isOn || !isAudioSupported() || planeSynth.isEnabled()) return;
    const remove = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    const unlock = () => {
      remove();
      if (!planeSynth.enable()) soundSetting.set(false);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return remove;
  }, [isOn]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") planeSynth.pause();
      else planeSynth.resume();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
