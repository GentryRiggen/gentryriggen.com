"use client";

import { useState } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import PartMesh from "./PartMesh";

export default function ShipParts() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const pendingRemoval = useShipBuilderStore((s) => s.pendingRemoval);
  const select = useShipBuilderStore((s) => s.select);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Parts only take pointer events with no tool active, so they never steal
  // clicks from grid targets or attach markers.
  const interactive = tool.kind === "none";
  const removing = new Set(pendingRemoval?.ids ?? []);

  return (
    <group>
      {ship.parts.map((part) => (
        <PartMesh
          key={part.id}
          ship={ship}
          part={part}
          tint={removing.has(part.id) ? "removal" : null}
          emphasis={
            selectedId === part.id
              ? "selected"
              : interactive && hoveredId === part.id
                ? "hover"
                : null
          }
          {...(interactive && {
            onPointerOver: (event) => {
              event.stopPropagation();
              setHoveredId(part.id);
            },
            onPointerOut: () =>
              setHoveredId((current) => (current === part.id ? null : current)),
            onClick: (event) => {
              event.stopPropagation();
              select(part.id);
            },
          })}
        />
      ))}
    </group>
  );
}
