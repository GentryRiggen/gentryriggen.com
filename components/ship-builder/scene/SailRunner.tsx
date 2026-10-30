"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import {
  createSail,
  handlingFromShip,
  stepSail,
  syncField,
  type SailShip,
  type SailState,
} from "@/lib/ship-builder/sail";
import type { DriveConfig } from "@/lib/ship-builder/sail/driveConfig";
import { SIM_STEP_S } from "@/lib/ship-builder/sim/types";
import {
  NEW_SMOOTH_RUN,
  trackSmooth,
  type SmoothRun,
} from "@/lib/ship-builder/challenges/smooth";
import { publishSail } from "@/lib/ship-builder/state/sailLive";
import { publishSmooth } from "@/lib/ship-builder/state/smoothLive";
import { sailInput } from "@/lib/ship-builder/state/sailInput";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { MAX_FRAME_DELTA } from "./animationMath";
import { testDriveObstacles, testDriveSpeed } from "./testClock";

interface SailingProps {
  config: DriveConfig;
}

/** Runs one drive: steps the sail model in fixed steps and publishes it. */
function Sailing({ config }: SailingProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const driveHit = useShipBuilderStore((s) => s.driveHit);
  const endDrive = useShipBuilderStore((s) => s.endDrive);
  const finishSail = useShipBuilderStore((s) => s.finishSail);
  const isChallenge = config.challenge !== undefined;
  const stats = useMemo(() => analyzeShip(ship).stats, [ship]);
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const { kind } = ship;
  const { topSpeedKnots, grossTonnage } = stats;
  const sailShip = useMemo<SailShip>(
    () => ({ kind, length, beam, topSpeedKnots, grossTonnage }),
    [kind, length, beam, topSpeedKnots, grossTonnage]
  );
  const handling = useMemo(() => handlingFromShip(sailShip), [sailShip]);
  const canSail = topSpeedKnots > 0;

  const state = useRef<SailState | null>(null);
  const leftover = useRef(0);
  const hasHit = useRef(false);
  const run = useRef<SmoothRun>(NEW_SMOOTH_RUN);
  if (state.current === null) {
    state.current = syncField(createSail(testDriveObstacles()), config);
  }

  useEffect(() => {
    // A ship with no speed has nothing to sail: back to the builder.
    if (!canSail) {
      if (isChallenge) finishSail({ reach: 0, status: "gave-up" });
      else endDrive();
      return;
    }
    if (state.current) publishSail(state.current);
    publishSmooth(NEW_SMOOTH_RUN);
    return () => publishSail(null);
  }, [canSail, endDrive, finishSail, isChallenge]);

  useFrame((_, delta) => {
    const current = state.current;
    if (!current || !canSail || hasHit.current) return;
    leftover.current += Math.min(delta, MAX_FRAME_DELTA) * testDriveSpeed();
    let next = current;
    while (leftover.current >= SIM_STEP_S && !next.impact) {
      leftover.current -= SIM_STEP_S;
      next = stepSail(next, sailInput, sailShip, handling);
      next = syncField(next, config);
    }
    if (next === current) return;
    state.current = next;
    publishSail(next);
    if (isChallenge) {
      // Smooth sailing: a hit or the finish line ends the sail with a card
      // instead of the usual crash into a sea trial.
      run.current = trackSmooth(run.current, next);
      publishSmooth(run.current);
      if (run.current.status !== "sailing") {
        hasHit.current = true;
        finishSail(run.current);
      }
      return;
    }
    if (next.impact) {
      hasHit.current = true;
      driveHit(next.impact);
    }
  });

  return null;
}

/**
 * Runs the drive while the store says she is sailing. Renders nothing; the
 * world, camera and HUD read what it publishes (see sailLive.ts).
 */
export default function SailRunner() {
  const drive = useShipBuilderStore((s) => s.drive);
  if (drive.status !== "sailing") return null;
  return <Sailing key={drive.runId} config={drive.config} />;
}
