"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { EvacuationPlan } from "@/lib/ship-builder/crowd/evacuation";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { takeEscapeRequest } from "@/lib/ship-builder/state/escapeActions";
import { getEscape, publishEscape } from "@/lib/ship-builder/state/escapeLive";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { walkInput } from "@/lib/ship-builder/state/walkInput";
import {
  getWalkHalf,
  getWalkState,
  publishWalk,
} from "@/lib/ship-builder/state/walkLive";
import {
  endingOf,
  type EscapeBoatKind,
  type EscapePhase,
} from "@/lib/ship-builder/walk/escape";
import { playShipVoice } from "../audio/shipVoice";
import { advanceEscape, escapeLedger, escapeVoiceMoment } from "./escapeStep";
import { walkerBody } from "./playbackBody";
import { testEscapeWarmthSeconds } from "./testClock";
import { activeEvacuation } from "./trialTimeline";
import { trialPlayback } from "./trialPlayback";

/** The boat an ending was reached in, for the record. */
function boatKindOf(
  phase: EscapePhase,
  plan: Pick<EvacuationPlan, "launches"> | null
): EscapeBoatKind {
  if (phase.kind !== "in-boat") return "none";
  return plan?.launches.find((l) => l.boatId === phase.boatId)?.kind ?? "none";
}

/** True once she has gone under, so her hull no longer stands in the water. */
function isHullGone(): boolean {
  const { phase, sinkingAt } = trialPlayback;
  return phase === "descending" || (phase === "done" && sinkingAt !== null);
}

/** Runs one walk's escape (see `advanceEscape`) and publishes it. */
function Escaping() {
  const ship = useShipBuilderStore((s) => s.ship);
  const frame = useMemo(
    () => ({ length: gridLength(ship), beam: beamOf(ship) }),
    [ship]
  );
  const leftover = useRef(0);

  useFrame((_, delta) => {
    const plan = activeEvacuation();
    const request = takeEscapeRequest();
    const walk = getWalkState();
    const half = getWalkHalf();
    const before = getEscape();
    const next = advanceEscape(before.phase, {
      plan,
      t: trialPlayback.time,
      walk,
      half,
      body: walk ? walkerBody(trialPlayback, half, walk.x) : trialPlayback,
      length: frame.length,
      beam: frame.beam,
      hullGone: isHullGone(),
      request,
      input: walkInput,
      delta,
      leftover: leftover.current,
      warmthSeconds: testEscapeWarmthSeconds(),
    });
    leftover.current = next.leftover;
    // A kick is one request, however many steps it took to be heard.
    if (next.stepped) walkInput.jump = false;
    if (walk && next.yaw !== null && next.yaw !== walk.yaw) {
      publishWalk({ ...walk, yaw: next.yaw });
    }
    publishEscape({
      phase: next.phase,
      boardable: next.boardable && {
        boatId: next.boardable.boatId,
        kind: next.boardable.kind,
      },
      pickup: next.pickup && { boatId: next.pickup.boatId },
    });
    const moment = escapeVoiceMoment(before.phase, next.phase);
    if (moment) playShipVoice(moment);
    const change = escapeLedger(before.phase, next.phase);
    if (change === "clear") {
      useShipBuilderStore.getState().clearEscape();
    } else if (change === "record") {
      const ending = endingOf(next.phase);
      if (ending) {
        useShipBuilderStore
          .getState()
          .recordEscape(ending, boatKindOf(next.phase, plan));
      }
    }
  });

  return null;
}

/**
 * Runs the escape from a sinking ship while the store says she is walking,
 * after `WalkRunner` each frame: boarding, going into the water, swimming.
 * Renders nothing; `EscapeEyes` and the HUD read what it publishes (see
 * escapeLive.ts).
 */
export default function EscapeRunner() {
  const walk = useShipBuilderStore((s) => s.walk);
  if (walk.status !== "walking") return null;
  return <Escaping key={walk.runId} />;
}
