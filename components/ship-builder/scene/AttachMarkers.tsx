"use client";

import { useMemo } from "react";
import { openAttachPoints } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { gridLength } from "@/lib/ship-builder/model/grid";
import type { AttachAnchor } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { modelToWorld } from "./coords";
import { PALETTE } from "./palette";

export default function AttachMarkers() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const hoverAt = useShipBuilderStore((s) => s.hoverAt);
  const placeAt = useShipBuilderStore((s) => s.placeAt);

  const open = useMemo(() => {
    if (tool.kind !== "place") return [];
    const def = getPartDef(tool.type);
    return def.placement === "attach" ? openAttachPoints(ship, def) : [];
  }, [ship, tool]);

  const length = gridLength(ship);
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
            position={modelToWorld(length, point.position)}
            onPointerOver={(event) => {
              event.stopPropagation();
              hoverAt(anchor);
            }}
            onPointerOut={() => hoverAt(null)}
            onClick={(event) => {
              event.stopPropagation();
              placeAt(anchor);
            }}
          >
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial color={PALETTE.attachMarker} />
          </mesh>
        );
      })}
    </group>
  );
}
