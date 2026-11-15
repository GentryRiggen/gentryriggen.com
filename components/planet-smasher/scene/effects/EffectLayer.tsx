"use client";

import type { ComponentType } from "react";
import type { Vec3 } from "@/lib/planet-smasher/sphere";
import type { ToolId } from "@/lib/planet-smasher/tools";
import BlackHoleDrop from "./BlackHoleDrop";
import Blast from "./Blast";
import Eruption from "./Eruption";
import GravityBeam from "./GravityBeam";
import FreezeWave from "./FreezeWave";
import LaserBeam from "./LaserBeam";
import MeteorShower from "./MeteorShower";
import Monster from "./Monster";
import MoonRam from "./MoonRam";
import Mothership from "./Mothership";
import Nanobots from "./Nanobots";
import NukeVolley from "./NukeVolley";
import Projectile from "./Projectile";
import PlanetCollision from "./PlanetCollision";
import Quake from "./Quake";
import SunDive from "./SunDive";
import Tsunami from "./Tsunami";
import UfoSwarm from "./UfoSwarm";
import ParticleLayer from "./ParticleLayer";
import { ShakeDriver } from "./particles";
import type { ActiveEffect, EffectProps, ImpactOpts } from "./effectQueue";

const COMPONENTS: Record<ToolId, ComponentType<EffectProps>> = {
  asteroid: Projectile,
  meteorShower: MeteorShower,
  megaBomb: Blast,
  nuke: Blast,
  supervolcano: Eruption,
  earthquake: Quake,
  alienLaser: LaserBeam,
  freezeRay: FreezeWave,
  moonRam: MoonRam as ComponentType<EffectProps>,
  blackHole: BlackHoleDrop,
  nukeTwin: NukeVolley,
  nukeRain: NukeVolley,
  ufoSwarm: UfoSwarm,
  gravityBeam: GravityBeam,
  nanobots: Nanobots,
  mothership: Mothership,
  monster: Monster,
  tsunami: Tsunami,
  sunDive: SunDive,
  planetCollision: PlanetCollision,
};

interface EffectLayerProps {
  effects: ActiveEffect[];
  planetRadius?: number;
  hasMoon: boolean;
  onImpact(
    toolId: ToolId,
    u: number,
    v: number,
    point: Vec3,
    opts?: ImpactOpts,
    fireId?: number
  ): void;
  onEffectDone(id: number): void;
}

/** Mounts one component per live weapon effect, plus the camera shake. */
export default function EffectLayer({
  effects,
  planetRadius = 1,
  hasMoon,
  onImpact,
  onEffectDone,
}: EffectLayerProps) {
  return (
    <>
      <ShakeDriver />
      <ParticleLayer />
      {effects.map((e) => {
        const Comp = COMPONENTS[e.toolId];
        return (
          <Comp
            key={e.id}
            effect={e}
            planetRadius={planetRadius}
            {...(e.toolId === "moonRam" ? { hasMoon } : {})}
            onImpact={(u, v, point, opts) =>
              onImpact(e.toolId, u, v, point, opts, e.id)
            }
            onDone={() => onEffectDone(e.id)}
          />
        );
      })}
    </>
  );
}
