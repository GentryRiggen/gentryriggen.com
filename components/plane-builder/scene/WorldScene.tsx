"use client";

import { useEffect } from "react";
import { useQualityStore } from "@/lib/plane-builder/render/qualityStore";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import {
  type Screen,
  usePlaneBuilderStore,
} from "@/lib/plane-builder/state/store";
import { playFlightEvents } from "../audio/flightCues";
import GhostSound from "../audio/GhostSound";
import useActiveGhost from "../hooks/useActiveGhost";
import BestWall from "./BestWall";
import ChaseCamera from "./ChaseCamera";
import FinishGate from "./FinishGate";
import FlightRunner from "./FlightRunner";
import GhostPlane from "./GhostPlane";
import LaunchPlane from "./LaunchPlane";
import Markers from "./Markers";
import Obstacles from "./Obstacles";
import Pickups from "./Pickups";
import Sky from "./Sky";
import Slingshot from "./Slingshot";
import Terrain from "./Terrain";
import Winds from "./Winds";

interface WorldSceneProps {
  level: LevelDef;
  tiers: Tiers;
  screen: Screen;
}

/** The level's world: sky, ground, obstacles, winds, pickups, flags, finish and slingshot. */
export default function WorldScene({ level, tiers, screen }: WorldSceneProps) {
  const flightId = usePlaneBuilderStore((s) => s.flightId);
  const best = usePlaneBuilderStore((s) => s.progress.levels[s.levelId].best);
  const ghost = useActiveGhost();
  // A world loading in (models, shaders) stalls frames: don't read that as slow.
  useEffect(() => useQualityStore.getState().startWarmup(), []);
  const hasEngine =
    tiers.engine > 0 && level.plane.engine.values[tiers.engine] > 0;
  return (
    <>
      <ChaseCamera level={level} screen={screen} />
      <Sky palette={level.palette} />
      <Terrain level={level} />
      <Obstacles level={level} />
      <Winds level={level} />
      <Pickups level={level} hasEngine={hasEngine} />
      <Markers level={level} />
      <BestWall level={level} best={best} />
      <FinishGate level={level} />
      <Slingshot tier={tiers.launcher} palette={level.palette} />
      {screen === "launch" ? <LaunchPlane level={level} tiers={tiers} /> : null}
      {screen === "flight" && ghost ? (
        <GhostPlane
          key={`ghost-${flightId}`}
          level={level}
          tiers={tiers}
          ghost={ghost}
        />
      ) : null}
      {screen === "flight" && ghost ? (
        <GhostSound key={`ghost-sound-${flightId}`} ghost={ghost} />
      ) : null}
      {screen === "flight" ? (
        <FlightRunner
          key={flightId}
          level={level}
          tiers={tiers}
          onEvents={playFlightEvents}
        />
      ) : null}
    </>
  );
}
