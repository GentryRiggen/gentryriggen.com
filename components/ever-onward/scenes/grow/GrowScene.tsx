"use client";

import { memo, useState } from "react";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  isSameSceneInfo,
  sceneInfo,
  type GrowSceneInfo,
} from "@/lib/ever-onward/universes/grow/scene";
import { pixelClass } from "../../game/retro/retroStyles";
import type { LastBuy, SceneProps } from "../../universes/types";
import SceneCallout from "./SceneCallout";
import FarmLayer from "./FarmLayer";
import WorldLayer from "./WorldLayer";
import SeedLayer from "./SeedLayer";
import YardLayer from "./YardLayer";
import { SCENE_LABELS, captionFor } from "./captions";

/** Keeps the last info object while the numbers match, so the SVG skips renders. */
function useStableInfo(run: RunState): GrowSceneInfo {
  const info = sceneInfo(run);
  const [stable, setStable] = useState(info);
  if (!isSameSceneInfo(stable, info)) {
    setStable(info);
    return info;
  }
  return stable;
}

const ART = {
  yard: YardLayer,
  farm: FarmLayer,
  world: WorldLayer,
  seed: SeedLayer,
} as const;

const GrowSceneView = memo(function GrowSceneView({
  info,
  lastBuy,
}: {
  info: GrowSceneInfo;
  lastBuy: LastBuy | null;
}) {
  const Art = ART[info.phase];
  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={info.phase === "seed" ? "0 6 400 228" : "0 0 400 300"}
        role="img"
        aria-label={SCENE_LABELS[info.phase]}
        data-testid="lm-scene"
        data-phase={info.phase}
        overflow="visible"
        className="block h-full w-full"
      >
        <Art info={info} />
        {lastBuy && <SceneCallout key={lastBuy.id} buy={lastBuy} info={info} />}
      </svg>
      <p
        aria-hidden="true"
        data-testid="lm-scene-caption"
        className={`${pixelClass} pointer-events-none absolute bottom-0 left-0 max-w-full truncate bg-black/65 px-2 py-1.5 text-[9px] leading-none text-lime-100 sm:text-[10px] lg:text-xs`}
      >
        {captionFor(info)}
      </p>
    </div>
  );
});

/** The Make It Grow picture: one simple drawing per phase. */
export default function GrowScene({ run, lastBuy = null }: SceneProps) {
  return <GrowSceneView info={useStableInfo(run)} lastBuy={lastBuy} />;
}
