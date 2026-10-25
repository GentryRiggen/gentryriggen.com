"use client";

import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { isFunnelType } from "@/lib/ship-builder/model/funnelLivery";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { fallingFunnelPose } from "@/lib/ship-builder/sim/funnelFall";
import type { FunnelFall } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { modelToWorld } from "./coords";
import { funnelRadius, funnelSplashSeconds } from "./funnelFallView";
import ParticleField, { type ParticleWriter } from "./ParticleField";
import PartMesh from "./PartMesh";
import {
  createDroplet,
  splashDroplet,
  splashRing,
  SPLASH_DROPLET_COUNT,
  SPLASH_RING_COUNT,
  TRIAL_SPLASH_CAPACITY,
  type HullBounds,
} from "./trialEffects";
import { trialPlayback } from "./trialPlayback";

/** The sim breaks off at most two funnels (see `stepFunnelFalls`). */
const MAX_FALLS = 2;
const SPLASH_COLOR = "#ffffff";

function fallOf(funnelId: string): FunnelFall | undefined {
  return trialPlayback.funnelFalls.find((fall) => fall.funnelId === funnelId);
}

interface FallingFunnelProps {
  ship: Ship;
  part: PlacedPart;
}

/**
 * One funnel's broken-off twin, drawn in the water's frame. It is mounted for
 * the whole trial but hidden until its funnel snaps, then follows
 * `fallingFunnelPose` each frame, so scrubbing back puts it away again.
 */
function FallingFunnel({ ship, part }: FallingFunnelProps) {
  const group = useRef<Group>(null);
  // The part draws itself at its place on the ship; undo that so its base
  // sits at this group's origin.
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
    const fall = fallOf(part.id);
    const isFalling = !!fall && fall.at <= trialPlayback.time;
    target.visible = isFalling;
    if (!fall || !isFalling) return;
    const { position, rotation } = fallingFunnelPose(
      fall,
      trialPlayback.time - fall.at,
      funnelRadius(part.type)
    );
    target.position.set(position.x, position.y, position.z);
    target.rotation.set(rotation.x, rotation.y, rotation.z);
  });

  return (
    <group ref={group} visible={false}>
      <group position={offset}>
        <PartMesh ship={ship} part={part} color={part.color} mark={part.mark} />
      </group>
    </group>
  );
}

interface FunnelSplashProps {
  /** Funnel id → body height, for where its length lands in the water. */
  heights: ReadonlyMap<string, number>;
}

/** A splash and a ring of ripples where each funnel slaps into the sea. */
function FunnelSplash({ heights }: FunnelSplashProps) {
  const droplet = useMemo(() => createDroplet(), []);
  const bounds = useMemo<HullBounds>(
    () => ({ halfLength: 0.6, halfBeam: 0.3 }),
    []
  );
  const update = useCallback(
    (writer: ParticleWriter) => {
      const { funnelFalls, time } = trialPlayback;
      let count = 0;
      for (let i = 0; i < MAX_FALLS && i < funnelFalls.length; i++) {
        const fall = funnelFalls[i];
        const seconds = funnelSplashSeconds(fall, time);
        if (seconds === null) continue;
        // Centre on the middle of the funnel as it lies on the water.
        const pose = fallingFunnelPose(fall, Math.max(0, time - fall.at));
        const half = (heights.get(fall.funnelId) ?? 2) / 2;
        const cx = pose.position.x;
        const cz = pose.position.z + fall.side * half;
        for (let slot = 0; slot < SPLASH_DROPLET_COUNT; slot++) {
          splashDroplet(slot, seconds, fall.side, bounds, droplet);
          writer.set(
            count++,
            cx + droplet.x,
            droplet.y,
            cz + droplet.z - fall.side * bounds.halfBeam,
            droplet.scale,
            droplet.alpha
          );
        }
        for (let slot = 0; slot < SPLASH_RING_COUNT; slot++) {
          splashRing(slot, seconds, bounds, droplet);
          writer.set(
            count++,
            cx + droplet.x,
            droplet.y,
            cz + droplet.z,
            droplet.scale,
            droplet.alpha
          );
        }
      }
      return count;
    },
    [bounds, droplet, heights]
  );
  return (
    <ParticleField
      capacity={MAX_FALLS * TRIAL_SPLASH_CAPACITY}
      color={SPLASH_COLOR}
      update={update}
    />
  );
}

/**
 * Funnels that snap off in a sinking: each falls from where it broke, slaps
 * into the sea to its low side, floats a moment and sinks to the floor beside
 * the wreck. The ship hides the attached funnel from the same moment
 * (`ShipParts`). Only mounted while a trial runs or shows its result.
 */
export default function FallingFunnels() {
  const isShown = useShipBuilderStore(
    (s) => s.trial.status === "running" || s.trial.status === "result"
  );
  const ship = useShipBuilderStore((s) => s.ship);
  const reducedMotion = usePrefersReducedMotion();
  const funnels = useMemo(
    () => ship.parts.filter((part) => isFunnelType(part.type)),
    [ship]
  );
  const heights = useMemo(
    () =>
      new Map(funnels.map((part) => [part.id, getPartDef(part.type).height])),
    [funnels]
  );

  if (!isShown || funnels.length === 0) return null;
  return (
    <>
      {funnels.map((part) => (
        <FallingFunnel key={part.id} ship={ship} part={part} />
      ))}
      {!reducedMotion && <FunnelSplash heights={heights} />}
    </>
  );
}
