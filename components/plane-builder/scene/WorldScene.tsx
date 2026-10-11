"use client";

import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import type { Screen } from "@/lib/plane-builder/state/store";
import CameraPose from "./CameraPose";
import FinishGate from "./FinishGate";
import LaunchPlane from "./LaunchPlane";
import Obstacles from "./Obstacles";
import Pickups from "./Pickups";
import Sky from "./Sky";
import Slingshot from "./Slingshot";
import Terrain from "./Terrain";

const LAUNCH_CAMERA = [-14, 6, 0] as const;
const LAUNCH_TARGET = [8, 3, 0] as const;

interface WorldSceneProps {
  level: LevelDef;
  tiers: Tiers;
  screen: Screen;
}

/** The level's world: sky, ground, obstacles, pickups, finish and slingshot. */
export default function WorldScene({ level, tiers, screen }: WorldSceneProps) {
  return (
    <>
      <CameraPose position={LAUNCH_CAMERA} target={LAUNCH_TARGET} />
      <Sky palette={level.palette} />
      <Terrain level={level} />
      <Obstacles level={level} />
      <Pickups level={level} />
      <FinishGate level={level} />
      <Slingshot tier={tiers.launcher} />
      {screen === "launch" ? <LaunchPlane level={level} tiers={tiers} /> : null}
    </>
  );
}
