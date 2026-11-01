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

/** One pot, and a shoot as tall as the growth. */
function SeedArt({ info }: { info: GrowSceneInfo }) {
  const height = 20 + info.growth * 1.4;
  return (
    <g>
      <rect x="0" y="0" width="400" height="300" fill="#fff1d6" />
      <rect x="0" y="230" width="400" height="70" fill="#b5835a" />
      <rect x="160" y="190" width="80" height="60" fill="#c1623a" />
      <rect x="152" y="184" width="96" height="14" fill="#d9774a" />
      <rect x="196" y={184 - height} width="8" height={height} fill="#3f9d3a" />
      <ellipse cx="184" cy={190 - height} rx="16" ry="8" fill="#58bf4f" />
      <ellipse cx="216" cy={184 - height} rx="16" ry="8" fill="#58bf4f" />
    </g>
  );
}

const ART = {
  yard: YardLayer,
  farm: FarmLayer,
  world: WorldLayer,
  seed: SeedArt,
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
        viewBox="0 0 400 300"
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
