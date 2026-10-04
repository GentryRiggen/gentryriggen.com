"use client";

import { useRef } from "react";
import { Vector3, type Mesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { gashOf, GASH_LENGTH } from "@/lib/ship-builder/sim/compartments";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useSeaState from "../hooks/useSeaState";
import { isTap } from "./anchors";
import { shouldSwallowClick } from "./clickGuard";
import { DECK_Y, HULL_DRAFT } from "./coords";
import { hullXOfImpact, impactXFromHit } from "./icebergAim";
import { noRaycast } from "./noRaycast";

/** The hull's side, full height: what a tap or hover is measured against. */
const SIDE_HEIGHT = DECK_Y + HULL_DRAFT;
const SIDE_CENTRE_Y = (DECK_Y - HULL_DRAFT) / 2;
/** The marker floats just off the hull so it never fights the paint. */
const MARKER_OFFSET = 0.05;

interface IcebergAimLayerProps {
  lengthCells: number;
  beam: number;
}

/** Where a pointer event landed in the ship's own frame (cells, bow at +x). */
function hullLocalX(event: ThreeEvent<MouseEvent>, scratch: Vector3): number {
  scratch.copy(event.point);
  event.object.worldToLocal(scratch);
  return scratch.x;
}

/**
 * While the player aims the iceberg: an invisible box around the hull catches
 * taps (a tap starts the trial at that spot) and a marker on the hull shows
 * the stretch the gash would cover. It only mounts while aiming, so the
 * normal hull is untouched.
 */
export default function IcebergAimLayer({
  lengthCells,
  beam,
}: IcebergAimLayerProps) {
  const startTrial = useShipBuilderStore((s) => s.startTrial);
  const { seaState } = useSeaState();
  const marker = useRef<Mesh>(null);
  const scratch = useRef(new Vector3());

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (shouldSwallowClick() || !isTap(event)) return;
    const localX = hullLocalX(event, scratch.current);
    startTrial(seaState, impactXFromHit(localX, lengthCells));
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    const target = marker.current;
    if (!target) return;
    const impactX = impactXFromHit(
      hullLocalX(event, scratch.current),
      lengthCells
    );
    const { fromX, toX } = gashOf(impactX, lengthCells);
    target.position.x = hullXOfImpact((fromX + toX) / 2, lengthCells);
    target.visible = true;
  }

  function handlePointerOut() {
    if (marker.current) marker.current.visible = false;
  }

  return (
    <group>
      <mesh
        position={[0, SIDE_CENTRE_Y, 0]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[lengthCells, SIDE_HEIGHT, beam]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        ref={marker}
        visible={false}
        position={[0, SIDE_CENTRE_Y, beam / 2 + MARKER_OFFSET]}
        raycast={noRaycast}
      >
        <planeGeometry args={[GASH_LENGTH, SIDE_HEIGHT]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
