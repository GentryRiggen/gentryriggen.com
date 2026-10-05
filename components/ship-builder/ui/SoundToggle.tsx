"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { soundSetting, useSoundEnabled } from "../audio/soundSetting";
import { isAudioSupported, trialSynth } from "../audio/synth";
import { buttonClass, pressedButtonClass } from "./styles";

const subscribeNever = () => () => {};
const isNeverSupported = () => false;

/**
 * Speaker button for the trial's sounds. Off by default and remembered. The
 * audio engine can only start from a tap, so a remembered "on" starts it on
 * the player's first tap or key press anywhere.
 */
export default function SoundToggle() {
  const isOn = useSoundEnabled();
  // False on the server and during hydration, so both renders agree.
  const isSupported = useSyncExternalStore(
    subscribeNever,
    isAudioSupported,
    isNeverSupported
  );

  useEffect(() => {
    if (!isSupported || !isOn || trialSynth.isEnabled()) return;
    const start = () => {
      if (!trialSynth.enable()) soundSetting.set(false);
    };
    const options = { once: true } as const;
    window.addEventListener("pointerdown", start, options);
    window.addEventListener("keydown", start, options);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [isSupported, isOn]);

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
