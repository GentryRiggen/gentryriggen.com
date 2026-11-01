"use client";

import { useEffect } from "react";
import type { MusicSpec } from "../../game-audio/music";
import { everOnwardSynth, isAudioSupported } from "./everOnwardSynth";
import { everOnwardChannels } from "./soundSettings";

/**
 * Gestures that may unlock audio. iOS Safari only counts touchend and click
 * as user activation for audio, so those join pointerdown and keydown.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

/**
 * Plays the title theme while `isActive` (the start screen and the hub).
 * Browsers block autoplay, so the first tap or key press anywhere unlocks
 * the audio and the theme begins; the shared music setting can switch it
 * off. Handing over to a universe is the game screen's job: it sets its
 * phase, then this hook is switched off and the theme crossfades away.
 */
export default function useTitleMusic(
  isActive: boolean,
  spec?: MusicSpec
): void {
  const isMusicOn = everOnwardChannels.music.useValue();

  useEffect(() => everOnwardSynth.setMusicEnabled(isMusicOn), [isMusicOn]);

  useEffect(() => {
    everOnwardSynth.setTitle(isActive, spec);
    return () => everOnwardSynth.setTitle(false);
  }, [isActive, spec]);

  useEffect(() => {
    if (!isActive || !isAudioSupported()) return;
    const unlock = () => {
      if (everOnwardSynth.isEnabled()) everOnwardSynth.resume();
      else everOnwardSynth.enable();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") everOnwardSynth.pause();
      else everOnwardSynth.resume();
    };
    for (const type of UNLOCK_EVENTS)
      window.addEventListener(type, unlock, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      for (const type of UNLOCK_EVENTS)
        window.removeEventListener(type, unlock);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isActive]);
}
