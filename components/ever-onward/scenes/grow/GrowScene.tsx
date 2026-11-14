"use client";

import { memo, useEffect, useRef, useState } from "react";
import { GROW_MAP } from "@/lib/ever-onward/universes/grow/map";
import ArtifactLayer, { artifactKey } from "../ArtifactLayer";
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
import { captionFor, sceneLabelFor } from "./captions";
import CaptionLine from "../CaptionLine";

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

/** The seed scene's shape; a strip wider than this is a phone lying flat on its pane. */
const SEED_ASPECT = 320 / 228;
const SEED_CROP_ASPECT = 1.6;

/**
 * True while the scene's box is a wide, short strip (a phone), so the seed
 * window can fill it, cropping a little off the top and bottom, instead of
 * sitting small in the middle with empty sides.
 */
function useWideStrip(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setIsWide(height > 0 && width / height >= SEED_CROP_ASPECT);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return [ref, isWide && SEED_CROP_ASPECT > SEED_ASPECT];
}

const GrowSceneView = memo(function GrowSceneView({
  info,
  lastBuy,
  testId,
  found,
  depth,
}: {
  info: GrowSceneInfo;
  lastBuy: LastBuy | null;
  testId: string;
  found: string;
  depth: number;
}) {
  const Art = ART[info.phase];
  const [boxRef, isStrip] = useWideStrip();
  return (
    <div ref={boxRef} className="relative h-full w-full">
      <svg
        viewBox={info.phase === "seed" ? "40 6 320 228" : "0 0 400 300"}
        preserveAspectRatio={
          info.phase === "seed" && isStrip ? "xMidYMid slice" : undefined
        }
        data-fill={info.phase === "seed" && isStrip ? "strip" : undefined}
        role="img"
        aria-label={sceneLabelFor(info)}
        data-testid={testId}
        data-phase={info.phase}
        overflow="visible"
        className="block h-full w-full"
      >
        <Art info={info} />
        <ArtifactLayer map={GROW_MAP} found={found} depth={depth} />
        {lastBuy && <SceneCallout key={lastBuy.id} buy={lastBuy} info={info} />}
      </svg>
      <p
        aria-hidden="true"
        data-testid="lm-scene-caption"
        className={`${pixelClass} pointer-events-none absolute bottom-0 left-0 max-w-full truncate bg-black/65 px-2 py-1.5 text-[10px] leading-none text-lime-100 lg:text-xs`}
      >
        <CaptionLine text={captionFor(info)} />
      </p>
    </div>
  );
});

/** The Make It Grow picture: one simple drawing per phase. */
export default function GrowScene({
  run,
  lastBuy = null,
  testId = "lm-scene",
}: SceneProps) {
  return (
    <GrowSceneView
      info={useStableInfo(run)}
      lastBuy={lastBuy}
      testId={testId}
      found={artifactKey(run)}
      depth={run.mods.depth ?? 0}
    />
  );
}
