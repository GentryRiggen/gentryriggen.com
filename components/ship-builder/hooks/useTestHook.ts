"use client";

import { useEffect } from "react";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { DECK_Y, LEVEL_HEIGHT } from "@/lib/ship-builder/model/worldFrame";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  getEscape,
  publishEscape,
  type EscapeSnapshot,
} from "@/lib/ship-builder/state/escapeLive";
import { getWalkState } from "@/lib/ship-builder/state/walkLive";
import { TEST_HOOKS_ENABLED } from "@/lib/ship-builder/testHooks";
import type { WalkState } from "@/lib/ship-builder/walk";
import {
  type BoatLaunch,
  LOWER_S,
  RAFT_DRIFT_S,
  ROW_S,
} from "@/lib/ship-builder/crowd/evacuation";
import { activeEvacuation } from "../scene/trialTimeline";
import { trialPlayback } from "../scene/trialPlayback";

/** A boat of the running trial, with where a walker would board it. */
export interface TestLaunch {
  boatId: string;
  kind: "davit" | "raft";
  /** Sim seconds it lowers away (a raft: is thrown over). */
  at: number;
  /** Its boarding spot as a `walkSpawn` (model cells), or null. */
  walkSpawn: Pick<WalkState, "x" | "z" | "level"> | null;
}

declare global {
  interface Window {
    __shipBuilderStore?: typeof useShipBuilderStore;
    /** Reads the walker's live state (null when not walking). */
    __shipBuilderWalk?: () => WalkState | null;
    /** Reads the walker's escape (aboard, in a boat, swimming ...). */
    __shipBuilderEscape?: () => EscapeSnapshot;
    /** The running trial's boats and their boarding spots. */
    __shipBuilderLaunches?: () => TestLaunch[];
    /**
     * Moves a swimmer beside the first boat that has finished rowing (or
     * drifting) away and now only bobs; false when not swimming or no boat
     * is out yet.
     */
    __shipBuilderSwimToBoat?: () => boolean;
  }
}

function testLaunches(): TestLaunch[] {
  const plan = activeEvacuation();
  if (!plan) return [];
  const { ship } = useShipBuilderStore.getState();
  const length = gridLength(ship);
  const beam = beamOf(ship);
  return plan.launches.map(({ boatId, kind, at, spot }) => ({
    boatId,
    kind,
    at,
    // The inverse of `walkerRestPoint`.
    walkSpawn: spot && {
      x: length / 2 - spot.x,
      z: beam / 2 - spot.z,
      level: Math.round((spot.y - DECK_Y) / LEVEL_HEIGHT),
    },
  }));
}

/** When a boat stops moving out and only bobs. */
function settledAt(launch: BoatLaunch): number {
  return launch.kind === "davit"
    ? launch.at + LOWER_S + ROW_S
    : launch.departs + RAFT_DRIFT_S;
}

function swimToBoat(): boolean {
  const escape = getEscape();
  const { phase } = escape;
  const plan = activeEvacuation();
  if (phase.kind !== "swimming" || !plan) return false;
  const t = trialPlayback.time;
  const launch = plan.launches.find((l) => t >= settledAt(l));
  if (!launch) return false;
  const { position } = plan.boatPoseAt(launch, t);
  publishEscape({
    ...escape,
    phase: {
      ...phase,
      swimmer: { ...phase.swimmer, x: position.x, z: position.z },
    },
  });
  return true;
}

/** Exposes the store and the walker to Playwright in non-production builds only. */
export default function useTestHook() {
  useEffect(() => {
    if (!TEST_HOOKS_ENABLED) return;
    window.__shipBuilderStore = useShipBuilderStore;
    window.__shipBuilderWalk = getWalkState;
    window.__shipBuilderEscape = getEscape;
    window.__shipBuilderLaunches = testLaunches;
    window.__shipBuilderSwimToBoat = swimToBoat;
    return () => {
      delete window.__shipBuilderStore;
      delete window.__shipBuilderWalk;
      delete window.__shipBuilderEscape;
      delete window.__shipBuilderLaunches;
      delete window.__shipBuilderSwimToBoat;
    };
  }, []);
}
