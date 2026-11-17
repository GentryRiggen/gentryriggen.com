"use client";

import { useEffect } from "react";
import { useResilientAudio } from "@/components/game-audio/useResilientAudio";
import { setSoundSink } from "@/lib/flamelings/sound";
import { flamelingsChannels } from "./sound";
import { playVoice } from "./voices";

/**
 * Wires the game's sounds to the shared resilient audio: nothing plays until
 * the player's first tap unlocks it, it mixes with their music (ambient
 * session), suspends when the page hides and rebuilds after an iOS
 * interruption. Call once, high in the tree.
 */
export function useFlamelingsSound(): void {
  const audio = useResilientAudio();
  const isOn = flamelingsChannels.effects.useValue();

  useEffect(() => {
    if (!isOn || !audio.isSupported()) {
      setSoundSink(null);
      return;
    }
    setSoundSink((name) => {
      const engine = audio.engine();
      if (engine) playVoice(name, engine);
    });
    return () => setSoundSink(null);
  }, [audio, isOn]);
}
