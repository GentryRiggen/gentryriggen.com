"use client";

import { useEffect } from "react";
import { shipChannels } from "./channelSettings";
import { unlockShipVoiceOnGesture } from "./shipVoice";
import { soundSetting } from "./soundSetting";
import { isAudioSupported, trialSynth } from "./synth";

/**
 * Gestures that may unlock audio. iOS Safari only counts touchend and click
 * as user activation for audio, so those join pointerdown and keydown.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

/**
 * Browsers only let audio start from a tap or key press. When sound is
 * remembered as on, the first tap or key press anywhere starts it, so the very
 * tap that begins a trial already unlocks the sound. The listeners go away
 * once the audio has started, when sound is off, and on unmount. If the engine
 * cannot start, the setting is switched back off. It also passes the music and
 * sound-effects switches on to the synth.
 */
export default function useSoundUnlock(isOn: boolean) {
  const isMusicOn = shipChannels.music.useValue();
  const isEffectsOn = shipChannels.effects.useValue();

  // While mounted this holds the audio graph; the last one to leave frees it.
  useEffect(() => trialSynth.acquire(), []);

  // The music and effects switches apply whether or not audio is unlocked yet:
  // the synth keeps them and acts once it is.

  useEffect(() => {
    trialSynth.setMusicEnabled(isMusicOn);
  }, [isMusicOn]);
  useEffect(() => {
    trialSynth.setEffectsEnabled(isEffectsOn);
  }, [isEffectsOn]);

  // The spoken lines have their own audio context; a tap unlocks it too.
  useEffect(() => {
    if (isOn) unlockShipVoiceOnGesture();
  }, [isOn]);

  useEffect(() => {
    if (!isOn || !isAudioSupported() || trialSynth.isEnabled()) return;
    const remove = () => {
      for (const type of UNLOCK_EVENTS)
        window.removeEventListener(type, unlock);
    };
    const unlock = () => {
      remove();
      if (!trialSynth.enable()) soundSetting.set(false);
    };
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock);
    return remove;
  }, [isOn]);
}
