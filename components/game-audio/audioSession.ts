import {
  createStoredSetting,
  type StoredSetting,
} from "@/components/ship-builder/hooks/createStoredSetting";

type SessionType = "ambient" | "playback";

/**
 * "Play sound on silent", remembered per device (default off). Off keeps the
 * game ambient; on makes it a playback session.
 */
export const playOnSilent: StoredSetting<boolean> =
  createStoredSetting<boolean>({
    key: "game-audio:ui:playOnSilent",
    parse: (raw) => raw === "on",
    serialize: (value) => (value ? "on" : null),
    fallback: false,
  });

/**
 * Sets the page's audio session from the "Play sound on silent" setting.
 * Safari 16.4+ (iOS 16.4+) reads `navigator.audioSession.type`:
 * - "ambient" (setting off) mixes with other apps' audio, so a podcast keeps
 *   playing, but follows the ring/silent switch.
 * - "playback" (setting on) plays even on silent, but pauses other audio.
 * Browsers without the API already mix and ignore the switch, so this is a
 * no-op there.
 *
 * Call it before creating an AudioContext or playing an <audio> element, and
 * again when the setting changes (`setPlayOnSilent` does).
 */
export function applyAudioSession(): void {
  if (typeof navigator === "undefined") return;
  const session = (navigator as Navigator & { audioSession?: { type: string } })
    .audioSession;
  if (!session) return;
  const type: SessionType = playOnSilent.get() ? "playback" : "ambient";
  try {
    if (session.type !== type) session.type = type;
  } catch {
    // An old or partial implementation; the default session still plays.
  }
}

/**
 * Changes the setting and applies it at once. A running AudioContext may stay
 * suspended after the type changes; the game resumes it on the next tap, and
 * the toggle's own tap counts.
 */
export function setPlayOnSilent(next: boolean): void {
  playOnSilent.set(next);
  applyAudioSession();
}
