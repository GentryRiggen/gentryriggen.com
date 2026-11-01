"use client";

import { AudioWaveform, MessageCircle, Music2 } from "lucide-react";
import type { StoredSetting } from "@/components/ship-builder/hooks/createStoredSetting";
import type { ChannelSettings } from "./channels";

interface ChannelTogglesProps {
  settings: ChannelSettings;
  /** The game's sound setting; the toggles only show once sound is on. */
  isSoundOn: boolean;
  buttonClass: string;
  pressedButtonClass: string;
}

interface VoiceToggleProps {
  setting: StoredSetting<boolean>;
  buttonClass: string;
  pressedButtonClass: string;
}

/** The spoken-lines switch, for games that talk. */
function VoiceToggle({
  setting,
  buttonClass,
  pressedButtonClass,
}: VoiceToggleProps) {
  const isVoiceOn = setting.useValue();
  return (
    <button
      type="button"
      aria-pressed={isVoiceOn}
      aria-label="Voice"
      title={isVoiceOn ? "Voice on" : "Voice off"}
      onClick={() => setting.set(!isVoiceOn)}
      className={`min-h-11 min-w-11 px-3 ${isVoiceOn ? pressedButtonClass : buttonClass}`}
    >
      <MessageCircle
        aria-hidden="true"
        className={`h-4 w-4 shrink-0 ${isVoiceOn ? "" : "opacity-50"}`}
      />
    </button>
  );
}

/**
 * Music and sound-effects buttons that sit beside a game's speaker button,
 * plus a Voice button when the game's settings have one.
 */
export default function ChannelToggles({
  settings,
  isSoundOn,
  buttonClass,
  pressedButtonClass,
}: ChannelTogglesProps) {
  const isMusicOn = settings.music.useValue();
  const isEffectsOn = settings.effects.useValue();
  if (!isSoundOn) return null;

  return (
    <>
      <button
        type="button"
        aria-pressed={isMusicOn}
        aria-label="Music"
        title={isMusicOn ? "Music on" : "Music off"}
        onClick={() => settings.music.set(!isMusicOn)}
        className={`min-h-11 min-w-11 px-3 ${isMusicOn ? pressedButtonClass : buttonClass}`}
      >
        <Music2
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 ${isMusicOn ? "" : "opacity-50"}`}
        />
      </button>
      <button
        type="button"
        aria-pressed={isEffectsOn}
        aria-label="Sound effects"
        title={isEffectsOn ? "Sound effects on" : "Sound effects off"}
        onClick={() => settings.effects.set(!isEffectsOn)}
        className={`min-h-11 min-w-11 px-3 ${isEffectsOn ? pressedButtonClass : buttonClass}`}
      >
        <AudioWaveform
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 ${isEffectsOn ? "" : "opacity-50"}`}
        />
      </button>
      {settings.voice && (
        <VoiceToggle
          setting={settings.voice}
          buttonClass={buttonClass}
          pressedButtonClass={pressedButtonClass}
        />
      )}
    </>
  );
}
