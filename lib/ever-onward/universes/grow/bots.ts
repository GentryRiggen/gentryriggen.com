import { genericBots, type BotSet } from "../../engine/bots";
import { growUniverse } from ".";

/** Later parts add policies for the hand-made actions. */
export function growBots(): BotSet {
  return genericBots(growUniverse);
}
