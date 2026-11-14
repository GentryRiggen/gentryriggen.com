import type { BotSet } from "../engine/bots";
import { cloneRun, newRun } from "../engine/engine";
import { simulate } from "../engine/sim";
import type { RunState, UniverseDef } from "../engine/types";

/**
 * Test mode's jumps: where in a part to land. The run is played there by the
 * scorecard's eager bot, so what's on screen is what a real player would have
 * (upgrades, side machines, know-how), not a hand-made guess.
 */
export type JumpPoint = "start" | "in" | "late";

export const JUMP_POINTS: readonly { id: JumpPoint; label: string }[] = [
  { id: "start", label: "Start" },
  { id: "in", label: "3 min in" },
  { id: "late", label: "Near the end" },
];

/** "3 min in": how far past the part's start. */
export const IN_SECONDS = 180;
/** "Near the end": about this long before the part would end. */
export const LATE_LEAD_SECONDS = 90;
/** The last part never ends by itself, so "near the end" is this far in. */
export const LAST_PART_LATE_SECONDS = 900;
const CHUNK_SECONDS = 30;
/** Bots finish every universe in well under this; a guard, not a target. */
const MAX_SECONDS = 6 * 3600;

const play = (
  def: UniverseDef,
  bots: BotSet,
  run: RunState,
  maxSeconds: number,
  stopWhen: (run: RunState) => boolean
): RunState =>
  simulate(def, {
    strategy: bots.tapper,
    maxSeconds,
    startRun: cloneRun(run),
    stopWhen,
  }).finalRun;

/** A run in part `phase` at `point`, played there by the eager bot. */
export function jumpRun(
  def: UniverseDef,
  bots: BotSet,
  phase: number,
  point: JumpPoint
): RunState {
  const target = Math.max(0, Math.min(def.phases.length - 1, phase));
  let run = newRun(def);
  if (target > 0)
    run = play(def, bots, run, MAX_SECONDS, (r) => r.phase >= target);
  if (point === "start" || run.complete || run.phase !== target) return run;
  const leaves = (r: RunState) => r.phase !== target || r.complete;
  if (point === "in") {
    const inRun = play(def, bots, run, IN_SECONDS, leaves);
    return leaves(inRun) ? run : inRun;
  }
  if (target === def.phases.length - 1) {
    const late = play(def, bots, run, LAST_PART_LATE_SECONDS, leaves);
    return leaves(late) ? run : late;
  }
  // Play on in chunks and keep the snapshots, then step back from the end.
  const snapshots: RunState[] = [run];
  for (let t = 0; t < MAX_SECONDS; t += CHUNK_SECONDS) {
    const next = play(def, bots, snapshots.at(-1)!, CHUNK_SECONDS, leaves);
    if (leaves(next)) break;
    snapshots.push(next);
  }
  const end = snapshots.at(-1)!.time + CHUNK_SECONDS;
  return (
    [...snapshots].reverse().find((s) => end - s.time >= LATE_LEAD_SECONDS) ??
    snapshots[0]
  );
}
