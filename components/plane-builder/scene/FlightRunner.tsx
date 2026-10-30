"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  type Group,
  type Mesh,
  MeshStandardMaterial,
} from "three";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import { trackFlightEnd, trackFlightQuit } from "@/lib/plane-builder/analytics";
import { modsFor } from "@/lib/plane-builder/daily/daily";
import { createGhostRecorder } from "@/lib/plane-builder/ghost/ghost";
import { applyBonuses } from "@/lib/plane-builder/prestige";
import { planeStats } from "@/lib/plane-builder/plane/stats";
import { GAME_SPEED, STEP } from "@/lib/plane-builder/sim/constants";
import {
  type FlightEvent,
  type FlightState,
  flightResult,
  launch,
  step,
} from "@/lib/plane-builder/sim/flight";
import {
  cameraShake,
  SHAKE_SECONDS,
} from "@/lib/plane-builder/state/cameraShake";
import { flightInput } from "@/lib/plane-builder/state/flightInput";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import { flightToasts } from "@/lib/plane-builder/state/flightToasts";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { heldFlightSeconds } from "@/lib/plane-builder/testHooks";
import { engineLevel } from "../audio/flightCues";
import { planeSynth } from "../audio/planeSynth";
import PlaneModel from "./PlaneModel";

/** Seconds the crash or landing stays on screen before the hangar. */
/** Sim seconds before the swoop tip may show (after the launch pop-up). */
const SWOOP_TIP_AFTER = 2;
const END_HOLD = 1.2;
const MAX_FRAME = 0.1;
const NOTIFY_EVERY = 6;
const DEBRIS_COUNT = 12;
const DEBRIS_SECONDS = 1;
const DEBRIS_SPEED = 9;
const DEBRIS_GRAVITY = 12;

const DEBRIS_GEOMETRY = new BoxGeometry(0.35, 0.18, 0.35);

interface Debris {
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

function makeDebris(): Debris[] {
  return Array.from({ length: DEBRIS_COUNT }, (_, i) => {
    const angle = (i / DEBRIS_COUNT) * Math.PI * 2;
    const lift = 0.4 + ((i * 7) % 5) / 5;
    return {
      vx: Math.cos(angle) * DEBRIS_SPEED * 0.8,
      vy: lift * DEBRIS_SPEED * 0.7,
      vz: Math.sin(angle) * DEBRIS_SPEED * 0.8,
      spin: 4 + (i % 4) * 3,
    };
  });
}

interface FlightRunnerProps {
  level: LevelDef;
  tiers: Tiers;
  /** Called with each batch of sim events, for sound. */
  onEvents?: (events: FlightEvent[]) => void;
}

function poseGroup(group: Group, s: FlightState) {
  group.position.set(s.x, s.y, s.z);
  // Rolling +x dips the +z wing, so a right turn (+bank) leans right.
  group.rotation.set(s.bank, -s.heading, s.pitch, "YZX");
}

/**
 * Runs the flight sim at a fixed step and poses the plane from it. Mounted
 * per launch (keyed by `flightId`); hands the result to the store when the
 * flight has ended and the crash or landing has been seen.
 */
export default function FlightRunner({
  level,
  tiers,
  onEvents,
}: FlightRunnerProps) {
  const aim = usePlaneBuilderStore((s) => s.aim);
  const flightId = usePlaneBuilderStore((s) => s.flightId);
  const completeFlight = usePlaneBuilderStore((s) => s.completeFlight);
  const [run] = useState(() => {
    const { bonuses } = usePlaneBuilderStore.getState().progress.prestige;
    const stats = applyBonuses(planeStats(level.plane, tiers), bonuses);
    const state = launch(level, stats, aim ?? { pitch: 0, yaw: 0, power: 0.5 });
    const { daily } = usePlaneBuilderStore.getState();
    return {
      stats,
      state,
      mods: modsFor(daily?.twist ?? null),
      recorder: createGhostRecorder(state),
    };
  });
  const plane = useRef<Group>(null);
  const debrisMeshes = useRef<(Mesh | null)[]>([]);
  const [debris] = useState(makeDebris);
  const debrisAge = useRef<number | null>(null);
  const debrisOrigin = useRef({ x: 0, y: 0, z: 0 });
  const [debrisMaterial] = useState(
    () => new MeshStandardMaterial({ color: level.palette.plane })
  );
  const accumulator = useRef(0);
  const frames = useRef(0);
  const endTimer = useRef(0);
  const hasCompleted = useRef(false);
  const hasQuit = useRef(false);
  const isPaused = useRef(false);
  const [holdSeconds] = useState(heldFlightSeconds);
  // The best before this flight: passing it pops "New best!" once.
  const [previousBest] = useState(
    () => usePlaneBuilderStore.getState().progress.levels[level.id].best
  );
  const hasPassedBest = useRef(false);
  const hasSwoopTip = useRef(false);

  useLayoutEffect(() => {
    flightLive.set(run.state);
    flightLive.notify();
    if (plane.current) poseGroup(plane.current, run.state);
    return () => flightLive.set(null);
  }, [run]);

  useEffect(() => {
    const onVisibility = () => {
      isPaused.current = document.visibilityState === "hidden";
      accumulator.current = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => () => debrisMaterial.dispose(), [debrisMaterial]);

  // Leaving mid-flight (back to the hangar, or the tab closing) is a quit.
  useEffect(() => {
    const reportQuit = () => {
      if (hasQuit.current || hasCompleted.current) return;
      if (run.state.phase === "done") return;
      hasQuit.current = true;
      trackFlightQuit(run.state, level);
    };
    window.addEventListener("pagehide", reportQuit);
    return () => {
      window.removeEventListener("pagehide", reportQuit);
      reportQuit();
    };
  }, [run, level]);

  // The hum stops with the flight (including when the tab is left mid-flight).
  useEffect(() => () => planeSynth.setEngine(0), []);

  useFrame((_, delta) => {
    if (isPaused.current) return;
    const { state, stats, mods, recorder } = run;
    const group = plane.current;

    accumulator.current += Math.min(delta, MAX_FRAME) * GAME_SPEED;
    while (accumulator.current >= STEP) {
      accumulator.current -= STEP;
      if (holdSeconds !== undefined && state.time >= holdSeconds) continue;
      const events = step(state, level, stats, flightInput, mods);
      recorder.record(state);
      if (events.length === 0) continue;
      onEvents?.(events);
      for (const event of events) {
        if (event.type === "bump" || event.type === "shield") {
          cameraShake.remaining = SHAKE_SECONDS;
        }
        if (event.type === "crash") {
          debrisAge.current = 0;
          debrisOrigin.current = { x: state.x, y: state.y, z: state.z };
          if (group) group.visible = false;
        }
      }
    }
    if (
      !hasPassedBest.current &&
      previousBest > 0 &&
      previousBest < level.finishDistance &&
      state.maxX > previousBest
    ) {
      hasPassedBest.current = true;
      flightToasts.push("New best!");
      planeSynth.play("flag");
    }
    if (
      !hasSwoopTip.current &&
      state.phase === "flying" &&
      state.fuel <= 0 &&
      state.time > SWOOP_TIP_AFTER
    ) {
      hasSwoopTip.current = true;
      flightToasts.push("Out of fuel! Dive, then pull up!");
    }
    if (group && group.visible) poseGroup(group, state);
    planeSynth.setEngine(
      engineLevel(
        stats.thrust > 0,
        state.fuel,
        state.phase === "flying",
        flightInput.boost
      )
    );

    if (debrisAge.current !== null) {
      debrisAge.current += delta;
      const t = debrisAge.current;
      const origin = debrisOrigin.current;
      debrisMeshes.current.forEach((mesh, i) => {
        if (!mesh) return;
        const d = debris[i];
        mesh.visible = t < DEBRIS_SECONDS;
        mesh.position.set(
          origin.x + d.vx * t,
          origin.y + d.vy * t - 0.5 * DEBRIS_GRAVITY * t * t,
          origin.z + d.vz * t
        );
        mesh.rotation.set(t * d.spin, t * d.spin * 0.7, 0);
        mesh.scale.setScalar(Math.max(0, 1 - t / DEBRIS_SECONDS));
      });
    }

    frames.current += 1;
    if (frames.current % NOTIFY_EVERY === 1) flightLive.notify();

    if (state.phase === "done" && !hasCompleted.current) {
      endTimer.current += delta;
      if (endTimer.current >= END_HOLD) {
        hasCompleted.current = true;
        trackFlightEnd(
          state,
          level,
          tiers,
          usePlaneBuilderStore.getState().daily !== null
        );
        flightLive.notify();
        completeFlight(
          flightResult(state, level),
          flightId,
          run.recorder.finish()
        );
      }
    }
  });

  return (
    <>
      <PlaneModel
        ref={plane}
        levelId={level.id}
        tiers={tiers}
        palette={level.palette}
      />
      {debris.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            debrisMeshes.current[i] = m;
          }}
          geometry={DEBRIS_GEOMETRY}
          material={debrisMaterial}
          visible={false}
        />
      ))}
    </>
  );
}
