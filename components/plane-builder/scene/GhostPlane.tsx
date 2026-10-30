"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Material, type Mesh } from "three";
import {
  decodeGhost,
  poseAt,
  type Ghost,
} from "@/lib/plane-builder/ghost/ghost";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import PlaneModel from "./PlaneModel";

/** How see-through the ghost is (1 would be solid). */
export const GHOST_OPACITY = 0.38;
/** Sim seconds the ghost stays after its finish before it fades from view. */
const LINGER = 1.5;
/** The plane's pieces load one by one, so look for new ones this often. */
const FADE_EVERY_FRAMES = 20;

/** Makes every material under `root` see-through (once per material). */
function fadeMaterials(root: Group): void {
  root.traverse((node) => {
    const material = (node as Mesh).material as
      Material | Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      if (m.userData.isGhost) continue;
      m.userData.isGhost = true;
      m.transparent = true;
      m.opacity = GHOST_OPACITY;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
  });
}

interface GhostPlaneProps {
  level: LevelDef;
  tiers: Tiers;
  ghost: Ghost;
}

/**
 * A see-through copy of the player's plane flying a saved best flight, timed
 * to the running flight's clock. It is only drawn: it never touches the sim,
 * so it cannot collide or pick anything up.
 */
export default function GhostPlane({ level, tiers, ghost }: GhostPlaneProps) {
  const group = useRef<Group>(null);
  const frames = useRef(0);
  const poses = useMemo(() => decodeGhost(ghost), [ghost]);

  useFrame(() => {
    const root = group.current;
    const live = flightLive.get();
    if (!root || !live || poses.length === 0) return;
    root.visible = live.time <= ghost.time + LINGER;
    const pose = poseAt(poses, live.time);
    root.position.set(pose.x, pose.y, pose.z);
    root.rotation.set(pose.bank, -pose.heading, pose.pitch, "YZX");
    if (frames.current % FADE_EVERY_FRAMES === 0) fadeMaterials(root);
    frames.current += 1;
  });

  return (
    <group ref={group} name="ghost-plane">
      <PlaneModel levelId={level.id} tiers={tiers} palette={level.palette} />
    </group>
  );
}
