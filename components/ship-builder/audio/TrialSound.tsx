"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { trialPlayback } from "../scene/trialPlayback";
import { ambientFor, cuesFor, muffleFor, type PlaybackSnapshot } from "./cues";
import { useSoundEnabled } from "./soundSetting";
import { trialSynth } from "./synth";

function snapshotOfPlayback(): PlaybackSnapshot {
  const { time, phase, strain, power, events, speed, scrubbing } =
    trialPlayback;
  return { time, phase, strain, power, events, speed, scrubbing };
}

/**
 * Plays the iceberg trial's sounds. Mount it inside the Canvas. Each frame it
 * compares the playback with the previous frame, turns the change into cues
 * and hands them to the synth. It renders nothing and never re-renders on a
 * frame: it reads the shared playback, the store and the camera directly.
 */
export default function TrialSound() {
  const isEnabled = useSoundEnabled();
  const previous = useRef<PlaybackSnapshot | null>(null);

  useFrame(({ camera }) => {
    const next = snapshotOfPlayback();
    const before = previous.current;
    previous.current = next;
    if (!isEnabled || !trialSynth.isEnabled()) return;

    const { trial } = useShipBuilderStore.getState();
    const isPlaying = trial.status === "running" && !!trial.input.iceberg;
    if (!isPlaying) {
      trialSynth.setAmbient({ sea: false, hum: false });
      return;
    }
    trialSynth.setAmbient(ambientFor(next));
    trialSynth.setMuffle(muffleFor(camera.position.y, next.speed));
    trialSynth.setSpeed(next.speed);
    if (!before) return;
    for (const cue of cuesFor(before, next)) trialSynth.play(cue);
  });

  return null;
}
