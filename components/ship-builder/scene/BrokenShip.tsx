"use client";

import {
  Children,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import AttachMarkers from "./AttachMarkers";
import BreakBurst from "./BreakBurst";
import GhostPreview from "./GhostPreview";
import GridTargets from "./GridTargets";
import { applyHalfPose } from "./halfTransform";
import {
  HALF_SIDES,
  partHalves,
  snappedWires,
  type HalfSide,
} from "./partHalves";
import PropellerBubbles from "./PropellerBubbles";
import { ShipHalfContext, type ShipHalfValue } from "./shipHalf";
import TornEdge from "./TornEdge";
import { breakXOf, localClipPlane } from "./tornEdgeGeometry";
import { trialPlayback } from "./trialPlayback";

/** Building aids: the ship is frozen during a trial, so halves skip them. */
const BUILD_ONLY: ReadonlySet<unknown> = new Set([
  GridTargets,
  AttachMarkers,
  GhostPreview,
]);

interface HalfGroupProps {
  side: HalfSide;
  atX: number;
  lengthCells: number;
  sides: ReadonlyMap<string, HalfSide>;
  /** Wires strung across the break, which neither half draws. */
  snapped: ReadonlySet<string>;
  children: ReactNode;
}

/**
 * One half: it follows its `HalfPose` each frame and moves its cut with it,
 * so the hull stays sliced on the break line however the half turns.
 */
function HalfGroup({
  side,
  atX,
  lengthCells,
  sides,
  snapped,
  children,
}: HalfGroupProps) {
  const group = useRef<Group>(null);
  const local = useMemo(
    () => localClipPlane(side, breakXOf(atX, lengthCells)),
    [side, atX, lengthCells]
  );
  const value = useMemo<ShipHalfValue>(
    () => ({
      side,
      atX,
      clip: local.clone(),
      // A part the map does not know (added mid-trial, never) rides aft.
      includesPart: (partId) =>
        !snapped.has(partId) && (sides.get(partId) ?? "stern") === side,
    }),
    [side, atX, local, sides, snapped]
  );

  // Pose and cut are set before the first paint and then every frame.
  const place = () => {
    const target = group.current;
    const halves = trialPlayback.halves;
    if (!target || !halves) return;
    applyHalfPose(target, halves[side], lengthCells);
    target.updateMatrixWorld();
    value.clip.copy(local).applyMatrix4(target.matrixWorld);
  };
  useLayoutEffect(place);
  useFrame(place);

  return (
    <group ref={group}>
      <ShipHalfContext.Provider value={value}>
        {children}
        <TornEdge side={side} atX={atX} />
      </ShipHalfContext.Provider>
    </group>
  );
}

interface BrokenShipProps {
  /** Where she broke, cells from the bow. */
  atX: number;
  /** The whole ship's contents; each half draws its own share of them. */
  children: ReactNode;
}

/**
 * The ship after she breaks in two: the same contents drawn twice, once per
 * half, each cut at the break and keeping only its own parts, plus the burst
 * of the break itself.
 */
export default function BrokenShip({ atX, children }: BrokenShipProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const lengthCells = gridLength(ship);
  const sides = useMemo(() => partHalves(ship, atX), [ship, atX]);
  const snapped = useMemo(() => snappedWires(ship, atX), [ship, atX]);
  const contents = Children.toArray(children).filter(
    (child) => !isValidElement(child) || !BUILD_ONLY.has(child.type)
  );

  return (
    <>
      {HALF_SIDES.map((side) => (
        <HalfGroup
          key={side}
          side={side}
          atX={atX}
          lengthCells={lengthCells}
          sides={sides}
          snapped={snapped}
        >
          {contents}
          {/* The propellers are aft. */}
          {side === "stern" && <PropellerBubbles />}
        </HalfGroup>
      ))}
      <BreakBurst />
    </>
  );
}
