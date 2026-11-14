"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useWebGLSupport from "@/components/ship-builder/hooks/useWebGLSupport";
import { PLANETS } from "@/lib/planet-smasher/planets";
import { loadProgress } from "@/lib/planet-smasher/progress";
import { TOOLS, type ToolId } from "@/lib/planet-smasher/tools";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  TEST_HOOKS_ENABLED,
  installTestHooks,
} from "@/lib/planet-smasher/testHooks";
import { tryFire } from "@/lib/planet-smasher/cooldown";
import { uvToDir, type Vec3 } from "@/lib/planet-smasher/sphere";
import Arsenal from "./ui/Arsenal";
import Hud from "./ui/Hud";
import PlanetPicker from "./ui/PlanetPicker";
import UnlockToast from "./ui/UnlockToast";
import { DamagePainter } from "./scene/DamagePainter";
import { laserAim } from "./scene/effects/laserAim";
import {
  pushEffect,
  type ActiveEffect,
  type ImpactOpts,
} from "./scene/effects/effectQueue";
import type { PlanetTextures } from "./scene/planetTextures";
import { loadPlanetTextures } from "./scene/planetTextures";

const Stage = dynamic(() => import("./scene/Stage"), {
  ssr: false,
  loading: () => <Message>Warming up the planet…</Message>,
});

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6 text-center text-base text-slate-300">
      {children}
    </div>
  );
}

export default function PlanetSmasher() {
  const webgl = useWebGLSupport();
  const planetId = useGameStore((s) => s.progress.planetId);
  const ready = useGameStore((s) => s.planet !== null);
  const [textures, setTextures] = useState<PlanetTextures | null>(null);
  const [failed, setFailed] = useState(false);

  const painter = useMemo(
    () => (textures ? new DamagePainter(textures.night) : null),
    [textures]
  );
  const populationRef = useGameStore((s) => s.planet?.remaining);

  // A fresh planet (new population array) wipes the painted wreck.
  useEffect(() => {
    painter?.reset(textures?.night ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [populationRef]);

  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  const nextId = useRef(1);
  const shots = useRef(0);

  // Damage lands when an effect hits: hit the planet and paint the scar.
  const handleImpact = useCallback(
    (toolId: ToolId, u: number, v: number, _point: Vec3, opts?: ImpactOpts) => {
      useGameStore.getState().hit(toolId, u, v);
      const tool = TOOLS[toolId];
      if (tool.stamp !== "none") {
        painter?.stamp(tool.stamp, u, v, tool.radius, opts);
      }
    },
    [painter]
  );

  const handleEffectDone = useCallback((id: number) => {
    setEffects((list) => list.filter((e) => e.id !== id));
  }, []);

  /** Starts a weapon effect; returns its id. */
  const spawn = useCallback((toolId: ToolId, u: number, v: number) => {
    const id = nextId.current++;
    setEffects((list) =>
      pushEffect(
        list,
        {
          toolId,
          u,
          v,
          point: uvToDir(u, v),
          startedAt: performance.now(),
        },
        id
      )
    );
    shots.current++;
    if (typeof window !== "undefined" && window.__planetSmasher) {
      window.__planetSmasher.shots = shots.current;
    }
    return id;
  }, []);

  const aim = useCallback((u: number, v: number, point: Vec3) => {
    laserAim.u = u;
    laserAim.v = v;
    laserAim.point = point;
  }, []);

  // A tap: respects the tool's cooldown. Damage waits for the impact.
  const playerFire = useCallback(
    (u: number, v: number) => {
      const toolId = useGameStore.getState().progress.toolId;
      if (!tryFire(toolId)) return;
      spawn(toolId, u, v);
    },
    [spawn]
  );

  // Holding the laser: one beam while held, a shot each time the cooldown
  // allows (each tick's damage lands through the beam's onImpact).
  const holdStart = useCallback(
    (u: number, v: number, point: Vec3) => {
      const toolId = useGameStore.getState().progress.toolId;
      if (TOOLS[toolId].mode !== "hold") return;
      laserAim.owner = spawn(toolId, u, v);
      laserAim.held = true;
      laserAim.ticks = 0;
      aim(u, v, point);
      if (tryFire(toolId)) laserAim.ticks++;
    },
    [spawn, aim]
  );
  const holdMove = useCallback(
    (u: number, v: number, point: Vec3) => {
      if (!laserAim.held) return;
      aim(u, v, point);
      if (tryFire(useGameStore.getState().progress.toolId)) laserAim.ticks++;
    },
    [aim]
  );
  const holdEnd = useCallback(() => {
    laserAim.held = false;
  }, []);

  // The test hook shoots without a cooldown. A hold tool fires a one-second
  // burst (eight ticks).
  const hookFire = useCallback(
    (toolId: ToolId, u: number, v: number) => {
      if (TOOLS[toolId].mode !== "hold") {
        spawn(toolId, u, v);
        return;
      }
      const point = uvToDir(u, v);
      laserAim.owner = spawn(toolId, u, v);
      laserAim.held = true;
      laserAim.ticks = 0;
      aim(u, v, point);
      let n = 0;
      const timer = setInterval(() => {
        laserAim.ticks++;
        if (++n >= 8) {
          clearInterval(timer);
          laserAim.held = false;
        }
      }, 125);
    },
    [spawn, aim]
  );

  useEffect(() => {
    if (!TEST_HOOKS_ENABLED) return;
    return installTestHooks(hookFire);
  }, [hookFire]);

  // The first load reads the saved planet; later planet changes (store
  // selectPlanet) reload textures for the new one.
  useEffect(() => {
    if (webgl !== true) return;
    let live = true;
    const id = ready ? planetId : loadProgress().planetId;
    loadPlanetTextures(id)
      .then((t) => {
        if (!live) return;
        if (!useGameStore.getState().planet) {
          useGameStore.getState().init(t.population);
        }
        setTextures(t);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [webgl, ready, planetId]);

  const hasMoon = PLANETS[planetId].hasMoon;
  const holdMode = useGameStore(
    (s) => TOOLS[s.progress.toolId].mode === "hold"
  );

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-white touch-none">
      {webgl === false ? (
        <Message>
          This device can&apos;t show 3D yet. Try Safari or Chrome on a newer
          device to smash some planets!
        </Message>
      ) : failed ? (
        <Message>The planet would not load. Please reload the page.</Message>
      ) : webgl === null || !textures ? (
        <Message>Warming up the planet…</Message>
      ) : (
        <>
          <Stage
            textures={textures}
            painter={painter!}
            hasMoon={hasMoon}
            holdMode={holdMode}
            onFire={playerFire}
            onHoldStart={holdStart}
            onHoldMove={holdMove}
            onHoldEnd={holdEnd}
            effects={effects}
            onImpact={handleImpact}
            onEffectDone={handleEffectDone}
          />
          <Hud left={<PlanetPicker />} />
          <Arsenal />
          <UnlockToast />
        </>
      )}
    </div>
  );
}
