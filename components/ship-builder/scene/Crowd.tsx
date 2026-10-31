"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, type InstancedMesh } from "three";
import {
  type BoatLaunch,
  type BodyPose,
  type FloatStart,
  floatingSince,
  floatPositionAt,
} from "@/lib/ship-builder/crowd/evacuation";
import type { PersonPose } from "@/lib/ship-builder/crowd/types";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { Ship } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { getWalkState } from "@/lib/ship-builder/state/walkLive";
import { boatSpotsOf } from "./boatSpots";
import {
  armSwing,
  CREW_OUTFIT,
  crowdGeometries,
  crowdMaterials,
  launchedBoatMatrix,
  topColorOf,
  writePerson,
  type CrowdMeshes,
} from "./crowdBodies";
import { crowdCarriers } from "./CrowdCarrier";
import {
  boatSeatOffsets,
  carrierOf,
  crowdPlanFor,
  personWorldTransform,
  type Carrier,
  type ShipCrowd,
} from "./crowdView";
import { noRaycast } from "./noRaycast";
import { halfOfX, partHalves } from "./partHalves";
import { activeEvacuation } from "./trialTimeline";
import { trialPlayback, type TrialPlayback } from "./trialPlayback";

/** Height and rate of a floater's bob on the swell. */
const FLOAT_BOB = 0.04;
const FLOAT_BOB_RATE = 1.9;
/** How high a jump into a raft rises above the straight line, mid-leap. */
const JUMP_ARC = 0.35;

/** Where she is broken in the playback (cells from the bow), or null. */
function brokenAtX(playback: TrialPlayback): number | null {
  const { halves, breakup } = playback;
  if (!halves) return null;
  return breakup?.atX ?? halves.bow.pivotX;
}

/** The body carrying someone `cellsFromBow` along, from the playback now. */
function playbackBody(playback: TrialPlayback, cellsFromBow: number): BodyPose {
  const atX = brokenAtX(playback);
  if (atX !== null && playback.halves) {
    return playback.halves[halfOfX(cellsFromBow, atX)];
  }
  return playback;
}

interface CrowdRunnerProps {
  ship: Ship;
  crowd: ShipCrowd;
}

/**
 * Everyone, drawn in world space as a few instanced meshes and posed in one
 * frame callback. Aboard (walking the decks, or hurrying to a boat) they ride
 * the group that carries them; in a boat they sit in it, on its davit or out
 * on the water, or jumping from the deck edge into a raft; in the sea they
 * float on their backs. Filling every seat, anyone with no way to their boat
 * shrinks away and appears in it.
 */
function CrowdRunner({ ship, crowd }: CrowdRunnerProps) {
  const { grid, plan } = crowd;
  const count = plan.people.length;
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const torso = useRef<InstancedMesh>(null);
  const legsHead = useRef<InstancedMesh>(null);
  const arms = useRef<InstancedMesh>(null);
  const cap = useRef<InstancedMesh>(null);
  const geometry = crowdGeometries();
  const material = crowdMaterials();

  const capSlots = useMemo(() => {
    let next = 0;
    return plan.people.map((person) =>
      person.outfit === CREW_OUTFIT ? next++ : -1
    );
  }, [plan]);
  const crewCount = capSlots.filter((slot) => slot >= 0).length;
  const boats = useMemo(() => boatSpotsOf(ship), [ship]);

  // Per-frame scratch, reused so posing everyone allocates nothing big.
  const scratch = useMemo(
    () => ({
      place: new Matrix4(),
      local: new Matrix4(),
      boat: new Matrix4(),
      shrink: new Matrix4(),
      carriers: new Map<Carrier, Matrix4 | null>(),
      transform: { x: 0, y: 0, z: 0, rotationY: 0 },
      floats: new Array<FloatStart | null>(count).fill(null),
      floatsAt: -Infinity,
      launches: null as readonly BoatLaunch[] | null,
      launchById: new Map<string, BoatLaunch>(),
      halvesAtX: null as number | null,
      halves: null as ReturnType<typeof partHalves> | null,
    }),
    [count]
  );

  useLayoutEffect(() => {
    const color = new Color();
    plan.people.forEach((person, i) => {
      color.set(topColorOf(person.outfit));
      torso.current?.setColorAt(i, color);
      arms.current?.setColorAt(2 * i, color);
      arms.current?.setColorAt(2 * i + 1, color);
    });
    for (const mesh of [torso.current, arms.current]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [plan]);

  useFrame(() => {
    const meshes: CrowdMeshes | null =
      torso.current && legsHead.current && arms.current
        ? {
            torso: torso.current,
            legsHead: legsHead.current,
            arms: arms.current,
            cap: cap.current,
          }
        : null;
    if (!meshes) return;
    const { trial } = useShipBuilderStore.getState();
    const inTrial = trial.status === "running" || trial.status === "result";
    const time = inTrial ? trialPlayback.time : (getWalkState()?.time ?? 0);
    const evacuation = inTrial ? activeEvacuation() : null;
    const atX = inTrial ? brokenAtX(trialPlayback) : null;

    // Each carrier's world matrix, brought up to date once this frame.
    scratch.carriers.clear();
    const carrierMatrix = (carrier: Carrier): Matrix4 | null => {
      if (scratch.carriers.has(carrier)) return scratch.carriers.get(carrier)!;
      const group = crowdCarriers[carrier];
      group?.updateWorldMatrix(true, false);
      const matrix = group ? group.matrixWorld : null;
      scratch.carriers.set(carrier, matrix);
      return matrix;
    };

    const launches = evacuation?.launches ?? null;
    if (scratch.launches !== launches) {
      scratch.launches = launches;
      scratch.launchById = new Map(
        (launches ?? []).map((launch) => [launch.boatId, launch])
      );
    }
    if (scratch.halvesAtX !== atX) {
      scratch.halvesAtX = atX;
      scratch.halves = atX === null ? null : partHalves(ship, atX);
    }
    // A trial with no plan (the weather, or a sinking she survives): people
    // stay aboard until the water reaches them. Scrubbing back forgets.
    if (time < scratch.floatsAt) scratch.floats.fill(null);
    scratch.floatsAt = time;

    const aboard = (pose: PersonPose): Matrix4 | null => {
      const carrier = carrierMatrix(carrierOf(pose.x, atX));
      if (!carrier) return null;
      const t = personWorldTransform(
        pose,
        grid,
        length,
        beam,
        scratch.transform
      );
      scratch.local.makeRotationY(t.rotationY).setPosition(t.x, t.y, t.z);
      return scratch.place.multiplyMatrices(carrier, scratch.local);
    };
    /** On their back at the surface, bobbing, each turned their own way. */
    const floating = (i: number, x: number, z: number): Matrix4 => {
      const bob = FLOAT_BOB * Math.sin(time * FLOAT_BOB_RATE + i * 2.3);
      return scratch.place.makeRotationY(i * 2.4).setPosition(x, bob, z);
    };

    for (let i = 0; i < count; i++) {
      const slot = capSlots[i];
      if (!evacuation) {
        const pose = plan.poseAt(i, time);
        let float = scratch.floats[i];
        if (inTrial && !float) {
          float = floatingSince(
            () => pose,
            (_, x) => playbackBody(trialPlayback, x),
            time,
            time,
            { length, beam },
            { includeEnd: true }
          );
          scratch.floats[i] = float;
        }
        if (float) {
          const at = floatPositionAt(float, time);
          writePerson(meshes, i, slot, floating(i, at.x, at.z), "lie", 0);
          continue;
        }
        const kind = pose.activity === "sit" ? "sit" : "stand";
        const swing = armSwing(pose.activity === "walk", time, i);
        writePerson(meshes, i, slot, aboard(pose), kind, swing);
        continue;
      }

      const fate = evacuation.fateAt(i, time);
      if (fate.kind === "floating") {
        const place = floating(i, fate.at.x, fate.at.z);
        writePerson(meshes, i, slot, place, "lie", 0);
        continue;
      }
      if (fate.kind === "in-boat") {
        const launch = scratch.launchById.get(fate.boatId);
        const spot = boats.get(fate.boatId);
        if (!launch || !spot) {
          writePerson(meshes, i, slot, null, "sit", 0);
          continue;
        }
        const seats = boatSeatOffsets(launch.riders.length, spot.hull);
        const seat = seats[Math.min(fate.seat, seats.length - 1)];
        let boat: Matrix4 | null;
        if (launch.at <= time) {
          boat = launchedBoatMatrix(
            evacuation,
            launch,
            spot.hull,
            time,
            scratch.boat
          );
        } else {
          // Still on its davit: the boat rides the ship (or its half).
          const half = scratch.halves?.get(fate.boatId) ?? null;
          const carrier = carrierMatrix(half ?? "whole");
          boat = carrier
            ? scratch.boat
                .makeTranslation(spot.hang.x, spot.hang.y, spot.hang.z)
                .premultiply(carrier)
            : null;
        }
        if (!boat || !seat) {
          writePerson(meshes, i, slot, null, "sit", 0);
          continue;
        }
        scratch.local.makeTranslation(seat.x, seat.y, seat.z);
        writePerson(
          meshes,
          i,
          slot,
          scratch.place.multiplyMatrices(boat, scratch.local),
          "sit",
          0
        );
        continue;
      }
      if (fate.kind === "jumping") {
        // A leap in an arc from the deck edge down into their raft seat.
        const launch = scratch.launchById.get(fate.boatId);
        const spot = boats.get(fate.boatId);
        if (!launch || !spot) {
          writePerson(meshes, i, slot, null, "stand", 0);
          continue;
        }
        const seats = boatSeatOffsets(launch.riders.length, spot.hull);
        const seat = seats[Math.min(fate.seat, seats.length - 1)];
        const raft = launchedBoatMatrix(
          evacuation,
          launch,
          spot.hull,
          time,
          scratch.boat
        );
        scratch.local.makeTranslation(seat?.x ?? 0, seat?.y ?? 0, seat?.z ?? 0);
        scratch.place.multiplyMatrices(raft, scratch.local);
        // Read the seat out before the matrix is reused for the jumper.
        const seatAt = scratch.place.elements;
        const toX = seatAt[12];
        const toY = seatAt[13];
        const toZ = seatAt[14];
        const { from, progress: p } = fate;
        const dx = toX - from.x;
        const dz = toZ - from.z;
        const arc = JUMP_ARC * 4 * p * (1 - p);
        scratch.place
          .makeRotationY(Math.atan2(-dz, dx))
          .setPosition(
            from.x + dx * p,
            from.y + (toY - from.y) * p + arc,
            from.z + dz * p
          );
        writePerson(meshes, i, slot, scratch.place, "stand", 0);
        continue;
      }
      const pose = evacuation.poseAt(i, time);
      if (fate.kind === "transfer") {
        // Fill every seat, no way to the boat: shrink away where they
        // stand; they reappear in their seat.
        const size = 1 - fate.fade;
        const place = size > 0 ? aboard(pose) : null;
        place?.multiply(scratch.shrink.makeScale(size, size, size));
        writePerson(meshes, i, slot, place, "stand", 0);
        continue;
      }
      const kind = pose.activity === "sit" ? "sit" : "stand";
      const swing = armSwing(pose.activity === "walk", time, i);
      writePerson(meshes, i, slot, aboard(pose), kind, swing);
    }

    meshes.torso.instanceMatrix.needsUpdate = true;
    meshes.legsHead.instanceMatrix.needsUpdate = true;
    meshes.arms.instanceMatrix.needsUpdate = true;
    if (meshes.cap) meshes.cap.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <>
      <instancedMesh
        key={`torso:${count}`}
        ref={torso}
        args={[geometry.torso, material.instanced, count]}
        raycast={noRaycast}
        frustumCulled={false}
      />
      <instancedMesh
        key={`legs:${count}`}
        ref={legsHead}
        args={[geometry.legsHead, material.vertex, count]}
        raycast={noRaycast}
        frustumCulled={false}
      />
      <instancedMesh
        key={`arms:${count}`}
        ref={arms}
        args={[geometry.arm, material.instanced, count * 2]}
        raycast={noRaycast}
        frustumCulled={false}
      />
      {crewCount > 0 && (
        <instancedMesh
          key={`caps:${crewCount}`}
          ref={cap}
          args={[geometry.cap, material.cap, crewCount]}
          raycast={noRaycast}
          frustumCulled={false}
        />
      )}
    </>
  );
}

/**
 * The crowd: while walking, and through a sea trial (running or showing its
 * result), not while building. Drawn in world space; aboard, people follow
 * the ship's group or her halves (`CrowdCarrier`).
 */
export default function Crowd() {
  const isShown = useShipBuilderStore(
    (s) =>
      s.walk.status === "walking" ||
      s.trial.status === "running" ||
      s.trial.status === "result"
  );
  const ship = useShipBuilderStore((s) => s.ship);
  const crowd = useMemo(
    () => (isShown ? crowdPlanFor(ship) : null),
    [isShown, ship]
  );
  if (!crowd || crowd.plan.people.length === 0) return null;
  return <CrowdRunner ship={ship} crowd={crowd} />;
}
