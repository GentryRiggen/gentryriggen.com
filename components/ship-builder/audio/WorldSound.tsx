"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { handlingFromShip } from "@/lib/ship-builder/sail";
import { getSailState } from "@/lib/ship-builder/state/sailLive";
import { sailInput } from "@/lib/ship-builder/state/sailInput";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useSeaState from "../hooks/useSeaState";
import { trialPlayback } from "../scene/trialPlayback";
import { SILENT_BEDS } from "./shipBeds";
import { modeFor, rushLevelFor, worldBedsFor } from "./shipMix";
import { SHANTY } from "./shanty";
import { trialSynth } from "./synth";

/** The held sounds are retuned this often (seconds), not every frame. */
const UPDATE_EVERY_S = 0.1;

/**
 * The world's sound: sea and wind that follow the sea state, the engine's
 * thrum and bow wave while sailing, the buoy's bell, the water rushing in
 * during a sinking, and the shanty while building. Mount it inside the
 * Canvas. It renders nothing and never re-renders on a frame.
 */
export default function WorldSound() {
  const { seaState } = useSeaState();
  const isSailing = useShipBuilderStore((s) => s.drive.status === "sailing");
  const isWalking = useShipBuilderStore((s) => s.walk.status === "walking");
  const isTrialRunning = useShipBuilderStore(
    (s) => s.trial.status === "running"
  );
  const ship = useShipBuilderStore((s) => s.ship);
  const mode = modeFor({ isTrialRunning, isSailing, isWalking });

  // Top speed in cells per second, worked out only for a drive.
  const topSpeed = useMemo(() => {
    if (!isSailing) return 1;
    const { stats } = analyzeShip(ship);
    return handlingFromShip({
      kind: ship.kind,
      length: gridLength(ship),
      beam: beamOf(ship),
      topSpeedKnots: stats.topSpeedKnots,
      grossTonnage: stats.grossTonnage,
    }).topSpeed;
  }, [isSailing, ship]);

  const sinceUpdate = useRef(UPDATE_EVERY_S);
  const lastBumpAt = useRef<number | null>(null);

  // The shanty plays while building; the other modes have their own sound.
  useEffect(() => {
    trialSynth.setMusic(mode === "build" ? SHANTY : null);
    return () => trialSynth.setMusic(null);
  }, [mode]);

  useEffect(() => {
    lastBumpAt.current = null;
    return () => trialSynth.setBeds(SILENT_BEDS);
  }, []);

  useFrame((_, delta) => {
    if (!trialSynth.isEnabled()) return;

    if (isSailing) {
      const bump = getSailState()?.bump ?? null;
      if (bump && bump.at !== lastBumpAt.current) {
        trialSynth.play({ kind: "bell" });
      }
      lastBumpAt.current = bump?.at ?? null;
    }

    sinceUpdate.current += delta;
    if (sinceUpdate.current < UPDATE_EVERY_S) return;
    sinceUpdate.current = 0;

    const sail = isSailing ? getSailState() : null;
    const beds = worldBedsFor({
      mode,
      seaState,
      throttle: sailInput.throttle,
      speedShare: sail ? sail.speed / topSpeed : 0,
    });
    const rush = isTrialRunning
      ? rushLevelFor(
          trialPlayback.phase,
          trialPlayback.time,
          trialPlayback.sinkingAt
        )
      : 0;
    trialSynth.setBeds(rush > 0 ? { ...beds, rush } : beds);
  });

  return null;
}
