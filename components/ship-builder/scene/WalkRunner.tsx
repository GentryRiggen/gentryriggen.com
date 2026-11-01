"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SIM_STEP_S } from "@/lib/ship-builder/sim/types";
import { getEscape } from "@/lib/ship-builder/state/escapeLive";
import {
  getWalkState,
  publishWalk,
  publishWalkHalf,
} from "@/lib/ship-builder/state/walkLive";
import { walkInput } from "@/lib/ship-builder/state/walkInput";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  halfWalkGrid,
  lookAround,
  stepWalker,
  walkGridOf,
  walkHalfOf,
  type WalkGrid,
} from "@/lib/ship-builder/walk";
import { MAX_FRAME_DELTA } from "./animationMath";
import { walkHalfShip } from "./partHalves";
import { trialPlayback } from "./trialPlayback";
import { testWalkSpawn } from "./testClock";

/**
 * Runs one walk: steps the walker in fixed steps and publishes it. Only while
 * they are aboard (see `EscapeRunner`): seated in a boat or frozen in the
 * water they can still look about, and otherwise stay put.
 */
function Walking() {
  const ship = useShipBuilderStore((s) => s.ship);
  const grid = useMemo(() => walkGridOf(ship), [ship]);
  // Once she breaks: the grid cut to the walker's half, picked once.
  const halfGrid = useRef<{ atX: number; grid: WalkGrid } | null>(null);
  const leftover = useRef(0);

  // A test can start the walker somewhere particular. The store published
  // the spawn when the walk started.
  useEffect(() => {
    const planted = testWalkSpawn();
    const current = getWalkState();
    if (!planted || !current) return;
    publishWalk({ ...current, ...planted });
  }, []);

  useFrame((_, delta) => {
    // Read fresh each frame: the escape runner turns the walker too.
    const current = getWalkState();
    if (!current) return;
    const { breakup } = trialPlayback;
    if (!breakup) {
      if (halfGrid.current) publishWalkHalf(null);
      halfGrid.current = null;
    } else if (halfGrid.current?.atX !== breakup.atX) {
      // She has broken: the walker rides the half under their feet, for good,
      // on that half's own parts.
      const side = walkHalfOf(current.x, breakup.atX);
      halfGrid.current = {
        atX: breakup.atX,
        grid: halfWalkGrid(
          walkGridOf(walkHalfShip(ship, side, breakup.atX)),
          side,
          breakup.atX
        ),
      };
      publishWalkHalf(side);
    }
    const { kind } = getEscape().phase;
    if (kind !== "aboard") {
      // Off the deck: no walking or jumping, and nothing banked for later.
      leftover.current = 0;
      walkInput.jump = false;
      if (kind !== "in-boat" && kind !== "frozen") return;
      const yaw = lookAround(
        current.yaw,
        walkInput.turn,
        Math.min(delta, MAX_FRAME_DELTA)
      );
      if (yaw !== current.yaw) publishWalk({ ...current, yaw });
      return;
    }
    const stepGrid = halfGrid.current?.grid ?? grid;
    leftover.current += Math.min(delta, MAX_FRAME_DELTA);
    let next = current;
    const hadSteps = leftover.current >= SIM_STEP_S;
    while (leftover.current >= SIM_STEP_S) {
      leftover.current -= SIM_STEP_S;
      next = stepWalker(next, walkInput, stepGrid);
    }
    // A tap is one request, however many steps it took to be heard.
    if (hadSteps) walkInput.jump = false;
    if (next === current) return;
    publishWalk(next);
  });

  return null;
}

/**
 * Runs the walk while the store says she is walking. Renders nothing; the
 * camera and HUD read what it publishes (see walkLive.ts).
 */
export default function WalkRunner() {
  const walk = useShipBuilderStore((s) => s.walk);
  if (walk.status !== "walking") return null;
  return <Walking key={walk.runId} />;
}
