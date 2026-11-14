"use client";

import { useSyncExternalStore } from "react";
import { disableSfx, enableSfx, isAudioSupported, playCue } from "../audio/sfx";
import { soundSetting, useSoundEnabled } from "../audio/soundSetting";

const subscribeNever = () => () => {};
const isNeverSupported = () => false;

/**
 * The 🔊/🔇 button. Sound is on by default and remembered. A browser only
 * starts audio from a tap, so turning it on starts the engine inside the
 * click; a remembered "on" is unlocked by the first tap anywhere.
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
      disableSfx();
      soundSetting.set(false);
      return;
    }
    const started = enableSfx();
    soundSetting.set(started);
    if (started) playCue("uiTap");
  }

  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label="Sound"
      title={isOn ? "Sound on" : "Sound off"}
      onClick={handleClick}
      className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-black/55 text-3xl active:scale-95"
    >
      <span aria-hidden="true">{isOn ? "🔊" : "🔇"}</span>
    </button>
  );
}
