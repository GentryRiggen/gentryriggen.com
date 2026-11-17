import { useState } from "react";
import {
  COLOURS,
  EYES,
  FACES,
  HATS,
  NECKS,
  SHAPES,
  unlockKey,
  type UnlockKind,
} from "@/lib/flamelings/catalog";
import type { DressSlot } from "@/lib/flamelings/actions";
import { stageFor } from "@/lib/flamelings/progress";
import { moodOf } from "@/lib/flamelings/sim";
import { labelOf, lockText } from "@/lib/flamelings/status";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Pet } from "@/lib/flamelings/types";
import Blob from "./Blob";
import ItemPreview from "./ItemPreview";
import SharePicture from "./SharePicture";
import {
  BIG_BUTTON,
  CHROME_BG,
  FOCUS_RING,
  PRIMARY_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
} from "./styles";

type TabKind = Extract<
  UnlockKind,
  "colour" | "shape" | "eyes" | "hat" | "face" | "neck"
>;

const TABS: {
  kind: TabKind;
  label: string;
  icon: string;
  ids: readonly string[];
}[] = [
  { kind: "colour", label: "Colour", icon: "🎨", ids: COLOURS },
  { kind: "shape", label: "Shape", icon: "🫧", ids: SHAPES },
  { kind: "eyes", label: "Eyes", icon: "👀", ids: EYES },
  { kind: "hat", label: "Hat", icon: "🎩", ids: HATS },
  { kind: "face", label: "Face", icon: "🕶️", ids: FACES },
  { kind: "neck", label: "Neck", icon: "🎀", ids: NECKS },
];

function isSelected(pet: Pet, kind: TabKind, id: string): boolean {
  if (kind === "colour" || kind === "shape" || kind === "eyes") {
    return pet.look[kind] === id;
  }
  return pet.worn[kind] === id;
}

interface WardrobeProps {
  pet: Pet;
  nowMs: number;
  onClose: () => void;
}

/** Dress-up: tabs of items, locked ones shown as silhouettes. */
export default function Wardrobe({ pet, nowMs, onClose }: WardrobeProps) {
  const dress = useFlamelings((s) => s.dress);
  const restyle = useFlamelings((s) => s.restyle);
  const [kind, setKind] = useState<TabKind>("colour");
  const [isSharing, setIsSharing] = useState(false);
  const tab = TABS.find((t) => t.kind === kind) ?? TABS[0];
  const isSlot = kind === "hat" || kind === "face" || kind === "neck";

  function pick(id: string | null) {
    if (isSlot) dress(pet.id, kind as DressSlot, id);
    else if (id) restyle(pet.id, { [kind]: id });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wardrobe"
      className={`fixed inset-0 z-30 flex flex-col overflow-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="flex items-center justify-between gap-3 py-2">
        <h2 className="text-2xl font-black">
          <span aria-hidden="true">👒 </span>Wardrobe
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSharing(true)}
            aria-label="Take a picture"
            data-testid="share-open"
            className={`${BIG_BUTTON} grid size-16 place-items-center bg-white/90 text-3xl dark:bg-slate-800/90`}
          >
            <span aria-hidden="true">📸</span>
          </button>
          <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
            Done
          </button>
        </div>
      </div>
      <div className="flex justify-center py-1">
        <Blob
          look={pet.look}
          worn={pet.worn}
          mood={moodOf(pet, nowMs) === "asleep" ? "happy" : moodOf(pet, nowMs)}
          stage={stageFor(pet.level).id}
          className="size-56 sm:size-72"
        />
      </div>
      <div
        role="tablist"
        aria-label="What to change"
        className="flex gap-2 overflow-x-auto py-2"
      >
        {TABS.map((t) => (
          <button
            key={t.kind}
            type="button"
            role="tab"
            aria-selected={t.kind === kind}
            onClick={() => setKind(t.kind)}
            className={`${BIG_BUTTON} flex shrink-0 flex-col items-center justify-center px-4 py-2 text-base ${
              t.kind === kind
                ? "bg-orange-500 text-white dark:bg-orange-400 dark:text-stone-900"
                : "bg-white/80 dark:bg-slate-800/80"
            }`}
          >
            <span aria-hidden="true" className="text-2xl">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={tab.label}
        className="grid flex-1 content-start gap-3 overflow-y-auto overflow-x-hidden py-2 [grid-template-columns:repeat(auto-fill,minmax(6.5rem,1fr))]"
      >
        {isSlot && (
          <button
            type="button"
            onClick={() => pick(null)}
            aria-pressed={pet.worn[kind as DressSlot] === null}
            aria-label={`No ${tab.label.toLowerCase()} item`}
            className={`grid min-h-28 place-items-center rounded-3xl border-4 bg-white/70 text-4xl dark:bg-slate-800/70 ${FOCUS_RING} ${
              pet.worn[kind as DressSlot] === null
                ? "border-orange-500 dark:border-orange-300"
                : "border-transparent"
            }`}
          >
            <span aria-hidden="true">🚫</span>
          </button>
        )}
        {tab.ids.map((id) => {
          const key = unlockKey(kind, id);
          const owned = pet.unlocked.includes(key);
          const selected = owned && isSelected(pet, kind, id);
          return (
            <button
              key={id}
              type="button"
              disabled={!owned}
              onClick={() => pick(id)}
              aria-pressed={owned ? selected : undefined}
              aria-label={
                owned
                  ? labelOf(key)
                  : `${labelOf(key)}, locked, ${lockText(key)}`
              }
              className={`relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-4 bg-white/70 p-2 dark:bg-slate-800/70 ${FOCUS_RING} ${
                selected
                  ? "border-orange-500 dark:border-orange-300"
                  : "border-transparent"
              }`}
            >
              <ItemPreview
                itemKey={key}
                look={pet.look}
                silhouette={!owned}
                className="size-16"
              />
              <span aria-hidden="true" className="text-sm font-bold">
                {owned ? labelOf(key) : `🔒 ${lockText(key)}`}
              </span>
              {!owned && lockText(key) === "Gift" && (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 text-xl"
                >
                  🎁
                </span>
              )}
            </button>
          );
        })}
      </div>
      {isSharing && (
        <SharePicture
          pet={pet}
          nowMs={nowMs}
          onClose={() => setIsSharing(false)}
        />
      )}
    </div>
  );
}
