import type { EscapeEnding } from "./walk/escape";

/** The four moments of the escape that get a card. */
export type EscapeMoment = "saved-deck" | "saved-swim" | "splash" | "frozen";

export const ESCAPE_POPUPS: Record<
  EscapeMoment,
  { title: string; body: string }
> = {
  "saved-deck": {
    title: "You're safe!",
    body: "You made it into a lifeboat. Wave goodbye to that soggy ship!",
  },
  "saved-swim": {
    title: "Saved from the sea!",
    body: "You swam to a boat and climbed in, dripping wet but safe.",
  },
  splash: {
    title: "Splash!",
    body: "You'll have to survive the waters! Swim to a lifeboat before you get too cold.",
  },
  frozen: {
    title: "Brrr! Human ice cube!",
    body: "A passing fishing boat scooped you up. You survived, just!",
  },
};

/** The line on the result card for how the player got away. */
export const ESCAPE_RESULT_LINES: Record<EscapeEnding, string> = {
  deck: "You escaped in a lifeboat",
  swim: "You swam to a lifeboat and climbed in",
  frozen: "A fishing boat fished you out, frozen solid",
};
