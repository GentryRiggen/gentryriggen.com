import type { BotSet } from "../engine/bots";
import type { UniverseDef } from "../engine/types";
import { lightUniverse } from "./light";
import { lightBots } from "./light/bots";

/** Universes the scorecard script can play, with their bot sets. */
export const SCORED_UNIVERSES: Readonly<
  Record<string, { def: UniverseDef; bots: () => BotSet }>
> = {
  light: { def: lightUniverse, bots: lightBots },
};

export function parseScoreArgs(argv: readonly string[]): {
  universeId: string;
  isJson: boolean;
} {
  const isJson = argv.includes("--json");
  const universeId = argv.find((a) => !a.startsWith("--")) ?? "light";
  if (!Object.hasOwn(SCORED_UNIVERSES, universeId))
    throw new Error(
      `Unknown universe ${universeId}. Known: ${Object.keys(SCORED_UNIVERSES).join(", ")}`
    );
  return { universeId, isJson };
}
