import {
  countSaved,
  notScored,
  scoreEvacuation,
  scoreOutlast,
  scoreShipshape,
  shipshapeRuns,
  type ChallengeScore,
} from "@/lib/ship-builder/challenges/score";
import type { ChallengeId } from "@/lib/ship-builder/challenges/definitions";
import type { Ship } from "@/lib/ship-builder/model/types";
import { timelineEnd } from "@/lib/ship-builder/sim/timeline";
import type { SimState, TrialInput } from "@/lib/ship-builder/sim/types";
import { crowdPlanFor } from "../scene/crowdView";
import { trialEvacuationFor, trialTimelineFor } from "../scene/trialTimeline";

/**
 * Scores a finished challenge trial. The evacuation reads the same plan the
 * scene played (cached beside the trial's timeline), so what the player
 * watched is what is counted.
 */
export default function scoreChallengeTrial(
  id: ChallengeId,
  input: TrialInput,
  state: SimState,
  ship: Ship
): ChallengeScore {
  switch (id) {
    case "outlast":
      return scoreOutlast(state);
    case "shipshape":
      return scoreShipshape(shipshapeRuns(input));
    case "evacuation": {
      const people = crowdPlanFor(ship).plan.people.length;
      // Nothing to escape from: the card says so and nothing is saved.
      if (state.outcome !== "sank") return notScored("evacuation");
      const plan = trialEvacuationFor(input, ship, true);
      if (!plan) return scoreEvacuation(people, 0);
      const end = timelineEnd(trialTimelineFor(input, true));
      return scoreEvacuation(people, countSaved(plan, people, end));
    }
  }
}
