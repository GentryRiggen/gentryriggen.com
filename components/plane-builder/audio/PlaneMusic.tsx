"use client";

import { useEffect } from "react";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { planeSynth } from "./planeSynth";
import { musicForWorld, musicLevelForScreen } from "./worldMusic";

/**
 * Picks the music bed for the world on screen and turns it down in flight.
 * It renders nothing; the synth only plays it once audio is unlocked and the
 * music switch is on.
 */
export default function PlaneMusic() {
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const screen = usePlaneBuilderStore((s) => s.screen);

  useEffect(() => {
    planeSynth.setMusic(musicForWorld(levelId));
    return () => planeSynth.setMusic(null);
  }, [levelId]);

  useEffect(() => {
    planeSynth.setMusicLevel(musicLevelForScreen(screen));
  }, [screen]);

  return null;
}
