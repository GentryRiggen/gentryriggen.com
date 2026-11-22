"use client";

import { useEffect, useRef } from "react";
import { useResilientAudio } from "@/components/game-audio/useResilientAudio";
import { effectiveSpeed, type PlaybackStore } from "@/lib/shipwreck/playback";
import type { VoiceEngine } from "@/components/game-audio/primitives";
import type { SceneRuntime } from "@/components/shipwreck/scene/runtime";
import { createBeds, type Beds } from "./beds";
import { createCueScheduler, type WalkCueInput } from "./cues";
import { CUE_BUS_LEVEL, playCue } from "./voices";

/** Seconds between updates of the held beds (their levels glide anyway). */
const BED_EVERY_S = 0.2;
/** How fast the night bus fades when sound goes off or the night is left. */
const MUTE_TC_S = 0.05;
/** While walking (real time, even when paused): how often the walk is heard (ms). */
const WALK_EVERY_MS = 200;

/**
 * The night's own buses on an engine: everything goes through `night`
 * (silenced at once when sound goes off, cues already playing included);
 * the cues go through a lower sub-bus first.
 */
interface NightBuses {
  forEngine: VoiceEngine;
  beds: Beds;
  cue: VoiceEngine;
  night: GainNode;
  cueGain: GainNode;
  isOn: boolean;
}

function createNightBuses(engine: VoiceEngine, isOn: boolean): NightBuses {
  const night = engine.ctx.createGain();
  night.gain.value = isOn ? 1 : 0;
  night.connect(engine.bus);
  const cueGain = engine.ctx.createGain();
  cueGain.gain.value = CUE_BUS_LEVEL;
  cueGain.connect(night);
  return {
    forEngine: engine,
    beds: createBeds({ ...engine, bus: night }),
    cue: { ...engine, bus: cueGain },
    night,
    cueGain,
    isOn,
  };
}

function disposeNightBuses(b: NightBuses) {
  b.beds.dispose();
  try {
    b.cueGain.disconnect();
    b.night.disconnect();
  } catch {
    /* the context is gone */
  }
}

/**
 * Wires the night's sound (and, given the scene's runtime, the walk's
 * splash and scrape): nothing plays until the player's first tap
 * unlocks the audio (ambient session, so their music keeps going); beds run
 * only while `active` (the night screen) and `enabled` (the sound button).
 * Call once, high in the tree.
 */
export function useShipwreckSound(
  store: PlaybackStore,
  active: boolean,
  enabled: boolean,
  runtime?: SceneRuntime
): void {
  const audio = useResilientAudio();
  const live = useRef({ active, enabled });
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => {
    live.current = { active, enabled };
    // Sound switched off or the night left: quiet the beds right away.
    refresh.current?.();
  }, [active, enabled]);

  useEffect(() => {
    if (!audio.isSupported()) return;
    let buses: NightBuses | null = null;
    let lastBedAt = -Infinity;
    const isOn = () => live.current.active && live.current.enabled;

    /**
     * The buses for the current engine. A null engine (hidden, paused or
     * waiting to rebuild) keeps what exists, so a plain resume brings the
     * beds straight back; only a new engine replaces them.
     */
    const current = (): NightBuses | null => {
      const engine = audio.engine();
      if (engine && engine !== buses?.forEngine) {
        if (buses) disposeNightBuses(buses);
        buses = createNightBuses(engine, isOn());
        lastBedAt = -Infinity;
      }
      return engine ? buses : null;
    };
    const setOn = (b: NightBuses, on: boolean) => {
      if (b.isOn === on) return;
      b.isOn = on;
      b.night.gain.setTargetAtTime(
        on ? 1 : 0,
        b.forEngine.ctx.currentTime,
        MUTE_TC_S
      );
    };

    const scheduler = createCueScheduler((cue, level) => {
      if (!isOn()) return;
      const b = current();
      if (b) playCue(b.cue, cue, level);
    });

    const unsubEngine = audio.onEngine(() => refresh.current?.());

    const walk: WalkCueInput = { phase: "off", slide: 0, splash: 0 };
    let walkTimer: ReturnType<typeof setInterval> | null = null;

    const onChange = () => {
      const s = store.getState();
      const { active: isActive, enabled: isOn } = live.current;
      if (!s.track) return;
      const now = performance.now() / 1000;
      // Keep the pointer moving even when silent, so turning sound on (or
      // returning to the night) never replays old events.
      scheduler.update(s.track.events, s.track.frames, {
        t: s.t,
        playing: s.playing,
        speed: effectiveSpeed(s, now),
        snapId: s.snapId,
        underwater: s.camera === "underwater",
        now,
        ship: s.ship,
        walk: runtime ? walkNow(s.walk.phase) : undefined,
        hits: s.hits.length,
        storm: s.track.storm,
        stormScale: s.track.stormScale,
      });
      if (now - lastBedAt < BED_EVERY_S) return;
      lastBedAt = now;
      const b = current();
      if (!b) return;
      setOn(b, isActive && isOn);
      b.beds.apply(scheduler.bed, isActive && isOn);
    };
    function walkNow(phase: WalkCueInput["phase"]): WalkCueInput {
      walk.phase = phase;
      walk.slide = runtime!.walkSlide;
      walk.splash = runtime!.walkSplash;
      return walk;
    }
    // Walking runs in real time, so a paused night still hears it: tick
    // while walking (the store does not change then).
    const syncWalkTimer = () => {
      const walking = !!runtime && store.getState().walk.phase !== "off";
      if (walking && walkTimer === null)
        walkTimer = setInterval(onChange, WALK_EVERY_MS);
      else if (!walking && walkTimer !== null) {
        clearInterval(walkTimer);
        walkTimer = null;
      }
    };
    const unsub = store.subscribe(() => {
      syncWalkTimer();
      onChange();
    });
    refresh.current = () => {
      lastBedAt = -Infinity;
      // Mute at once, even before a track exists (in-flight cues too).
      const b = current();
      if (b) setOn(b, isOn());
      onChange();
    };
    // Back from hidden: the kit resumes the context in its own listener,
    // so refresh after it (the beds return even while paused).
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    const onShow = () => {
      if (document.visibilityState === "hidden") return;
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        refresh.current?.();
      }, 0);
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      refresh.current = null;
      unsub();
      if (walkTimer !== null) clearInterval(walkTimer);
      unsubEngine();
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      if (buses) disposeNightBuses(buses);
    };
  }, [audio, store, runtime]);
}
