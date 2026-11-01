import type { ActionDef } from "../../engine/types";
import { PHASE_NIGHT } from "./resources";
import { isLampsOpen, lampStep, setLamps } from "./tick";
import { TUNING } from "./tuning";

/**
 * The streetlights: No More Night's one knob, how bright the cities shine.
 * Brighter pays more for every megawatt, but the grid strains harder, each
 * town wants a little more power and the busy crews learn less. Softer pays
 * less, eases the grid, lights more towns with the same plants and gives the
 * crews time to learn (know-how for projects). No step loses anything: the
 * right one changes as the night goes (soft while saving up for a project,
 * dazzling while building, soft again to light the last towns).
 */

const LABELS = ["Soft glow", "Gentle", "Bright", "Dazzling"] as const;

const pct = (n: number): string => `${Math.round(n * 100)}%`;
/** "30% less" / "35% more" against Bright (1). */
const change = (n: number, less: string, more: string): string =>
  n < 1 ? `${pct(1 - n)} ${less}` : `${pct(n - 1)} ${more}`;
/** "2.5x as fast" / "a quarter as fast": how fast crews learn. */
const learn = (n: number): string =>
  n >= 1
    ? `crews learn ${Number(n.toFixed(2))}x as fast`
    : `crews learn ${pct(n)} as fast`;

/** One plain line per step, read from the tuning so it can't drift. */
export function lampNote(step: number): string {
  const s = TUNING.lamps.steps[step];
  if (step === TUNING.lamps.defaultStep) return `The usual: pays ${pct(s.pay)}`;
  return [
    `Pays ${pct(s.pay)}`,
    learn(s.knowhow),
    `towns want ${change(s.demand, "less", "more")}`,
    `the grid strains ${change(s.strain, "less", "more")}`,
  ].join(" · ");
}

export const LAMP_STEPS = LABELS.map((label, i) => ({
  label,
  note: lampNote(i),
}));

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
