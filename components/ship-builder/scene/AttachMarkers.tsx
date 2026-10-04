"use client";

import { useEffect, useMemo } from "react";
import { MeshBasicMaterial, SphereGeometry } from "three";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { AttachAnchor } from "@/lib/ship-builder/model/types";
import { useCursor } from "@react-three/drei";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { isTap, sameAnchor } from "./anchors";
import { shouldSwallowClick } from "./clickGuard";
import { modelToWorld } from "./coords";
import { PALETTE } from "./palette";

/** One geometry and material shared by every marker. */
function createMarkerResources() {
  return {
    sphere: new SphereGeometry(0.16, 12, 12),
    material: new MeshBasicMaterial({ color: PALETTE.attachMarker }),
  };
}

export default function AttachMarkers() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const hoverAt = useShipBuilderStore((s) => s.hoverAt);
  const placeAt = useShipBuilderStore((s) => s.placeAt);
  const isMarkerHovered = useShipBuilderStore(
    (s) => s.hover?.candidate.anchor.kind === "attach"
  );
  useCursor(isMarkerHovered);

  const resources = useMemo(() => createMarkerResources(), []);
  useEffect(
    () => () => Object.values(resources).forEach((r) => r.dispose()),
    [resources]
  );

  const open = useMemo(() => {
    if (tool.kind !== "place") return [];
    const def = getPartDef(tool.type);
    return def.placement === "attach"
      ? analyzeShip(ship).openAttachPoints(def)
      : [];
  }, [ship, tool]);

  const length = gridLength(ship);
  const beam = beamOf(ship);
  return (
    <group>
      {open.map(({ parentId, point }) => {
        const anchor: AttachAnchor = {
          kind: "attach",
          parentId,
          pointId: point.id,
        };
        return (
          <mesh
            key={`${parentId}/${point.id}`}
            position={modelToWorld(length, beam, point.position)}
            geometry={resources.sphere}
            material={resources.material}
            onPointerOver={(event) => {
              event.stopPropagation();
              hoverAt(anchor);
            }}
            onPointerOut={() => {
              // Only clear our own hover, so a late pointerout from this
              // marker can't wipe the hover a neighbour just set.
              const current = useShipBuilderStore.getState().hover;
              if (sameAnchor(current?.candidate.anchor, anchor)) hoverAt(null);
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (shouldSwallowClick() || !isTap(event)) return;
              const result = placeAt(anchor);
              // Touch has no hover, so show the red ghost and the reason.
              if (!result.ok) hoverAt(anchor);
            }}
          />
        );
      })}
    </group>
  );
}
