"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, type Group } from "three";
import {
  type BoatLaunch,
  type EvacuationPlan,
  RAFT_DROP_S,
  RAFT_INFLATE_S,
} from "@/lib/ship-builder/crowd/evacuation";
import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { modelToWorld } from "./coords";
import { launchedBoatMatrix } from "./crowdBodies";
import { smoothstep } from "./crowdView";
import {
  LIFEBOAT_HANG_OFFSET,
  LIFEBOAT_HULLS,
  lifeboatHullOf,
} from "./lifeboatHulls";
import PartMesh from "./PartMesh";
import { trialEvacuationFor } from "./trialTimeline";
import { trialPlayback } from "./trialPlayback";

interface LaunchedBoatProps {
  ship: Ship;
  part: PlacedPart;
  plan: EvacuationPlan;
  launch: BoatLaunch;
}

/**
 * One lifeboat once it leaves its davit, drawn in the water's frame: hidden
 * until its launch, then lowering, rowing out and bobbing (`boatPoseAt`), so
 * scrubbing back puts it away again. The ship hides the boat on its davit
 * from the same moment (`ShipParts`).
 */
function LaunchedBoat({ ship, part, plan, launch }: LaunchedBoatProps) {
  const group = useRef<Group>(null);
  const hull = lifeboatHullOf(part.type);
  const matrix = useMemo(() => new Matrix4(), []);
  // The part draws itself at its hang point on the ship; undo that so the
  // hang point sits at this group's origin, as `boatPoseAt` places it.
  const offset = useMemo<[number, number, number]>(() => {
    if (part.anchor.kind !== "attach") return [0, 0, 0];
    const point = resolveAttachPoint(ship, part.anchor);
    if (!point) return [0, 0, 0];
    const [x, y, z] = modelToWorld(
      gridLength(ship),
      beamOf(ship),
      point.position
    );
    return [-x, -y, -z];
  }, [ship, part]);

  const canister = useRef<Group>(null);
  const raft = useRef<Group>(null);

  useFrame(() => {
    const target = group.current;
    if (!target) return;
    const { time } = trialPlayback;
    const isLaunched = launch.at <= time;
    target.visible = isLaunched;
    if (!isLaunched) return;
    launchedBoatMatrix(plan, launch, hull, time, matrix);
    matrix.decompose(target.position, target.quaternion, target.scale);
    if (launch.kind !== "raft") return;
    // The canister tumbles down; on the water it pops open into the raft.
    const since = time - launch.at;
    const isOpen = since >= RAFT_DROP_S;
    if (canister.current) {
      canister.current.visible = !isOpen;
      canister.current.rotation.x = -launch.outward * since * CANISTER_SPIN;
    }
    if (raft.current) {
      raft.current.visible = isOpen;
      const grow = smoothstep((since - RAFT_DROP_S) / RAFT_INFLATE_S);
      raft.current.scale.setScalar(RAFT_FOLDED + (1 - RAFT_FOLDED) * grow);
    }
  });

  const mesh = (
    <group position={offset}>
      <PartMesh ship={ship} part={part} color={part.color} mark={part.mark} />
    </group>
  );
  return (
    <group ref={group} visible={false}>
      {launch.kind === "raft" ? (
        <>
          <group ref={canister}>{mesh}</group>
          <group ref={raft} visible={false}>
            <InflatedRaft outward={launch.outward} />
          </group>
        </>
      ) : (
        mesh
      )}
    </group>
  );
}

/** Radians per second a thrown raft canister turns over as it falls. */
const CANISTER_SPIN = 5;
/** An opening raft starts at this fraction of its size. */
const RAFT_FOLDED = 0.15;
const RAFT_ORANGE = "#f08a24";
const RAFT_FLOOR_GREY = "#3d434a";

interface InflatedRaftProps {
  /** Outboard in world z: +1 or -1. The arch leans to the outboard side. */
  outward: 1 | -1;
}

/**
 * The orange raft a canister opens into, round like a real one, with its
 * origin where a lifeboat's hang point would be: the floor sits
 * `LIFEBOAT_HANG_OFFSET` below it, where riders sit (`boatSeatOffsets`).
 */
function InflatedRaft({ outward }: InflatedRaftProps) {
  const radius = LIFEBOAT_HULLS["raft-canister"].width / 2;
  const floor = -LIFEBOAT_HANG_OFFSET;
  return (
    <group>
      <mesh position={[0, floor - 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.03, 20]} />
        <meshStandardMaterial color={RAFT_FLOOR_GREY} roughness={0.9} />
      </mesh>
      {[0, 0.09].map((y) => (
        <mesh
          key={y}
          position={[0, floor + y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[radius, 0.05, 10, 28]} />
          <meshStandardMaterial color={RAFT_ORANGE} roughness={0.6} />
        </mesh>
      ))}
      {/* The canopy's arch, left open so the riders show. */}
      <mesh position={[0, floor + 0.1, outward * radius * 0.35]} castShadow>
        <torusGeometry args={[radius * 0.9, 0.025, 8, 24, Math.PI]} />
        <meshStandardMaterial color={RAFT_ORANGE} roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * The lifeboats that lower away in a sinking, with the boat's own mesh. Only
 * mounted while an iceberg or storm trial runs or shows its result, and only
 * for a trial she does not survive (it has an evacuation plan).
 */
export default function LaunchedBoats() {
  const trial = useShipBuilderStore((s) => s.trial);
  const ship = useShipBuilderStore((s) => s.ship);
  const isShown = trial.status === "running" || trial.status === "result";
  const input = isShown ? trial.input : null;
  const descending = isShown ? trial.descending : false;
  const plan = useMemo(
    () => (input ? trialEvacuationFor(input, ship, descending) : null),
    [input, ship, descending]
  );
  const byId = useMemo(
    () => new Map(ship.parts.map((part) => [part.id, part])),
    [ship]
  );
  if (!plan) return null;
  return (
    <>
      {plan.launches.map((launch) => {
        const part = byId.get(launch.boatId);
        return part ? (
          <LaunchedBoat
            key={launch.boatId}
            ship={ship}
            part={part}
            plan={plan}
            launch={launch}
          />
        ) : null;
      })}
    </>
  );
}
