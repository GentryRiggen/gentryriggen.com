"use client";

import {
  Children,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import AttachMarkers from "./AttachMarkers";
import BreakBurst from "./BreakBurst";
import GhostPreview from "./GhostPreview";
import GridTargets from "./GridTargets";
import { bobPose, createShipPose } from "./bob";
import { applyBobCarry, applyHalfPose, bobCarryWeight } from "./halfTransform";
import {
  HALF_SIDES,
  partHalves,
  snappedWires,
  type HalfSide,
} from "./partHalves";
import PropellerBubbles from "./PropellerBubbles";
import { useShipAnimation } from "./ShipAnimationContext";
import { ShipHalfContext, type ShipHalfValue } from "./shipHalf";
import { sceneTime } from "./testClock";
import TornEdge from "./TornEdge";
import { breakXOf, localClipPlane } from "./tornEdgeGeometry";
import { trialPlayback } from "./trialPlayback";
import WalkEyes from "./WalkEyes";

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
 * so the hull stays sliced on the break line however the half turns. For a
 * moment after the break it also carries the whole ship's idle bob, fading
 * out, so a choppy sea's rise and pitch do not snap off.
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
  const carry = useRef<Group>(null);
  const get = useThree((state) => state.get);
  const { stabilityRatio, reducedMotion, seaState } = useShipAnimation();
  const bob = useMemo(() => createShipPose(), []);
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
    const outer = carry.current;
    const { halves, breakup, time, sink } = trialPlayback;
    if (!target || !outer || !halves) return;
    applyHalfPose(target, halves[side], lengthCells);
    const weight =
      breakup && !reducedMotion ? bobCarryWeight(time - breakup.at) : 0;
    if (weight > 0) {
      const now = sceneTime(get().clock.elapsedTime);
      bobPose(now, stabilityRatio, bob, seaState);
      applyBobCarry(outer, bob.y * weight, bob.pitch * weight, -sink);
    } else {
      applyBobCarry(outer, 0, 0, 0);
    }
    outer.updateMatrixWorld();
    value.clip.copy(local).applyMatrix4(target.matrixWorld);
  };
  useLayoutEffect(place);
  // Priority -1: the half is placed before its walker's eyes (a child) read
  // its matrix, as BobGroup does for the whole ship.
  useFrame(place, -1);

  return (
    <group ref={carry}>
      <group ref={group}>
        <ShipHalfContext.Provider value={value}>
          {children}
          <TornEdge side={side} atX={atX} />
          <WalkEyes half={side} />
        </ShipHalfContext.Provider>
      </group>
    </group>
  );
}

interface BrokenShipProps {
  /** Where she breaks (or broke), cells from the bow. */
  atX: number;
  /**
   * False until she breaks: the halves are mounted ahead of time but not
   * drawn, so the break itself costs no mount or shader compile.
   */
  isBroken: boolean;
  /** The whole ship's contents; each half draws its own share of them. */
  children: ReactNode;
}

/**
 * The ship after she breaks in two: the same contents drawn twice, once per
 * half, each cut at the break and keeping only its own parts, plus the burst
 * of the break itself. Mounted hidden for the whole trial once the break is
 * known (the timeline is worked out ahead), and its shaders are compiled
 * then, so nothing hitches in the slow motion of the break.
 */
export default function BrokenShip({
  atX,
  isBroken,
  children,
}: BrokenShipProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const lengthCells = gridLength(ship);
  const sides = useMemo(() => partHalves(ship, atX), [ship, atX]);
  const snapped = useMemo(() => snappedWires(ship, atX), [ship, atX]);
  const contents = Children.toArray(children).filter(
    (child) => !isValidElement(child) || !BUILD_ONLY.has(child.type)
  );
  const root = useRef<Group>(null);
  const get = useThree((state) => state.get);

  // Compile the halves' shaders (their cut materials too) while they are
  // still hidden: `compile` only visits visible objects, so show them for the
  // call alone. The scene's lights decide the programs, so pass the scene.
  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    const { gl, scene, camera } = get();
    const wasVisible = group.visible;
    group.visible = true;
    try {
      gl.compile(group, camera, scene);
    } finally {
      group.visible = wasVisible;
    }
  }, [get, atX]);

  return (
    <group ref={root} visible={isBroken}>
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
    </group>
  );
}
