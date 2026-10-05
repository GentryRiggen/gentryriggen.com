"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { trialPlayback } from "../scene/trialPlayback";
import { ambientFor, cuesFor, muffleFor, type PlaybackSnapshot } from "./cues";
import { useSoundEnabled } from "./soundSetting";
import { trialSynth } from "./synth";
import useSoundUnlock from "./useSoundUnlock";

function createSnapshot(): PlaybackSnapshot {
  return {
    time: 0,
    phase: "sailing",
    strain: 0,
    power: "on",
    events: [],
    speed: 1,
    scrubbing: false,
  };
}

function copyPlayback(target: PlaybackSnapshot) {
  const { time, phase, strain, power, events, speed, scrubbing } =
    trialPlayback;
  target.time = time;
  target.phase = phase;
  target.strain = strain;
  target.power = power;
  target.events = events;
  target.speed = speed;
  target.scrubbing = scrubbing;
}

/**
 * Plays the iceberg trial's sounds. Mount it inside the Canvas. Each frame it
 * compares the playback with the previous frame, turns the change into cues
 * and hands them to the synth. It renders nothing and never re-renders on a
 * frame: it reads the shared playback, the store and the camera directly.
 *
 * It also owns the audio's lifecycle: it unlocks remembered sound on the first
 * tap, and silences the held sounds when the trial leaves the screen (unmount,
 * or the tab going to the background, where frames stop).
 */
export default function TrialSound() {
  const isEnabled = useSoundEnabled();
  useSoundUnlock(isEnabled);

  // Two snapshots swapped each frame, so a frame allocates nothing.
  const snapshots = useRef<[PlaybackSnapshot, PlaybackSnapshot]>([
    createSnapshot(),
    createSnapshot(),
  ]);
  const hasPrevious = useRef(false);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        trialSynth.pause();
        // Frames stop in the background, so the next one has nothing to
        // compare with.
        hasPrevious.current = false;
      } else {
        trialSynth.resume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      trialSynth.setAmbient({ sea: false, hum: false });
    };
  }, []);

  useFrame(({ camera }) => {
    const [before, next] = snapshots.current;
    copyPlayback(next);
    const wasKnown = hasPrevious.current;
    snapshots.current = [next, before];
    hasPrevious.current = true;
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
    if (!wasKnown || next.time === before.time) return;
    for (const cue of cuesFor(before, next)) trialSynth.play(cue);
  });

  return null;
}
