import type { Anchor } from "@/lib/ship-builder/model/types";

/**
 * Pointer travel (in CSS pixels) beyond which a press counts as an orbit drag
 * rather than a tap. R3F still fires onClick after a drag that started and
 * ended on the same object, so click handlers check `isTap` instead. Fingers
 * wobble more than a mouse, hence the larger touch allowance.
 */
export const TAP_SLOP_PX = 4;
export const TOUCH_TAP_SLOP_PX = 10;

interface TapEvent {
  delta: number;
  pointerType?: string;
  /** R3F click events carry the pointer type on the DOM event. */
  nativeEvent?: object;
}

function pointerTypeOf(event: TapEvent): string | undefined {
  if (event.pointerType) return event.pointerType;
  const native = event.nativeEvent;
  if (native && "pointerType" in native) {
    return typeof native.pointerType === "string"
      ? native.pointerType
      : undefined;
  }
  return undefined;
}

/** True when the pointer moved little enough for the press to be a tap. */
export function isTap(event: TapEvent): boolean {
  const slop =
    pointerTypeOf(event) === "touch" ? TOUCH_TAP_SLOP_PX : TAP_SLOP_PX;
  return event.delta <= slop;
}

/** Structural equality for anchors: same kind and the same fields. */
export function sameAnchor(
  a: Anchor | null | undefined,
  b: Anchor | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a.kind === "grid" && b.kind === "grid") {
    return a.level === b.level && a.x === b.x && a.z === b.z;
  }
  if (a.kind === "attach" && b.kind === "attach") {
    return a.parentId === b.parentId && a.pointId === b.pointId;
  }
  return false;
}
