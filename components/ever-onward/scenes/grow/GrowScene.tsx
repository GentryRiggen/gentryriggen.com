"use client";

import { memo, useState } from "react";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  isSameSceneInfo,
  sceneInfo,
  type GrowSceneInfo,
} from "@/lib/ever-onward/universes/grow/scene";
import { pixelClass } from "../../game/retro/retroStyles";
import type { SceneProps } from "../../universes/types";
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

/** Window box: sill, box, soil and a seedling in a pot. */
function YardArt({ info }: { info: GrowSceneInfo }) {
  return (
    <g>
      <rect x="0" y="0" width="400" height="300" fill="#bde6ff" />
      <rect x="60" y="30" width="280" height="170" fill="#e6f6ff" />
      <rect x="0" y="200" width="400" height="100" fill="#8b5e34" />
      <rect x="110" y="170" width="180" height="36" fill="#a0522d" />
      <rect x="110" y="170" width="180" height="10" fill="#5a3a1a" />
      <rect
        x="196"
        y={150 - info.scaling * 4}
        width="8"
        height="26"
        fill="#3f9d3a"
      />
      <ellipse
        cx="190"
        cy={150 - info.scaling * 4}
        rx="12"
        ry="6"
        fill="#58bf4f"
      />
      <ellipse
        cx="210"
        cy={146 - info.scaling * 4}
        rx="12"
        ry="6"
        fill="#58bf4f"
      />
      {Array.from({ length: Math.min(info.helpers, 8) }, (_, i) => (
        <circle key={i} cx={120 + i * 22} cy="130" r="4" fill="#4aa8ff" />
      ))}
      {info.ended && (
        <rect
          x="100"
          y="120"
          width="200"
          height="50"
          fill="#9ad7ff"
          opacity="0.4"
        />
      )}
    </g>
  );
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
  yard: YardArt,
  farm: FarmArt,
  world: WorldArt,
  seed: SeedArt,
} as const;

const GrowSceneView = memo(function GrowSceneView({
  info,
}: {
  info: GrowSceneInfo;
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
export default function GrowScene({ run }: SceneProps) {
  return <GrowSceneView info={useStableInfo(run)} />;
}
