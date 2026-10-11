"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, Vector3 } from "three";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import { launchAim } from "@/lib/plane-builder/state/launchAim";
import PlaneModel from "./PlaneModel";
import { pullPosition } from "./Slingshot";

const position = new Vector3();

interface LaunchPlaneProps {
  level: LevelDef;
  tiers: Tiers;
}

/** The plane resting in the slingshot, drawn back and aimed by `launchAim`. */
export default function LaunchPlane({ level, tiers }: LaunchPlaneProps) {
  const plane = useRef<Group>(null);
  useFrame(() => {
    const group = plane.current;
    if (!group) return;
    group.position.copy(pullPosition(launchAim, position));
    group.rotation.set(0, -launchAim.yaw, launchAim.pitch, "YZX");
  });
  return (
    <PlaneModel
      ref={plane}
      levelId={level.id}
      tiers={tiers}
      palette={level.palette}
    />
  );
}
