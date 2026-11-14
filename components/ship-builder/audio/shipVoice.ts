"use client";

import { createVoicePlayer } from "@/components/game-audio/voicePlayer";
import {
  pickVoiceLine,
  type VoiceMoment,
} from "@/lib/ship-builder/voice/lines";
import { getShipClip } from "@/lib/ship-builder/voice/manifest";
import { shipChannels } from "./channelSettings";
import { soundSetting } from "./soundSetting";
import { trialSynth } from "./synth";

export type { VoiceMoment };

/** Fired on the window whenever a line starts or stops. */
export const SHIP_VOICE_EVENT = "ship-builder:voice";

/** The escape's spoken lines. Lines without a recorded clip stay silent. */
export const shipVoicePlayer = createVoicePlayer({
  getClip: (id) => getShipClip(id),
  eventName: SHIP_VOICE_EVENT,
  maxQueue: 1,
});

/** How many times each moment has spoken, to rotate its variants. */
const said = new Map<VoiceMoment, number>();

/**
 * Speaks a line for an escape moment, a different variant each time. Silent
 * unless sound is on and unlocked and the Voice switch is on. Lines never
 * cut each other off: a new one waits for the current one (only the latest
 * waits).
 */
export function playShipVoice(moment: VoiceMoment): void {
  if (!soundSetting.get() || !trialSynth.isEnabled()) return;
  if (!shipChannels.voice.get()) return;
  const n = said.get(moment) ?? 0;
  said.set(moment, n + 1);
  shipVoicePlayer.play(pickVoiceLine(moment, n));
}

/** Lets the next tap or key press unlock the voice's audio (iOS). */
export function unlockShipVoiceOnGesture(): void {
  shipVoicePlayer.unlockOnGesture();
}

/** Forgets the rotation and the player's state (tests). */
export function resetShipVoice(): void {
  said.clear();
  shipVoicePlayer.reset();
}
