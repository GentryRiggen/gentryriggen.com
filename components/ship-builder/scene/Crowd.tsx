"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { planCrowd } from "@/lib/ship-builder/crowd/plan";
import type { PersonPose } from "@/lib/ship-builder/crowd/types";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { getWalkState } from "@/lib/ship-builder/state/walkLive";
import { walkGridOf } from "@/lib/ship-builder/walk";
import { personWorldTransform } from "./crowdView";
import PersonMesh from "./PersonMesh";

type Activity = PersonPose["activity"];

/** The people of a ship in walk mode, strolling the decks and sitting down. */
function CrowdRunner() {
  const ship = useShipBuilderStore((s) => s.ship);
  const grid = useMemo(() => walkGridOf(ship), [ship]);
  const plan = useMemo(
    () => planCrowd(ship, grid, analyzeShip(ship).stats),
    [ship, grid]
  );
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const groups = useRef<(Group | null)[]>([]);
  const [activities, setActivities] = useState<Activity[]>(() =>
    plan.people.map(() => "idle")
  );
  const last = useRef<Activity[]>(activities);

  useFrame(() => {
    const walk = getWalkState();
    if (!walk) return;
    let changed = false;
    const next = last.current.slice();
    plan.people.forEach((_, i) => {
      const holder = groups.current[i];
      if (!holder) return;
      const pose = plan.poseAt(i, walk.time);
      const t = personWorldTransform(pose, grid, length, beam);
      holder.position.set(t.x, t.y, t.z);
      holder.rotation.y = t.rotationY;
      if (next[i] !== pose.activity) {
        next[i] = pose.activity;
        changed = true;
      }
    });
    if (changed) {
      last.current = next;
      setActivities(next);
    }
  });

  return (
    <>
      {plan.people.map((person, i) => (
        <group
          key={person.id}
          ref={(node) => {
            groups.current[i] = node;
          }}
        >
          <PersonMesh outfit={person.outfit} activity={activities[i]} />
        </group>
      ))}
    </>
  );
}

/**
 * The crowd, only while walking and with no sea trial on show. Mounted inside
 * the ship's bobbing group, so the people ride the deck.
 */
export default function Crowd() {
  const isShown = useShipBuilderStore(
    (s) =>
      s.walk.status === "walking" &&
      s.trial.status !== "running" &&
      s.trial.status !== "result"
  );
  return isShown ? <CrowdRunner /> : null;
}
