"use client";

import { useCallback, useMemo, useState } from "react";
import type { Object3D } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { buildOccupancy } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { shouldSwallowClick } from "./clickGuard";
import PartMesh from "./PartMesh";
import type { PartPress } from "./usePartLongPress";

/** The part a handler fired for; PartMesh tags its group with the id. */
function partIdOf(event: { eventObject: Object3D }): string | null {
  const id: unknown = event.eventObject.userData.partId;
  return typeof id === "string" ? id : null;
}

interface ShipPartsProps {
  /** A primary press on a part, which may become a press-and-hold delete. */
  onPartPress: (press: PartPress) => void;
}

/**
 * Only a plain primary press can become a hold: right-drag and Shift/Ctrl/Meta
 * + drag pan the camera instead.
 */
function isHoldCandidate(event: ThreeEvent<PointerEvent>): boolean {
  return (
    event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey
  );
}

export default function ShipParts({ onPartPress }: ShipPartsProps) {
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
  useCursor(interactive && ship.parts.some((part) => part.id === hoveredId));

  const occupancy = useMemo(() => buildOccupancy(ship), [ship]);

  // Press-and-hold deletes with or without an active tool.
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const partId = partIdOf(event);
      if (!partId || !isHoldCandidate(event)) return;
      onPartPress({
        partId,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [onPartPress]
  );

  // With a tool active, parts still catch pointer events but only to swallow
  // them, so a block occludes the grid targets and markers behind it. R3F
  // skips objects without handlers when raycasting, which would let a tap go
  // through.
  const occludeHandlers = useMemo(
    () => ({
      onPointerOver: (event: ThreeEvent<PointerEvent>) =>
        event.stopPropagation(),
      onPointerDown: handlePointerDown,
      onClick: (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        shouldSwallowClick();
      },
    }),
    [handlePointerDown]
  );

  // One stable set of handlers for every part, so a hover or selection change
  // only re-renders the (memoized) parts whose tint or emphasis changed.
  const selectHandlers = useMemo(
    () => ({
      onPointerOver: (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        const id = partIdOf(event);
        if (id) setHoveredId(id);
      },
      onPointerOut: (event: ThreeEvent<PointerEvent>) => {
        const id = partIdOf(event);
        setHoveredId((current) => (current === id ? null : current));
      },
      onPointerDown: handlePointerDown,
      onClick: (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        if (shouldSwallowClick()) return;
        const id = partIdOf(event);
        if (id) select(id);
      },
    }),
    [select, handlePointerDown]
  );
  const handlers = interactive ? selectHandlers : occludeHandlers;

  const removing = new Set(pendingRemoval?.ids ?? []);

  return (
    <group>
      {ship.parts.map((part) => (
        <PartMesh
          key={part.id}
          ship={ship}
          occupancy={occupancy}
          part={part}
          partId={part.id}
          tint={removing.has(part.id) ? "removal" : null}
          emphasis={
            selectedId === part.id
              ? "selected"
              : interactive && hoveredId === part.id
                ? "hover"
                : null
          }
          {...handlers}
        />
      ))}
    </group>
  );
}
