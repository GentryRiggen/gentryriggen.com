import {
  EMOTES,
  EMOTE_GLYPH,
  LABELS,
  unlockKey,
  type EmoteId,
} from "@/lib/flamelings/catalog";
import { lockText } from "@/lib/flamelings/status";
import type { Pet } from "@/lib/flamelings/types";
import { FOCUS_RING } from "./styles";

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
      className="flex flex-wrap justify-center gap-3 rounded-t-3xl bg-indigo-950/85 p-3 backdrop-blur"
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
            className={`relative grid size-20 place-items-center rounded-2xl bg-indigo-100 shadow active:scale-95 disabled:bg-indigo-100/30 ${FOCUS_RING}`}
          >
            <span
              aria-hidden="true"
              className={`text-4xl ${owned ? "" : "opacity-30 grayscale"}`}
            >
              {EMOTE_GLYPH[emote]}
            </span>
            {!owned && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1 text-center text-xs font-bold text-indigo-950"
              >
                🔒 {lockText(key)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
