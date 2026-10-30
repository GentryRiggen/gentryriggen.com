"use client";

import { useEffect } from "react";
import { shipChannels } from "./channelSettings";
import { soundSetting } from "./soundSetting";
import { isAudioSupported, trialSynth } from "./synth";

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

  // The music and effects switches apply whether or not audio is unlocked yet:
  // the synth keeps them and acts once it is.
  useEffect(() => {
    trialSynth.setMusicEnabled(isMusicOn);
  }, [isMusicOn]);
  useEffect(() => {
    trialSynth.setEffectsEnabled(isEffectsOn);
  }, [isEffectsOn]);

  useEffect(() => {
    if (!isOn || !isAudioSupported() || trialSynth.isEnabled()) return;
    const remove = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    const unlock = () => {
      remove();
      if (!trialSynth.enable()) soundSetting.set(false);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return remove;
  }, [isOn]);
}
