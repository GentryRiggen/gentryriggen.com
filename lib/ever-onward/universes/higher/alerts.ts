import type { RunState } from "../../engine/types";
import { toddlerSeconds, toddlerStage } from "./playroom";
import {
  forecastOf,
  gustIn,
  isBlowing,
  isNoCrane,
  isSkyOpen,
  ncLeft,
  strainStep,
} from "./sky";
import { swayOf } from "./sway";
import {
  darkCutText,
  dayNext,
  dayNow,
  daySecondsLeft,
  isTownOpen,
} from "./town";

/** The town's tower is wobbling above this. */
export const WOBBLE_AT = 0.7;

/** A kind heads-up: the town tower leans (nothing falls), the sky has its forecast; in the playroom, the toddler. */
export function higherAlert(run: RunState): string | null {
  if (run.complete || run.phase > 2) return null;
  if (run.phase === 0) {
    const stage = toddlerStage(run);
    if (stage === "coming")
      return `The toddler is coming in ${toddlerSeconds(run)} seconds! Tumbles come much more easily while it stomps, most of all for a leaning tower. Bank your streak or slow down.`;
    if (stage === "stomping")
      return "The toddler is stomping on the rug! The tower tumbles much more easily until it goes, even if you stop tapping.";
    return null;
  }
  if (run.phase === 1) {
    if (swayOf(run) >= WOBBLE_AT)
      return "The tower is wobbling! The crew works at half speed. Slow the pace or change a hat. Braces, a good footing and hard hats make it wobble less.";
    if (
      isTownOpen(run) &&
      daySecondsLeft(run) <= 20 &&
      dayNext(run).id !== dayNow(run).id
    )
      return `${dayNext(run).name} tomorrow! It starts in ${daySecondsLeft(run)} seconds. ${dayNext(run).note}`;
    if (
      isTownOpen(run) &&
      darkCutText(run) &&
      daySecondsLeft(run) > 20 &&
      dayNow(run).id === "night"
    )
      return `Night shift! ${darkCutText(run)}`;
    return null;
  }
  if (!isSkyOpen(run)) return null;
  if (isBlowing(run))
    return "A gust is blowing! A loose load can drop, and a tight cable can snap.";
  if (forecastOf(run) === 2)
    return isNoCrane(run)
      ? `A gust is coming in ${gustIn(run)} seconds and it will end the no-crane climb. You can put the crane back on and not waste the slow seconds.`
      : `A gust is coming in ${gustIn(run)} seconds! A loose load can drop and a tight cable can snap. Tie down (it takes a moment and earns nothing), or ease the cable.`;
  if (forecastOf(run) === 1 && strainStep(run) >= 2)
    return "Clouds are gathering. A gust may follow, and a tight cable snaps much more in a gust.";
  if (isNoCrane(run) && ncLeft(run) <= 10)
    return `Almost there! ${ncLeft(run)} more seconds without the crane.`;
  return null;
}
