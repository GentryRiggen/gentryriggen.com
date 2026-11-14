import {
  BARELY_HELPS_BELOW,
  previewBiggestChange,
  previewChangesNothing,
  visibleUpgrades,
} from "../engine";
import { canAfford, isMaxed } from "../engine";
import { simulate, type Strategy } from "../sim";
import type { BotSet } from "../bots";
import type { RunState, UniverseDef } from "../types";
import { SCORED_UNIVERSES } from "../../universes/scored";

jest.setTimeout(300_000);

const SAMPLE_EVERY = 45;

/** Plays a full run and lists every dead (zero-effect) upgrade at samples. */
function deadAtSamples(
  def: UniverseDef,
  strategy: Strategy,
  isSoft = false
): Map<string, string> {
  const dead = new Map<string, string>();
  let next = 0;
  const sample = (run: RunState): boolean => {
    if (run.time < next) return false;
    next = run.time + SAMPLE_EVERY;
    for (const u of visibleUpgrades(def, run)) {
      if (isMaxed(run, u) || !canAfford(run, u) || u.kind === "mechanic")
        continue;
      const preview = u.effectPreview?.(run) ?? null;
      const change = previewBiggestChange(preview);
      const isDead = isSoft
        ? change !== null && change < BARELY_HELPS_BELOW
        : previewChangesNothing(preview);
      if (!isDead || u.noEffectReason) continue;
      dead.set(u.id, `${preview} (t=${Math.round(run.time)}s)`);
    }
    return false;
  };
  simulate(def, {
    maxSeconds: 6 * 3600,
    step: 1,
    strategy,
    stopWhen: sample,
  });
  return dead;
}

describe.each(Object.entries(SCORED_UNIVERSES))(
  "%s has no dead upgrades",
  (_name, { def, bots }) => {
    const set: BotSet = bots();
    it.each(["tapper", "realistic", "idle"] as const)(
      "every affordable upgrade changes a stat (%s bot)",
      (bot) => {
        expect([...deadAtSamples(def, set[bot])]).toEqual([]);
      }
    );
    it.each(["tapper", "realistic"] as const)(
      "every upgrade that barely helps carries a reason (%s bot)",
      (bot) => {
        expect([...deadAtSamples(def, set[bot], true)]).toEqual([]);
      }
    );
  }
);
