"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { soundSetting, useSoundEnabled } from "../audio/soundSetting";
import { isAudioSupported, trialSynth } from "../audio/synth";
import { buttonClass, pressedButtonClass } from "./styles";

const subscribeNever = () => () => {};
const isNeverSupported = () => false;

/**
 * Speaker button for the trial's sounds. Off by default and remembered. The
 * audio engine can only start from a tap; a remembered "on" is unlocked by
 * `TrialSound` (see `useSoundUnlock`), which is mounted from page load.
 */
export default function SoundToggle() {
  const isOn = useSoundEnabled();
  // False on the server and during hydration, so both renders agree.
  const isSupported = useSyncExternalStore(
    subscribeNever,
    isAudioSupported,
    isNeverSupported
  );

  if (!isSupported) return null;

  function handleClick() {
    if (isOn) {
      trialSynth.disable();
      soundSetting.set(false);
      return;
    }
    soundSetting.set(trialSynth.enable());
  }

  const Icon = isOn ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={isOn ? "Sound on" : "Sound off"}
      title={isOn ? "Sound on" : "Sound off"}
      onClick={handleClick}
      className={`min-h-11 min-w-11 ${isOn ? pressedButtonClass : buttonClass}`}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
    </button>
  );
}
