"use client";

import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import {
  type Screen,
  usePlaneBuilderStore,
} from "@/lib/plane-builder/state/store";
import ChaseCamera from "./ChaseCamera";
import FinishGate from "./FinishGate";
import FlightRunner from "./FlightRunner";
import LaunchPlane from "./LaunchPlane";
import Obstacles from "./Obstacles";
import Pickups from "./Pickups";
import Sky from "./Sky";
import Slingshot from "./Slingshot";
import Terrain from "./Terrain";

interface WorldSceneProps {
  level: LevelDef;
  tiers: Tiers;
  screen: Screen;
}

/** The level's world: sky, ground, obstacles, pickups, finish and slingshot. */
export default function WorldScene({ level, tiers, screen }: WorldSceneProps) {
  const flightId = usePlaneBuilderStore((s) => s.flightId);
  return (
    <>
      <ChaseCamera level={level} screen={screen} />
      <Sky palette={level.palette} />
      <Terrain level={level} />
      <Obstacles level={level} />
      <Pickups level={level} />
      <FinishGate level={level} />
      <Slingshot tier={tiers.launcher} />
      {screen === "launch" ? <LaunchPlane level={level} tiers={tiers} /> : null}
      {screen === "flight" ? (
        <FlightRunner key={flightId} level={level} tiers={tiers} />
      ) : null}
    </>
  );
}
