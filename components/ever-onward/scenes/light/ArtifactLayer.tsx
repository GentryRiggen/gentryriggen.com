import { memo } from "react";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { spriteRects } from "@/lib/ever-onward/start/sprites";
import {
  ARTIFACT_SPOTS,
  LIGHT_ARTIFACTS,
} from "@/lib/ever-onward/universes/light/map";

/** The run's switched-on artifacts as one stable string (for memo). */
export function artifactKey(run: RunState): string {
  return Object.keys(run.flags)
    .filter((k) => k.startsWith("art:") && run.flags[k])
    .map((k) => k.slice(4))
    .sort()
    .join("|");
}

interface ArtifactLayerProps {
  /** `artifactKey` of the run. */
  found: string;
  /** The map row the run is played on: deeper rows dream in violet. */
  depth: number;
}

/**
 * What the map has given this run, drawn in the scene: each artifact floats
 * at its own spot in every part, the Ghost Keeper walks the shore, and the
 * deeper the square, the more violet the dream.
 */
function ArtifactLayer({ found, depth }: ArtifactLayerProps) {
  const ids = new Set(found ? found.split("|") : []);
  const shown = LIGHT_ARTIFACTS.filter((a) => ids.has(a.id));
  return (
    <g
      data-testid="lm-artifacts"
      data-found={shown.length}
      pointerEvents="none"
    >
      {depth > 0 && (
        <rect
          data-testid="lm-dream-tint"
          x="-20"
          y="-20"
          width="440"
          height="340"
          fill="#7c3aed"
          opacity={Math.min(0.35, depth * 0.05)}
        />
      )}
      {shown.map((a, i) => {
        const spot = ARTIFACT_SPOTS[a.id];
        const art = spriteRects(a.glyph, a.palette).map((r, j) => (
          <rect
            key={j}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={r.fill}
          />
        ));
        if (a.id === "ghost-keeper") {
          return (
            <g key={a.id} className="eo-art-ghost" opacity="0.75">
              <g
                transform={`translate(${spot.x} ${spot.y}) scale(${spot.scale})`}
              >
                {art}
              </g>
            </g>
          );
        }
        return (
          <g
            key={a.id}
            transform={`translate(${spot.x} ${spot.y}) scale(${spot.scale})`}
          >
            <g className="eo-art-new">
              <circle cx="6" cy="6" r="9" fill="url(#lm-lamp)" opacity="0.55" />
              <g
                className={`eo-art-float ${i % 2 ? "[animation-delay:-2.5s]" : ""}`}
                shapeRendering="crispEdges"
              >
                {art}
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}

export default memo(ArtifactLayer);
