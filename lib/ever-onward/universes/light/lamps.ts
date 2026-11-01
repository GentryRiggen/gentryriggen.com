import type { ActionDef } from "../../engine/types";
import { PHASE_NIGHT } from "./resources";
import { isLampsOpen, lampStep, setLamps } from "./tick";

/**
 * The streetlights: No More Night's one knob, how bright the cities shine.
 * Brighter pays more for every megawatt, but the grid strains harder, each
 * town wants a little more power and the busy crews learn less. Softer pays
 * less, eases the grid, lights more towns with the same plants and gives the
 * crews time to learn (know-how for projects). No step loses anything: the
 * right one changes as the night goes (soft while saving up for a project,
 * dazzling while building, soft again to light the last towns).
 */

export const LAMP_STEPS = [
  {
    label: "Soft glow",
    note: "Pays 80% · crews learn 60% faster · towns want 12% less · the grid strains 30% less",
  },
  {
    label: "Gentle",
    note: "Pays 90% · crews learn 30% faster · towns want 6% less · the grid strains 15% less",
  },
  { label: "Bright", note: "The usual: pays 100%" },
  {
    label: "Dazzling",
    note: "Pays 115% · crews learn 40% slower · towns want 6% more · the grid strains 30% more",
  },
] as const;

export const lampActionId = (step: number): string => `streetlights-${step}`;
export const LAMP_ACTION_IDS: readonly string[] = LAMP_STEPS.map((_, i) =>
  lampActionId(i)
);

/** One radio button per step; the streetlights panel draws them itself. */
export const LAMP_ACTIONS: readonly ActionDef[] = LAMP_STEPS.map((step, i) => ({
  id: lampActionId(i),
  phases: [PHASE_NIGHT],
  isInline: true,
  visibleWhen: isLampsOpen,
  describe: (run) => ({
    label: step.label,
    detail: step.note,
    isBlocked: lampStep(run) === i,
  }),
  perform: (run) => setLamps(run, i),
}));
