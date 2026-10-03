import type { Anchor } from "@/lib/ship-builder/model/types";

/**
 * Pointer travel (in CSS pixels) beyond which a press counts as an orbit drag
 * rather than a tap. R3F still fires onClick after a drag that started and
 * ended on the same object, so click handlers check `event.delta` against it.
 */
export const TAP_SLOP_PX = 2;

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
