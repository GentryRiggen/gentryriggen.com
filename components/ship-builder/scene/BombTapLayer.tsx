"use client";

import { useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { BOMB_FALL_S } from "@/lib/ship-builder/sim/bombs";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { isTap } from "./anchors";
import { shouldSwallowClick } from "./clickGuard";
import { DECK_Y, HULL_DRAFT, LEVEL_HEIGHT } from "./coords";
import { impactXFromHit } from "./icebergAim";
import { useShipHalf } from "./shipHalf";
import { trialPlayback } from "./trialPlayback";

/** Levels of headroom over her highest part, so taps on funnels and masts count. */
const HEADROOM_LEVELS = 2.5;

/** True while Boom! takes taps: aiming the first bomb, or its trial on show. */
function useIsBombing(): boolean {
  return useShipBuilderStore((s) => {
    const { trial } = s;
    if (trial.status === "aiming") return trial.kind === "boom";
    if (trial.status === "running" || trial.status === "result") {
      return !!trial.input.boom;
    }
    return false;
  });
}

/**
 * Boom!: an invisible box around the whole ship, hull and decks, in the
 * ship's own frame (so it rides her pose). A tap drops a bomb on that spot:
 * the first starts the trial, every later one joins it. Taps while the
 * player drags the scrubber do nothing.
 */
export default function BombTapLayer() {
  const isBombing = useIsBombing();
  const ship = useShipBuilderStore((s) => s.ship);
  const dropBomb = useShipBuilderStore((s) => s.dropBomb);
  const scratch = useRef(new Vector3());
  // Drawn once on the whole ship and once per half (see BrokenShip); only
  // the copy on show may take the tap.
  const half = useShipHalf();
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const top = useMemo(() => {
    let level = 0;
    for (const part of ship.parts) {
      if (part.anchor.kind === "grid") {
        level = Math.max(level, part.anchor.level + 1);
      }
    }
    return DECK_Y + (level + HEADROOM_LEVELS) * LEVEL_HEIGHT;
  }, [ship]);
  if (!isBombing) return null;
  const bottom = -HULL_DRAFT;
  const height = top - bottom;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    // Hidden copies still catch rays: let the tap pass on to the one on show.
    const isBroken = trialPlayback.halves !== null;
    if (isBroken !== (half !== null)) return;
    const local = scratch.current.copy(event.point);
    event.object.worldToLocal(local);
    // A half's box still spans the whole ship: only its own end counts.
    const impactX = impactXFromHit(local.x, length);
    if (half && impactX < half.atX !== (half.side === "bow")) return;
    event.stopPropagation();
    if (shouldSwallowClick() || !isTap(event)) return;
    if (trialPlayback.scrubbing) return;
    // The box is centred on its own middle: back to the ship's frame.
    const y = local.y + (bottom + height / 2);
    const { trial } = useShipBuilderStore.getState();
    const now = trial.status === "aiming" ? 0 : trialPlayback.time;
    dropBomb(
      {
        at: now + BOMB_FALL_S,
        impactX,
        level: (y - DECK_Y) / LEVEL_HEIGHT,
        z: beam / 2 - local.z,
        point: { x: event.point.x, y: event.point.y, z: event.point.z },
      },
      trialPlayback.funnelFalls.map((fall) => fall.funnelId)
    );
  }

  return (
    <mesh position={[0, bottom + height / 2, 0]} onClick={handleClick}>
      <boxGeometry args={[length + 1, height, beam + 0.6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
