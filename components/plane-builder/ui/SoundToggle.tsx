"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { isAudioSupported, planeSynth } from "../audio/planeSynth";
import { soundSetting, useSoundEnabled } from "../audio/soundSetting";
import { primaryButtonClass, secondaryButtonClass } from "./styles";

const subscribeNever = () => () => {};
const isNeverSupported = () => false;

/**
 * Speaker button. Off by default and remembered. The audio engine can only
 * start from a tap, so turning it on starts it inside the click; a remembered
 * "on" is unlocked by the first tap anywhere (see `useSoundUnlock`).
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
      planeSynth.disable();
      soundSetting.set(false);
      return;
    }
    soundSetting.set(planeSynth.enable());
  }

  const Icon = isOn ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label="Sound"
      title={isOn ? "Sound on" : "Sound off"}
      onClick={handleClick}
      className={`min-w-11 px-3 ${isOn ? primaryButtonClass : secondaryButtonClass}`}
    >
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
    </button>
  );
}
