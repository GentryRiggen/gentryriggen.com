import { memo } from "react";
import type { MapDef, RunState } from "@/lib/ever-onward/engine/types";
import { spriteRects } from "@/lib/ever-onward/start/sprites";

/** The run's switched-on artifacts as one stable string (for memo). */
export function artifactKey(run: RunState): string {
  return Object.keys(run.flags)
    .filter((k) => k.startsWith("art:") && run.flags[k])
    .map((k) => k.slice(4))
    .sort()
    .join("|");
}

interface ArtifactLayerProps {
  /** The universe's map (nothing is drawn without one). */
  map: MapDef | undefined;
  /** `artifactKey` of the run. */
  found: string;
  /** The map row the run is played on: deeper rows tint the scene. */
  depth: number;
}

/**
 * What the map has given this run, drawn in the scene (400 x 300): each
 * artifact floats at its own spot in every part, walkers stroll across, and
 * the deeper the square, the stronger the universe's dream tint.
 */
function ArtifactLayer({ map, found, depth }: ArtifactLayerProps) {
  if (!map) return null;
  const ids = new Set(found ? found.split("|") : []);
  const shown = map.artifacts.filter((a) => ids.has(a.id));
  return (
    <g
      data-testid="eo-artifacts"
      data-found={shown.length}
      pointerEvents="none"
    >
      {depth > 0 && (
        <rect
          data-testid="eo-dream-tint"
          x="-20"
          y="-20"
          width="440"
          height="340"
          fill={map.tint}
          opacity={Math.min(0.35, depth * 0.05)}
        />
      )}
      {shown.map((a, i) => {
        const { spot } = a;
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
        const place = `translate(${spot.x} ${spot.y}) scale(${spot.scale})`;
        if (spot.walk) {
          return (
            <g key={a.id} className="eo-art-ghost" opacity="0.8">
              <g transform={place} shapeRendering="crispEdges">
                {art}
              </g>
            </g>
          );
        }
        return (
          <g key={a.id} transform={place}>
            <g className="eo-art-new">
              <circle cx="6" cy="6" r="9" fill="#fff3b0" opacity="0.18" />
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
