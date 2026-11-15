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
import { tryFire as tryCooldown } from "@/lib/planet-smasher/cooldown";
import { isUnlocked } from "@/lib/planet-smasher/unlocks";
import { uvToDir, type Vec3 } from "@/lib/planet-smasher/sphere";
import Arsenal from "./ui/Arsenal";
import ComboBadge from "./ui/ComboBadge";
import Hud from "./ui/Hud";
import VersionLink from "./ui/VersionLink";
import PlanetPicker from "./ui/PlanetPicker";
import EndingOverlay from "./ui/EndingOverlay";
import SoundToggle from "./ui/SoundToggle";
import UnlockToast from "./ui/UnlockToast";
import TapHint from "./ui/TapHint";
import TrophyShelf from "./ui/TrophyShelf";
import TrophyToast from "./ui/TrophyToast";
import { useSoundEnabled } from "./audio/soundSetting";
import useSoundUnlock from "./audio/useSoundUnlock";
import useServiceWorker from "./hooks/useServiceWorker";
import { TOOL_CUES, playCue } from "./audio/sfx";
import DeathLabels from "./ui/DeathLabels";
import {
  addDeathLabel,
  clearDeathLabels,
  shouldLabel,
} from "@/lib/planet-smasher/deathLabels";
import { DamagePainter } from "./scene/DamagePainter";
import { laserAim } from "./scene/effects/laserAim";
import { startLaserTicker } from "./scene/effects/laserTicker";
import {
  isLiveTool,
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

/** A tap or hold fires only an unlocked tool that is off cooldown. */
function tryFire(toolId: ToolId): boolean {
  const { progress, phase } = useGameStore.getState();
  if (phase !== "playing") return false;
  if (
    !isUnlocked({ kind: "tool", id: toolId }, progress.points, progress.owned)
  )
    return false;
  return tryCooldown(toolId);
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

  useSoundUnlock(useSoundEnabled());
  useServiceWorker();

  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  // The same list, readable between renders (the one-live-mothership rule).
  const effectsRef = useRef<ActiveEffect[]>([]);
  effectsRef.current = effects;
  // Keeps a held laser firing while the pointer is still.
  const stopTicker = useRef<(() => void) | null>(null);
  const hookTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      stopTicker.current?.();
      if (hookTimer.current) clearInterval(hookTimer.current);
    },
    []
  );

  // A fresh planet (new population array: New planet or a planet switch)
  // wipes the painted wreck and any effects still in flight.
  useEffect(() => {
    painter?.reset(textures?.night ?? null);
    effectsRef.current = [];
    setEffects([]);
    clearDeathLabels();
    laserAim.held = false;
    stopTicker.current?.();
    stopTicker.current = null;
    playCue("zapStop");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [populationRef]);
  const nextId = useRef(1);
  const shots = useRef(0);

  // Damage lands when an effect hits: hit the planet and paint the scar.
  const handleImpact = useCallback(
    (
      toolId: ToolId,
      u: number,
      v: number,
      _point: Vec3,
      opts?: ImpactOpts,
      fireId?: number
    ) => {
      // Effects still in flight once the planet is ending hit nothing.
      if (useGameStore.getState().phase !== "playing") return;
      const result = useGameStore
        .getState()
        .hit(toolId, u, v, undefined, fireId);
      // The ending's kill-everyone is not a hit, so it gets no label.
      const state = useGameStore.getState();
      if (shouldLabel(result, "playing")) {
        addDeathLabel(
          result.peopleLost,
          u,
          v,
          state.planet?.startPopulation ?? 0
        );
      }
      const tool = TOOLS[toolId];
      // The laser hums for as long as it is held, not once per tick.
      if (tool.mode !== "hold") {
        playCue(TOOL_CUES[toolId].impact, 0.5 + tool.power / 16);
      }
      const stamp = opts?.stamp ?? tool.stamp;
      if (stamp !== "none") {
        painter?.stamp(stamp, u, v, tool.radius, opts);
      }
    },
    [painter]
  );

  const handleEffectDone = useCallback((id: number) => {
    effectsRef.current = effectsRef.current.filter((e) => e.id !== id);
    setEffects((list) => list.filter((e) => e.id !== id));
  }, []);

  /** Starts a weapon effect; returns its id. */
  const spawn = useCallback((toolId: ToolId, u: number, v: number) => {
    const id = nextId.current++;
    if (toolId === "mothership") {
      // Mark it live now, before the next render (a second tap right behind).
      effectsRef.current = [
        ...effectsRef.current,
        { id, toolId, u, v, point: uvToDir(u, v), startedAt: 0 },
      ];
    }
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
    const launch = TOOL_CUES[toolId].launch;
    if (launch) playCue(launch);
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
      if (isLiveTool(effectsRef.current, toolId)) return;
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
      // Like a tap: nothing starts after an ending or for a locked tool.
      if (useGameStore.getState().phase !== "playing") return;
      const { progress } = useGameStore.getState();
      if (
        !isUnlocked(
          { kind: "tool", id: toolId },
          progress.points,
          progress.owned
        )
      )
        return;
      laserAim.owner = spawn(toolId, u, v);
      laserAim.held = true;
      laserAim.ticks = 0;
      aim(u, v, point);
      if (tryFire(toolId)) laserAim.ticks++;
      stopTicker.current?.();
      stopTicker.current = startLaserTicker(laserAim, () =>
        tryFire(useGameStore.getState().progress.toolId)
      );
    },
    [spawn, aim]
  );
  const holdMove = useCallback(
    (u: number, v: number, point: Vec3) => {
      if (!laserAim.held) return;
      aim(u, v, point);
    },
    [aim]
  );
  const holdEnd = useCallback(() => {
    laserAim.held = false;
    stopTicker.current?.();
    stopTicker.current = null;
    playCue("zapStop");
  }, []);

  // The test hook shoots without a cooldown. A hold tool fires a one-second
  // burst (eight ticks).
  const hookFire = useCallback(
    (toolId: ToolId, u: number, v: number) => {
      if (useGameStore.getState().phase !== "playing") return;
      if (isLiveTool(effectsRef.current, toolId)) return;
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
      if (hookTimer.current) clearInterval(hookTimer.current);
      const timer = (hookTimer.current = setInterval(() => {
        laserAim.ticks++;
        if (++n >= 8) {
          clearInterval(timer);
          laserAim.held = false;
          playCue("zapStop");
        }
      }, 125));
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
          <Hud
            left={
              <div className="flex flex-col items-start">
                <PlanetPicker />
                <TrophyShelf />
                <VersionLink />
              </div>
            }
            right={<SoundToggle />}
          />
          <DeathLabels />
          <TapHint />
          <ComboBadge />
          <Arsenal />
          <UnlockToast />
          <TrophyToast />
          <EndingOverlay />
        </>
      )}
    </div>
  );
}
