import type { Vec3 } from "@/lib/planet-smasher/sphere";
import type { ToolId } from "@/lib/planet-smasher/tools";

export interface ActiveEffect {
  id: number;
  toolId: ToolId;
  u: number;
  v: number;
  point: Vec3;
  startedAt: number;
}

export const MAX_EFFECTS = 12;

/** Extra stamp options (the earthquake picks its crack's direction). */
export interface ImpactOpts {
  angle?: number;
  length?: number;
}

export interface EffectProps {
  effect: ActiveEffect;
  planetRadius: number;
  onImpact(u: number, v: number, point: Vec3, opts?: ImpactOpts): void;
  onDone(): void;
}

/** Adds an effect to the list, dropping the oldest ones beyond the cap. */
export function pushEffect(
  list: ActiveEffect[],
  e: Omit<ActiveEffect, "id">,
  nextId: number
): ActiveEffect[] {
  const next = [...list, { ...e, id: nextId }];
  return next.length > MAX_EFFECTS
    ? next.slice(next.length - MAX_EFFECTS)
    : next;
}
