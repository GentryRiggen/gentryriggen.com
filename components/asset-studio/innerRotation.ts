import type { PartType } from "@/lib/ship-builder/model/types";
import { FUNNEL_RAKE_RADIANS } from "@/components/ship-builder/scene/effectAnchors";

/**
 * Parts whose own mesh code tilts the whole part about Z (a funnel's rake).
 * The studio turns the tilt back out before it reads bounds, so specs hold the
 * upright box, and `assets:measure` writes the angle as the spec's
 * `rakeRadians` (the renders apply it again, as the game does).
 *
 * Add a part here when its mesh code wraps everything in a rotated group.
 * `__tests__/innerRotation.test.ts` fails if a scene file starts using the
 * rake without being listed.
 */
export const INNER_ROTATION: Partial<Record<PartType, number>> = {
  funnel: FUNNEL_RAKE_RADIANS,
  "funnel-large": FUNNEL_RAKE_RADIANS,
  "funnel-modern": FUNNEL_RAKE_RADIANS,
};
