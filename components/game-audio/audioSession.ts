/**
 * Lets a game's sound mix with whatever else is playing (a podcast, music)
 * instead of stopping it. Safari 16.4+ (iOS 16.4+) reads
 * `navigator.audioSession.type`: "ambient" mixes with other apps' audio and
 * follows the ring/silent switch, the way most mobile games behave. Without
 * it, the page's first sound pauses the player's podcast. Browsers without
 * the API already mix, so this is a no-op there.
 *
 * Call it before creating an AudioContext or playing an <audio> element.
 */
export function mixWithOtherAudio(): void {
  if (typeof navigator === "undefined") return;
  const session = (navigator as Navigator & { audioSession?: { type: string } })
    .audioSession;
  if (!session) return;
  try {
    if (session.type !== "ambient") session.type = "ambient";
  } catch {
    // An old or partial implementation; the default session still plays.
  }
}
