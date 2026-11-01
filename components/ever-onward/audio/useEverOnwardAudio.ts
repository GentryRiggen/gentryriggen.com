"use client";

import { useEffect, useRef } from "react";
import { affordableUpgrades } from "@/lib/ever-onward/engine/engine";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import { uiFor } from "../universes";
import { isStormy } from "../universes/light";
import { everOnwardSynth, isAudioSupported } from "./everOnwardSynth";
import { everOnwardChannels } from "./soundSettings";

/**
 * Gestures that may unlock audio. iOS Safari only counts touchend and click
 * as user activation for audio, so those join pointerdown and keydown.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

export { isStormy };

/**
 * Drives the game's sound from its state: the score follows the phase, the
 * storm bed follows the storm, and cues fire when a phase begins, the run
 * ends, an upgrade pops in or one becomes affordable. Taps and purchases are
 * sounded straight from `useGame` (`everOnwardSynth.tap` / `.buy`).
 *
 * Audio starts on the first tap or key press, pauses with the tab, and does
 * nothing at all where there is no AudioContext.
 */
export default function useEverOnwardAudio(
  def: UniverseDef,
  run: RunState
): void {
  const isMusicOn = everOnwardChannels.music.useValue();
  const isEffectsOn = everOnwardChannels.effects.useValue();

  useEffect(() => everOnwardSynth.acquire(), []);
  useEffect(() => everOnwardSynth.setMusicEnabled(isMusicOn), [isMusicOn]);
  useEffect(
    () => everOnwardSynth.setEffectsEnabled(isEffectsOn),
    [isEffectsOn]
  );

  // Stays for the life of the screen: iOS can suspend or interrupt the
  // context at any time and only lets resume() through inside a gesture.
  useEffect(() => {
    if (!isAudioSupported()) return;
    const unlock = () => {
      if (everOnwardSynth.isEnabled()) everOnwardSynth.resume();
      else everOnwardSynth.enable();
    };
    for (const type of UNLOCK_EVENTS)
      window.addEventListener(type, unlock, { passive: true });
    return () => {
      for (const type of UNLOCK_EVENTS)
        window.removeEventListener(type, unlock);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") everOnwardSynth.pause();
      else everOnwardSynth.resume();
    };
    const handlePageShow = () => everOnwardSynth.resume();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const phaseNumber = run.phase;
  const isComplete = run.complete;
  const { audio } = uiFor(def.id);
  const isStorm = audio.isStormy?.(run) ?? false;

  useEffect(() => {
    everOnwardSynth.setPhase(isComplete ? null : phaseNumber, audio);
  }, [phaseNumber, isComplete, audio]);

  useEffect(() => {
    everOnwardSynth.setStorm(isStorm && !isComplete);
  }, [isStorm, isComplete]);

  // Cues compare against what the last render saw, so loading a saved run
  // (already in phase 3, or already complete) is silent.
  const previous = useRef({
    run,
    revealed: run.revealed.length,
    affordable: new Set<string>(),
  });
  const affordableNow = new Set(
    run.complete ? [] : affordableUpgrades(def, run).map((u) => u.id)
  );

  useEffect(() => {
    const before = previous.current;
    const didPhaseChange = run.phase !== before.run.phase;
    if (run.complete && !before.run.complete) everOnwardSynth.cue("ending");
    else if (didPhaseChange) everOnwardSynth.cue("phase");
    else {
      for (const cue of audio.cuesBetween?.(before.run, run) ?? [])
        everOnwardSynth.cue(cue);
      if (run.revealed.length > before.revealed) everOnwardSynth.cue("reveal");
      for (const id of affordableNow) {
        if (!before.affordable.has(id)) {
          everOnwardSynth.cue("affordable");
          break;
        }
      }
    }
    previous.current = {
      run,
      revealed: run.revealed.length,
      affordable: affordableNow,
    };
  });
}
