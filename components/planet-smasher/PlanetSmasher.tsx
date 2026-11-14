"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import useWebGLSupport from "@/components/ship-builder/hooks/useWebGLSupport";
import { PLANETS } from "@/lib/planet-smasher/planets";
import { loadProgress } from "@/lib/planet-smasher/progress";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  TEST_HOOKS_ENABLED,
  installTestHooks,
} from "@/lib/planet-smasher/testHooks";
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

  useEffect(() => {
    if (!TEST_HOOKS_ENABLED) return;
    return installTestHooks();
  }, []);

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
        <Stage
          textures={textures}
          hasMoon={hasMoon}
          holdMode={false}
          onFire={(u, v) => useGameStore.getState().hit("asteroid", u, v)}
        />
      )}
    </div>
  );
}
