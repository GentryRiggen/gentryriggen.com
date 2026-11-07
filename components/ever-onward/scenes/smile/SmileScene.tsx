"use client";

import { memo, useState } from "react";
import { SMILE_MAP } from "@/lib/ever-onward/universes/smile/map";
import ArtifactLayer, { artifactKey } from "../ArtifactLayer";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  isSameSceneInfo,
  sceneInfo,
  type SmileSceneInfo,
} from "@/lib/ever-onward/universes/smile/scene";
import type { SmilePhaseId } from "@/lib/ever-onward/universes/smile/resources";
import { pixelClass } from "../../game/retro/retroStyles";
import type { LastBuy, SceneProps } from "../../universes/types";
import CaptionLine from "../CaptionLine";
import FriendLayer from "./FriendLayer";
import QuietLayer from "./QuietLayer";
import SceneCallout from "./SceneCallout";
import TownLayer from "./TownLayer";
import WorldLayer from "./WorldLayer";
import { captionFor, sceneLabelFor } from "./captions";

type Seen = Partial<Record<SmilePhaseId, SmileSceneInfo>>;

/**
 * Keeps the last info object while the numbers match, so the SVG skips
 * renders, and remembers the last picture of every part that was on show, so
 * a part that is not on show keeps its own picture (paused) behind the
 * current one.
 */
function useSeenInfo(run: RunState): { info: SmileSceneInfo; seen: Seen } {
  const info = sceneInfo(run);
  const [state, setState] = useState<{ info: SmileSceneInfo; seen: Seen }>({
    info,
    seen: { [info.phase]: info },
  });
  if (!isSameSceneInfo(state.info, info)) {
    const next = { info, seen: { ...state.seen, [info.phase]: info } };
    setState(next);
    return next;
  }
  return state;
}

const LAYERS: readonly (readonly [
  SmilePhaseId,
  (props: { info: SmileSceneInfo }) => React.JSX.Element,
])[] = [
  ["friend", FriendLayer],
  ["town", TownLayer],
  ["world", WorldLayer],
  ["quiet", QuietLayer],
];

const SmileSceneView = memo(function SmileSceneView({
  info,
  seen,
  lastBuy,
  testId,
  found,
  depth,
}: {
  info: SmileSceneInfo;
  seen: Seen;
  lastBuy: LastBuy | null;
  testId: string;
  found: string;
  depth: number;
}) {
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
        {LAYERS.map(([phase, Layer]) => {
          const layerInfo = seen[phase];
          if (!layerInfo) return null;
          const isOn = phase === info.phase;
          return (
            <g
              key={phase}
              data-layer={phase}
              aria-hidden={isOn ? undefined : "true"}
              className={
                isOn
                  ? "transition-opacity duration-[1200ms] motion-reduce:transition-none"
                  : "lm-paused opacity-0 transition-opacity duration-[1200ms] motion-reduce:transition-none"
              }
            >
              <Layer info={layerInfo} />
            </g>
          );
        })}
        <ArtifactLayer map={SMILE_MAP} found={found} depth={depth} />
        {lastBuy && <SceneCallout key={lastBuy.id} buy={lastBuy} info={info} />}
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

/** The Make Everyone Smile picture: one simple drawing per part. */
export default function SmileScene({
  run,
  lastBuy = null,
  testId = "lm-scene",
}: SceneProps) {
  const { info, seen } = useSeenInfo(run);
  return (
    <SmileSceneView
      info={info}
      seen={seen}
      lastBuy={lastBuy}
      testId={testId}
      found={artifactKey(run)}
      depth={run.mods.depth ?? 0}
    />
  );
}
