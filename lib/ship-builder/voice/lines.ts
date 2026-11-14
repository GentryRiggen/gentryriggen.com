/** The moments of an escape that get a spoken line. */
export type VoiceMoment =
  | "boarded"
  | "jumped"
  | "saved-deck"
  | "splash"
  | "cold"
  | "saved-swim"
  | "frozen";

/** What is said at each moment; several variants so it does not repeat. */
const VARIANTS: Record<VoiceMoment, readonly string[]> = {
  boarded: [
    "In you get! Hold on tight, we're lowering away.",
    "Climb aboard! Next stop, the water.",
  ],
  jumped: ["Geronimo! Right into the raft!", "Big jump! Nice landing."],
  "saved-deck": [
    "You're safe! You made it into a lifeboat.",
    "Rescued! Wave goodbye to that soggy old ship.",
    "Safe and sound. Great thinking, sailor!",
  ],
  splash: [
    "Splash! No boat for you. You'll have to survive the waters!",
    "Whoops, you're swimming now! Find a lifeboat, quick!",
    "Into the drink! Paddle to a boat before you turn into an ice cube.",
  ],
  cold: [
    "Brr, it's getting chilly! Swim to a boat!",
    "Your teeth are chattering! Hurry!",
  ],
  "saved-swim": [
    "Grab my hand! You made it out of the water!",
    "Pulled aboard, dripping wet, but safe!",
  ],
  frozen: [
    "Brrr! You're a human ice cube. Luckily a passing fishing boat scooped you up.",
    "Frozen like a fish stick! A fishing boat hauled you out just in time.",
  ],
};

export const VOICE_MOMENTS = Object.keys(VARIANTS) as VoiceMoment[];

/**
 * Every spoken line, id `escape/<moment>-<n>` (n from 1). The voice script
 * (`npm run voice:ship-builder`) records these.
 */
export const SHIP_VOICE_LINES: { id: string; text: string }[] =
  VOICE_MOMENTS.flatMap((moment) =>
    VARIANTS[moment].map((text, i) => ({
      id: `escape/${moment}-${i + 1}`,
      text,
    }))
  );

/** The line ids for one moment, in order. */
export function voiceMomentIds(moment: VoiceMoment): string[] {
  return VARIANTS[moment].map((_, i) => `escape/${moment}-${i + 1}`);
}

/** The `n`th line for a moment, cycling through its variants. */
export function pickVoiceLine(moment: VoiceMoment, n: number): string {
  const ids = voiceMomentIds(moment);
  const at = ((Math.floor(n) % ids.length) + ids.length) % ids.length;
  return ids[at];
}
