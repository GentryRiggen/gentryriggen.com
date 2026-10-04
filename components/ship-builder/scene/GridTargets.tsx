"use client";

import { useEffect, useMemo } from "react";
import {
  DoubleSide,
  EdgesGeometry,
  LineBasicMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  buildOccupancy,
  GRID_WIDTH,
  gridLength,
  MAX_LEVEL,
  topLevel,
} from "@/lib/ship-builder/model/grid";
import type { GridAnchor } from "@/lib/ship-builder/model/types";
import { useCursor } from "@react-three/drei";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { isTap, sameAnchor } from "./anchors";
import { shouldSwallowClick } from "./clickGuard";
import { modelToWorld } from "./coords";
import { PALETTE } from "./palette";

/** Lifts targets just clear of the block top they sit on. */
const TARGET_LIFT = 0.03;
const TILE_SIZE = 0.9;

/**
 * One set of geometries and materials shared by every target, instead of a
 * geometry and material per cell (a 36-cell hull has 144 targets).
 */
function createTargetResources() {
  const tile = new PlaneGeometry(TILE_SIZE, TILE_SIZE).rotateX(-Math.PI / 2);
  const fill = { transparent: true, depthWrite: false };
  return {
    tile,
    edges: new EdgesGeometry(tile),
    // A full cell, so there are no dead strips between the visible tiles.
    hit: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    fill: new MeshBasicMaterial({
      ...fill,
      color: PALETTE.gridTargetFill,
      opacity: 0.3,
    }),
    hoverFill: new MeshBasicMaterial({
      ...fill,
      color: PALETTE.gridTargetFill,
      opacity: 0.6,
    }),
    line: new LineBasicMaterial({ color: PALETTE.gridTarget }),
    hoverLine: new LineBasicMaterial({ color: PALETTE.emphasis.hover }),
    hitMaterial: new MeshBasicMaterial({ side: DoubleSide }),
  };
}

export default function GridTargets() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const hoverAnchor = useShipBuilderStore(
    (s) => s.hover?.candidate.anchor ?? null
  );
  const hoverAt = useShipBuilderStore((s) => s.hoverAt);
  const placeAt = useShipBuilderStore((s) => s.placeAt);
  useCursor(hoverAnchor?.kind === "grid");

  const resources = useMemo(() => createTargetResources(), []);
  useEffect(
    () => () => Object.values(resources).forEach((r) => r.dispose()),
    [resources]
  );

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
        const isHovered = sameAnchor(hoverAnchor, anchor);
        return (
          <group
            key={`${anchor.level}:${anchor.x}:${anchor.z}`}
            position={[x, y + TARGET_LIFT, z]}
          >
            <mesh
              geometry={resources.tile}
              material={isHovered ? resources.hoverFill : resources.fill}
              renderOrder={1}
            />
            <lineSegments
              geometry={resources.edges}
              material={isHovered ? resources.hoverLine : resources.line}
              renderOrder={1}
            />
            {/* Three.js still raycasts invisible meshes. */}
            <mesh
              geometry={resources.hit}
              material={resources.hitMaterial}
              visible={false}
              onPointerOver={(event) => {
                event.stopPropagation();
                hoverAt(anchor);
              }}
              onPointerOut={() => {
                // Only clear our own hover, so a late pointerout from this
                // target can't wipe the hover a neighbour just set.
                const current = useShipBuilderStore.getState().hover;
                if (sameAnchor(current?.candidate.anchor, anchor)) {
                  hoverAt(null);
                }
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (shouldSwallowClick() || !isTap(event)) return;
                const result = placeAt(anchor);
                // Touch has no hover, so show the red ghost and the reason.
                if (!result.ok) hoverAt(anchor);
              }}
            />
          </group>
        );
      })}
    </group>
  );
}
