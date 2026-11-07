"use client";

import { memo, useEffect, useState } from "react";
import { HIGHER_MAP } from "@/lib/ever-onward/universes/higher/map";
import ArtifactLayer, { artifactKey } from "../ArtifactLayer";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  sceneInfo,
  type HigherSceneInfo,
} from "@/lib/ever-onward/universes/higher";
import { isSameSceneInfo } from "@/lib/ever-onward/universes/higher/scene";
import { PHASE_IDS } from "@/lib/ever-onward/universes/higher/resources";
import { pixelClass } from "../../game/retro/retroStyles";
import type { SceneProps } from "../../universes/types";
import CaptionLine from "../CaptionLine";
import { captionFor, sceneLabelFor } from "./captions";
import PlayroomLayer from "./PlayroomLayer";
import SkyLayer from "./SkyLayer";
import TopLayer from "./TopLayer";
import TownLayer from "./TownLayer";

/** How long an old layer stays drawn while the camera climbs away from it. */
const FADE_MS = 2200;

const sameProps = (
  a: { info: HigherSceneInfo },
  b: { info: HigherSceneInfo }
): boolean => isSameSceneInfo(a.info, b.info);

/** Layers in phase order; each is memoized on its quantized info. */
const LAYERS = [
  memo(PlayroomLayer, sameProps),
  memo(TownLayer, sameProps),
  memo(SkyLayer, sameProps),
  memo(TopLayer, sameProps),
] as const;

interface Visual {
  /** The layer that is faded in. */
  shown: number;
  /** The layer fading out, if any. */
  leaving: number | null;
}

/**
 * The run changes ten times a second but the picture only needs the few
 * numbers in `sceneInfo`; hand back the previous object while they match so
 * the memoized layers skip rendering.
 */
function useStableInfo(run: RunState): HigherSceneInfo {
  const info = sceneInfo(run);
  const [stable, setStable] = useState(info);
  if (!isSameSceneInfo(stable, info)) {
    setStable(info);
    return info;
  }
  return stable;
}

const HigherSceneView = memo(function HigherSceneView({
  info,
  testId,
  found,
  depth,
}: {
  info: HigherSceneInfo;
  testId: string;
  found: string;
  depth: number;
}) {
  const target = Math.max(0, PHASE_IDS.indexOf(info.phase));
  const [visual, setVisual] = useState<Visual>({
    shown: target,
    leaving: null,
  });

  useEffect(() => {
    if (visual.shown === target) return;
    // Two frames so the new layer mounts hidden first, then slides in.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() =>
        setVisual({ shown: target, leaving: visual.shown })
      );
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [target, visual.shown]);

  useEffect(() => {
    if (visual.leaving === null) return;
    const timer = window.setTimeout(
      () => setVisual((v) => ({ ...v, leaving: null })),
      FADE_MS
    );
    return () => window.clearTimeout(timer);
  }, [visual.leaving]);

  // A layer that is leaving keeps the picture it last had, not the new part's.
  const [kept, setKept] = useState<Record<number, HigherSceneInfo>>({
    [target]: info,
  });
  if (kept[target] !== info) setKept({ ...kept, [target]: info });

  const drawn = new Set([target, visual.shown, visual.leaving]);

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 400 300"
        role="img"
        aria-label={sceneLabelFor(info)}
        data-testid={testId}
        data-phase={info.phase}
        overflow="visible"
        className="block h-full w-full"
      >
        {LAYERS.map((Layer, index) => {
          if (!drawn.has(index)) return null;
          const isShown = index === visual.shown;
          const state = isShown
            ? "opacity-100 translate-y-0"
            : index < visual.shown
              ? "opacity-0 translate-y-16"
              : "opacity-0 -translate-y-16";
          return (
            <g
              key={index}
              className={`transition-[opacity,translate] duration-[2000ms] ease-in-out motion-reduce:transition-none ${state} ${isShown ? "" : "lm-paused"}`}
            >
              <Layer info={kept[index] ?? info} />
            </g>
          );
        })}
        <ArtifactLayer map={HIGHER_MAP} found={found} depth={depth} />
      </svg>
      <p
        aria-hidden="true"
        data-testid="lm-scene-caption"
        className={`${pixelClass} pointer-events-none absolute bottom-0 left-0 max-w-full truncate bg-black/65 px-2 py-1.5 text-[10px] leading-none text-amber-100 lg:text-xs`}
      >
        <CaptionLine text={captionFor(info)} />
      </p>
    </div>
  );
});

/** The Build It Higher picture: one living layer per phase. */
export default function HigherScene({ run, testId = "lm-scene" }: SceneProps) {
  return (
    <HigherSceneView
      info={useStableInfo(run)}
      testId={testId}
      found={artifactKey(run)}
      depth={run.mods.depth ?? 0}
    />
  );
}
