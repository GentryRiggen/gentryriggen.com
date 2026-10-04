"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { holdClickGuard, releaseClickGuard } from "./clickGuard";
import { createLongPress } from "./longPress";

/** Where the hold ring sits, relative to the canvas wrapper. */
export interface RingState {
  x: number;
  y: number;
  /** Changes per press, so the ring remounts and its fill restarts. */
  key: number;
}

export interface PartPress {
  partId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
}

/**
 * Press-and-hold to delete. Window listeners feed the long-press machine, so
 * a hold is tracked even while OrbitControls captures the pointer. On fire it
 * selects the part and requests its deletion, exactly like the Delete button.
 */
export function usePartLongPress(wrapper: RefObject<HTMLElement | null>): {
  ring: RingState | null;
  startPress: (press: PartPress) => void;
} {
  const [ring, setRing] = useState<RingState | null>(null);
  const [machine] = useState(() =>
    createLongPress({
      onFire: (partId) => {
        setRing(null);
        holdClickGuard();
        const { select, requestDelete } = useShipBuilderStore.getState();
        select(partId);
        requestDelete();
      },
      onCancel: () => setRing(null),
    })
  );

  useEffect(() => {
    const handleDown = (event: PointerEvent) =>
      machine.pointerDown(event.pointerId, event.isPrimary);
    const handleMove = (event: PointerEvent) =>
      machine.move(event.pointerId, event.clientX, event.clientY);
    const handleUp = (event: PointerEvent) => {
      if (machine.end(event.pointerId) === "fired") releaseClickGuard();
    };
    const handleCancel = (event: PointerEvent) => {
      machine.cancel(event.pointerId);
      releaseClickGuard();
    };
    // Capture, so the machine counts a pointer before R3F starts a press.
    const options = { capture: true };
    window.addEventListener("pointerdown", handleDown, options);
    window.addEventListener("pointermove", handleMove, options);
    window.addEventListener("pointerup", handleUp, options);
    window.addEventListener("pointercancel", handleCancel, options);
    return () => {
      window.removeEventListener("pointerdown", handleDown, options);
      window.removeEventListener("pointermove", handleMove, options);
      window.removeEventListener("pointerup", handleUp, options);
      window.removeEventListener("pointercancel", handleCancel, options);
      machine.dispose();
    };
  }, [machine]);

  const startPress = useCallback(
    ({ partId, pointerId, clientX, clientY }: PartPress) => {
      if (!machine.start(partId, pointerId, clientX, clientY)) return;
      const rect = wrapper.current?.getBoundingClientRect();
      setRing((previous) => ({
        x: clientX - (rect?.left ?? 0),
        y: clientY - (rect?.top ?? 0),
        key: (previous?.key ?? 0) + 1,
      }));
    },
    [machine, wrapper]
  );

  return { ring, startPress };
}
