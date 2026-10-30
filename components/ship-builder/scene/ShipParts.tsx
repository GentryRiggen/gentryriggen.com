"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Group, Object3D } from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import type { Ship } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { isTap } from "./anchors";
import { launchedIdsAt } from "./crowdView";
import { fallenIdsAt, funnelDependents, hiddenByFalls } from "./funnelFallView";
import { GlowContext, type GlowController } from "./GlowContext";
import { shouldSwallowClick } from "./clickGuard";
import PartMesh from "./PartMesh";
import PopIn from "./PopIn";
import { singleAddedId } from "./pop";
import { useShipHalf } from "./shipHalf";
import { activeEvacuation } from "./trialTimeline";
import { trialPlayback } from "./trialPlayback";
import type { PartPress } from "./usePartLongPress";
import { useStaticBatch } from "./useStaticBatch";

/** The part a handler fired for; PartMesh tags its group with the id. */
function partIdOf(event: { eventObject: Object3D }): string | null {
  const id: unknown = event.eventObject.userData.partId;
  return typeof id === "string" ? id : null;
}

interface ShipPartsProps {
  /** The eased glow every lit part follows. */
  glow: GlowController;
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

/**
 * The part the player just placed, for its pop-in. Parts present on mount and
 * batches (a loaded ship, undo or redo of several) yield null.
 */
function usePoppingPartId(parts: Ship["parts"]): string | null {
  const [seen, setSeen] = useState({ parts, poppingId: null as string | null });
  if (seen.parts === parts) return seen.poppingId;
  const poppingId = singleAddedId(seen.parts, parts);
  setSeen({ parts, poppingId });
  return poppingId;
}

/** No launches: a trial she survives, or none on. */
const NO_LAUNCHES: readonly { boatId: string; at: number }[] = [];

/**
 * Hides a funnel once it has snapped off in a sinking (`FallingFunnels` draws
 * it falling), with anything hung from or strung to it, and a lifeboat once
 * it lowers away (`LaunchedBoats` draws it). It follows the playback clock
 * each frame, so scrubbing back puts them all back.
 */
function useHideGoneParts(
  ship: Ship,
  occupancy: ReturnType<typeof analyzeShip>["occupancy"]
): (partId: string, group: Group | null) => void {
  const groups = useRef(new Map<string, Group>());
  const dependents = useMemo(
    () => funnelDependents(ship, occupancy),
    [ship, occupancy]
  );
  // How many funnels and boats were gone at the last pass (-1: apply again).
  // Both only grow with time, so the counts say which are gone; the sets are
  // only rebuilt when one changes, not every frame.
  const applied = useRef(0);
  const lastDependents = useRef(dependents);
  const lastLaunches = useRef(NO_LAUNCHES);
  useFrame(() => {
    const { funnelFalls, time } = trialPlayback;
    const launches = activeEvacuation()?.launches ?? NO_LAUNCHES;
    let gone = 0;
    for (const fall of funnelFalls) if (fall.at <= time) gone++;
    let launched = 0;
    for (const launch of launches) if (launch.at <= time) launched++;
    if (
      lastDependents.current !== dependents ||
      lastLaunches.current !== launches
    ) {
      lastDependents.current = dependents;
      lastLaunches.current = launches;
      applied.current = -1;
    }
    const key = gone * 4096 + launched;
    if (key === applied.current) return;
    applied.current = key;
    const hidden = hiddenByFalls(dependents, fallenIdsAt(funnelFalls, time));
    for (const id of launchedIdsAt(launches, time)) hidden.add(id);
    for (const [id, group] of groups.current) group.visible = !hidden.has(id);
  });
  return useCallback((partId: string, group: Group | null) => {
    if (group) {
      groups.current.set(partId, group);
      // A part that mounts mid-trial is shown or hidden on the next frame.
      applied.current = -1;
    } else groups.current.delete(partId);
  }, []);
}

export default function ShipParts({ glow, onPartPress }: ShipPartsProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const pendingRemoval = useShipBuilderStore((s) => s.pendingRemoval);
  const select = useShipBuilderStore((s) => s.select);
  const paintPart = useShipBuilderStore((s) => s.paintPart);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // One half of a broken ship draws only the parts that go with it.
  const half = useShipHalf();
  const parts = half
    ? ship.parts.filter((part) => half.includesPart(part.id))
    : ship.parts;

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

  const occupancy = useMemo(() => analyzeShip(ship).occupancy, [ship]);
  const poppingId = usePoppingPartId(ship.parts);
  const registerPart = useHideGoneParts(ship, occupancy);

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
  // In paint mode a tap paints the part. Pointer-over still swallows so the
  // part occludes the hull behind it, and the press can become a hold-delete.
  const paintHandlers = useMemo(
    () => ({
      ...occludeHandlers,
      onClick: (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        if (shouldSwallowClick() || !isTap(event)) return;
        const id = partIdOf(event);
        if (id) paintPart(id);
      },
    }),
    [occludeHandlers, paintPart]
  );
  const handlers =
    tool.kind === "paint"
      ? paintHandlers
      : interactive
        ? selectHandlers
        : occludeHandlers;

  const removing = new Set(pendingRemoval?.ids ?? []);

  // Plain parts are merged into a few draw calls; see PartBatcher.
  const root = useRef<Group>(null);
  useStaticBatch(root, ship);

  return (
    <GlowContext.Provider value={glow}>
      <group ref={root}>
        {parts.map((part) => (
          <group key={part.id} ref={(group) => registerPart(part.id, group)}>
            <PopIn active={part.id === poppingId}>
              <PartMesh
                ship={ship}
                occupancy={occupancy}
                part={part}
                color={part.color}
                mark={part.mark}
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
            </PopIn>
          </group>
        ))}
      </group>
    </GlowContext.Provider>
  );
}
