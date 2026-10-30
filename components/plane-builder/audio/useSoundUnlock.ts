"use client";

import { useEffect } from "react";
import { planeChannels } from "./channelSettings";
import { planeSynth, isAudioSupported } from "./planeSynth";
import { soundSetting } from "./soundSetting";

/**
 * Gestures that may unlock audio. iOS Safari only counts touchend and click
 * as user activation for audio, so those join pointerdown and keydown.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

/**
 * Browsers only let audio start from a tap or key press. When sound is
 * remembered as on, the first tap or key press anywhere starts it. The
 * listeners go away once the audio has started, when sound is off, and on
 * unmount. If the engine cannot start, the setting is switched back off.
 *
 * It also passes the music and sound-effects switches on to the synth, and
 * pauses the synth while the tab is hidden and wakes it again.
 */
export default function useSoundUnlock(isOn: boolean) {
  const isMusicOn = planeChannels.music.useValue();
  const isEffectsOn = planeChannels.effects.useValue();

  // While mounted this holds the audio graph; the last one to leave frees it.
  useEffect(() => planeSynth.acquire(), []);

  // The music and effects switches apply whether or not audio is unlocked yet:
  // the synth keeps them and acts once it is.

  useEffect(() => {
    planeSynth.setMusicEnabled(isMusicOn);
  }, [isMusicOn]);
  useEffect(() => {
    planeSynth.setEffectsEnabled(isEffectsOn);
  }, [isEffectsOn]);

  useEffect(() => {
    if (!isOn || !isAudioSupported() || planeSynth.isEnabled()) return;
    const remove = () => {
      for (const type of UNLOCK_EVENTS)
        window.removeEventListener(type, unlock);
    };
    const unlock = () => {
      remove();
      if (!planeSynth.enable()) soundSetting.set(false);
    };
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock);
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
