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

/** Field: rows of green under the sky. */
function FarmArt({ info }: { info: GrowSceneInfo }) {
  const rows = 3 + Math.min(info.helpers, 6);
  return (
    <g>
      <rect x="0" y="0" width="400" height="300" fill="#9fd8ff" />
      <rect x="0" y="130" width="400" height="170" fill="#6b8e3a" />
      {Array.from({ length: rows }, (_, i) => (
        <rect
          key={i}
          x="20"
          y={150 + i * 16}
          width="360"
          height="8"
          fill={i % 2 ? "#4f9a3a" : "#3f8a30"}
        />
      ))}
      {info.ended && (
        <rect x="290" y="70" width="70" height="60" fill="#b03a2e" />
      )}
    </g>
  );
}

/** Globe: a blue ball with patches of green that spread. */
function WorldArt({ info }: { info: GrowSceneInfo }) {
  const patches = 2 + Math.min(info.helpers, 8);
  return (
    <g>
      <rect x="0" y="0" width="400" height="300" fill="#07102a" />
      <circle cx="200" cy="150" r="110" fill="#2c6cc4" />
      {Array.from({ length: patches }, (_, i) => (
        <circle
          key={i}
          cx={150 + ((i * 47) % 100)}
          cy={110 + ((i * 31) % 80)}
          r={12 + (i % 3) * 4}
          fill="#4caf50"
        />
      ))}
      {info.ended && (
        <circle
          cx="200"
          cy="150"
          r="118"
          fill="none"
          stroke="#a5d6a7"
          strokeWidth="3"
        />
      )}
    </g>
  );
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
  farm: FarmArt,
  world: WorldArt,
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
