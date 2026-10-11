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
import { planeStats } from "@/lib/plane-builder/plane/stats";
import { STEP } from "@/lib/plane-builder/sim/constants";
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
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { engineLevel } from "../audio/flightCues";
import { planeSynth } from "../audio/planeSynth";
import PlaneModel from "./PlaneModel";

/** Seconds the crash or landing stays on screen before the results. */
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
  group.rotation.set(-s.bank, -s.heading, s.pitch, "YZX");
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
    const stats = planeStats(level.plane, tiers);
    const state = launch(level, stats, aim ?? { pitch: 0, yaw: 0, power: 0.5 });
    return { stats, state };
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
  const isPaused = useRef(false);

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

  // The hum stops with the flight (including when the tab is left mid-flight).
  useEffect(() => () => planeSynth.setEngine(0), []);

  useFrame((_, delta) => {
    if (isPaused.current) return;
    const { state, stats } = run;
    const group = plane.current;

    accumulator.current += Math.min(delta, MAX_FRAME);
    while (accumulator.current >= STEP) {
      accumulator.current -= STEP;
      const events = step(state, level, stats, flightInput);
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
        flightLive.notify();
        completeFlight(flightResult(state, level), flightId);
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
