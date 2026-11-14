import { JUMP_S, LOWER_S, ROW_S } from "../crowd/evacuation";
import type { BoatLaunch } from "../crowd/evacuation";
import type { EscapeMoment } from "../escapeCopy";
import type { EscapePhase } from "./escape";

/**
 * Which card, if any, the escape shows at sim time `t`. A deck rescue waits
 * until the boat is fully out (a davit boat lowered and rowed away, a raft
 * drifted off); a swim rescue, the splash and the freeze show at once.
 */
export function escapePopupFor(
  phase: EscapePhase,
  launch: BoatLaunch | null,
  t: number
): EscapeMoment | null {
  switch (phase.kind) {
    case "swimming":
      return "splash";
    case "frozen":
      return "frozen";
    case "in-boat": {
      if (phase.fromWater) return "saved-swim";
      if (!launch) return "saved-deck";
      const outAt =
        launch.kind === "davit"
          ? launch.at + LOWER_S + ROW_S
          : launch.departs > phase.since
            ? launch.departs
            : phase.since + JUMP_S + 1;
      return t >= outAt ? "saved-deck" : null;
    }
    default:
      return null;
  }
}
