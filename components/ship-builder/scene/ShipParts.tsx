"use client";

import { useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import PartMesh from "./PartMesh";

/**
 * With a tool active, parts still catch pointer events but only to swallow
 * them, so a block occludes the grid targets and markers behind it. R3F skips
 * objects without handlers when raycasting, which would let a tap go through.
 */
const OCCLUDE_HANDLERS = {
  onPointerOver: (event: ThreeEvent<PointerEvent>) => event.stopPropagation(),
  onClick: (event: ThreeEvent<MouseEvent>) => event.stopPropagation(),
};

export default function ShipParts() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const pendingRemoval = useShipBuilderStore((s) => s.pendingRemoval);
  const select = useShipBuilderStore((s) => s.select);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Parts are only selectable with no tool active.
  const interactive = tool.kind === "none";

  // Leaving select mode drops the hover, so a part doesn't come back
  // highlighted after a tool round-trip (adjusting state during render).
  const [wasInteractive, setWasInteractive] = useState(interactive);
  if (wasInteractive !== interactive) {
    setWasInteractive(interactive);
    if (!interactive) setHoveredId(null);
  }

  const removing = new Set(pendingRemoval?.ids ?? []);

  const selectHandlers = (id: string) => ({
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHoveredId(id);
    },
    onPointerOut: () =>
      setHoveredId((current) => (current === id ? null : current)),
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      select(id);
    },
  });

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
          {...(interactive ? selectHandlers(part.id) : OCCLUDE_HANDLERS)}
        />
      ))}
    </group>
  );
}
