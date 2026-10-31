"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, type Group } from "three";
import type {
  BoatLaunch,
  EvacuationPlan,
} from "@/lib/ship-builder/crowd/evacuation";
import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { modelToWorld } from "./coords";
import { launchedBoatMatrix } from "./crowdBodies";
import { lifeboatHullOf } from "./lifeboatHulls";
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

  useFrame(() => {
    const target = group.current;
    if (!target) return;
    const { time } = trialPlayback;
    const isLaunched = launch.at <= time;
    target.visible = isLaunched;
    if (!isLaunched) return;
    launchedBoatMatrix(plan, launch, hull, time, matrix);
    matrix.decompose(target.position, target.quaternion, target.scale);
  });

  return (
    <group ref={group} visible={false}>
      <group position={offset}>
        <PartMesh ship={ship} part={part} color={part.color} mark={part.mark} />
      </group>
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
