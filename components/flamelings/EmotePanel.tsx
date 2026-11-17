import {
  EMOTES,
  EMOTE_GLYPH,
  LABELS,
  unlockKey,
  type EmoteId,
} from "@/lib/flamelings/catalog";
import { lockText } from "@/lib/flamelings/status";
import type { Pet } from "@/lib/flamelings/types";
import FlIcon from "./FlIcon";
import { DISPLAY, TRAY, TRAY_TILE } from "./styles";

interface EmotePanelProps {
  pet: Pet;
  onPick: (emote: EmoteId) => void;
}

/** The eight emotes; the ones not unlocked yet show a lock. */
export default function EmotePanel({ pet, onPick }: EmotePanelProps) {
  return (
    <div
      role="group"
      aria-label="Emotes"
      className={`${TRAY} flex max-w-full flex-wrap justify-center gap-2 sm:gap-3`}
    >
      {EMOTES.map((emote) => {
        const key = unlockKey("emote", emote);
        const owned = pet.unlocked.includes(key);
        const label = LABELS[emote] ?? emote;
        return (
          <button
            key={emote}
            type="button"
            disabled={!owned}
            onClick={() => onPick(emote)}
            aria-label={owned ? label : `${label}, locked, ${lockText(key)}`}
            className={TRAY_TILE}
          >
            <span
              aria-hidden="true"
              className={`text-5xl ${owned ? "" : "opacity-25 grayscale"}`}
            >
              {EMOTE_GLYPH[emote]}
            </span>
            {!owned && (
              <span
                aria-hidden="true"
                className={`${DISPLAY} absolute inset-x-0 bottom-1 flex items-center justify-center gap-0.5 text-xs font-semibold text-[#7a5a78]`}
              >
                <FlIcon name="lock" className="size-3.5" />
                {lockText(key)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
