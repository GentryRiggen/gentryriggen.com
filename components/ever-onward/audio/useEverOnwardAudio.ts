"use client";

import { useEffect, useRef } from "react";
import { affordableUpgrades } from "@/lib/ever-onward/engine/engine";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import { everOnwardSynth, isAudioSupported } from "./everOnwardSynth";
import { everOnwardChannels } from "./soundSettings";

/**
 * Gestures that may unlock audio. iOS Safari only counts touchend and click
 * as user activation for audio, so those join pointerdown and keydown.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

/** Whether the run is in the storm that blows on the coast. */
export function isStormy(run: RunState): boolean {
  return run.phase === 0 && (run.resources.storm ?? 0) > 0;
}

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
  const isStorm = isStormy(run);

  useEffect(() => {
    everOnwardSynth.setPhase(isComplete ? null : phaseNumber);
  }, [phaseNumber, isComplete]);

  useEffect(() => {
    everOnwardSynth.setStorm(isStorm && !isComplete);
  }, [isStorm, isComplete]);

  // Cues compare against what the last render saw, so loading a saved run
  // (already in phase 3, or already complete) is silent.
  const previous = useRef({
    phase: run.phase,
    complete: run.complete,
    revealed: run.revealed.length,
    fronts: run.resources.wxFronts ?? 0,
    hauls: run.resources.tdHauls ?? 0,
    launches: run.resources.prLaunches ?? 0,
    homeRuns: run.resources.prRuns ?? 0,
    affordable: new Set<string>(),
  });
  const affordableNow = new Set(
    run.complete ? [] : affordableUpgrades(def, run).map((u) => u.id)
  );

  useEffect(() => {
    const before = previous.current;
    const didPhaseChange = run.phase !== before.phase;
    if (run.complete && !before.complete) everOnwardSynth.cue("ending");
    else if (didPhaseChange) everOnwardSynth.cue("phase");
    else {
      // A storm front landing on the weather desk.
      if ((run.resources.wxFronts ?? 0) > before.fronts)
        everOnwardSynth.cue("thunder");
      // Nets hauled in on the tide clock.
      if ((run.resources.tdHauls ?? 0) > before.hauls)
        everOnwardSynth.cue("splash");
      // The racing probe leaving the dock, and coming home.
      if ((run.resources.prLaunches ?? 0) > before.launches)
        everOnwardSynth.cue("launch");
      if ((run.resources.prRuns ?? 0) > before.homeRuns)
        everOnwardSynth.cue("arrive");
      if (run.revealed.length > before.revealed) everOnwardSynth.cue("reveal");
      for (const id of affordableNow) {
        if (!before.affordable.has(id)) {
          everOnwardSynth.cue("affordable");
          break;
        }
      }
    }
    previous.current = {
      phase: run.phase,
      complete: run.complete,
      revealed: run.revealed.length,
      fronts: run.resources.wxFronts ?? 0,
      hauls: run.resources.tdHauls ?? 0,
      launches: run.resources.prLaunches ?? 0,
      homeRuns: run.resources.prRuns ?? 0,
      affordable: affordableNow,
    };
  });
}
