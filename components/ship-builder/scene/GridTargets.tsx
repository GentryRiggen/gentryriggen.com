"use client";

import { useMemo } from "react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  buildOccupancy,
  GRID_WIDTH,
  gridLength,
  MAX_LEVEL,
  topLevel,
} from "@/lib/ship-builder/model/grid";
import type { GridAnchor } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { sameAnchor, TAP_SLOP_PX } from "./anchors";
import { modelToWorld } from "./coords";
import { PALETTE } from "./palette";

export default function GridTargets() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const hoverAt = useShipBuilderStore((s) => s.hoverAt);
  const placeAt = useShipBuilderStore((s) => s.placeAt);

  const anchors = useMemo<GridAnchor[]>(() => {
    if (tool.kind !== "place" || getPartDef(tool.type).placement !== "grid") {
      return [];
    }
    const occupancy = buildOccupancy(ship);
    const list: GridAnchor[] = [];
    for (let x = 0; x < gridLength(ship); x++) {
      for (let z = 0; z < GRID_WIDTH; z++) {
        const level = topLevel(occupancy, x, z) + 1;
        if (level <= MAX_LEVEL) list.push({ kind: "grid", level, x, z });
      }
    }
    return list;
  }, [ship, tool]);

  const length = gridLength(ship);
  return (
    <group>
      {anchors.map((anchor) => {
        const [x, y, z] = modelToWorld(length, {
          x: anchor.x + 0.5,
          y: anchor.level,
          z: anchor.z + 0.5,
        });
        return (
          <mesh
            key={`${anchor.level}:${anchor.x}:${anchor.z}`}
            position={[x, y + 0.03, z]}
            onPointerOver={(event) => {
              event.stopPropagation();
              hoverAt(anchor);
            }}
            onPointerOut={() => {
              // Only clear our own hover, so a late pointerout from this
              // target can't wipe the hover a neighbour just set.
              const current = useShipBuilderStore.getState().hover;
              if (sameAnchor(current?.candidate.anchor, anchor)) hoverAt(null);
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (event.delta > TAP_SLOP_PX) return;
              const result = placeAt(anchor);
              // Touch has no hover, so show the red ghost and the reason.
              if (!result.ok) hoverAt(anchor);
            }}
          >
            <boxGeometry args={[0.94, 0.06, 0.94]} />
            <meshBasicMaterial
              color={PALETTE.gridTarget}
              transparent
              opacity={0.18}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
