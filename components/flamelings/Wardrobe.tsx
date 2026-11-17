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
import FlIcon, { type FlIconName } from "./FlIcon";
import PanelHeader from "./PanelHeader";
import {
  CHROME_BG,
  DISPLAY,
  FOCUS_RING,
  DONE_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  SPOTLIGHT,
  STICKER,
  STICKER_BUTTON,
  TAB_CHIP,
  TAB_ICON_DISC,
  TAB_OFF,
  TAB_ON,
} from "./styles";

type TabKind = Extract<
  UnlockKind,
  "colour" | "shape" | "eyes" | "hat" | "face" | "neck"
>;

const TABS: {
  kind: TabKind;
  label: string;
  icon: FlIconName;
  ids: readonly string[];
}[] = [
  { kind: "colour", label: "Colour", icon: "colour", ids: COLOURS },
  { kind: "shape", label: "Shape", icon: "shape", ids: SHAPES },
  { kind: "eyes", label: "Eyes", icon: "eyes", ids: EYES },
  { kind: "hat", label: "Hat", icon: "hat", ids: HATS },
  { kind: "face", label: "Face", icon: "face", ids: FACES },
  { kind: "neck", label: "Neck", icon: "neck", ids: NECKS },
];

/** A wardrobe tile: a cream sticker; the one worn gets an orange ring. */
const TILE = `${STICKER} relative flex min-h-32 flex-col items-center justify-center gap-1 p-2 transition-transform active:translate-y-[2px] disabled:active:translate-y-0 ${FOCUS_RING}`;
const TILE_ON = "ring-4 ring-[#f2542d] ring-offset-2 ring-offset-transparent";

function WornBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 grid size-8 place-items-center rounded-full border-[3px] border-[#fff6e6] bg-[#4ade80] shadow-[0_2px_6px_rgba(30,10,40,.25)]"
    >
      <FlIcon name="check" className="size-5" />
    </span>
  );
}

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

  const mood = moodOf(pet, nowMs);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wardrobe"
      className={`fl-sheet-up fixed inset-0 z-30 flex flex-col overflow-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
        <PanelHeader icon="dress" iconClass="bg-[#ff8fb1]" title="Wardrobe">
          <button
            type="button"
            onClick={() => setIsSharing(true)}
            aria-label="Take a picture"
            data-testid="share-open"
            className={`${STICKER_BUTTON} size-16`}
          >
            <FlIcon name="camera" className="size-9" />
          </button>
          <button type="button" onClick={onClose} className={DONE_BUTTON}>
            Done
          </button>
        </PanelHeader>
        <div className="relative flex justify-center py-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,226,176,.9)_0%,rgba(255,226,176,0)_68%)] sm:size-80 dark:bg-[radial-gradient(circle,rgba(255,160,80,.38)_0%,rgba(255,160,80,0)_68%)]"
          />
          <Blob
            look={pet.look}
            worn={pet.worn}
            mood={mood === "asleep" ? "happy" : mood}
            stage={stageFor(pet.level).id}
            className="relative size-52 sm:size-64"
          />
        </div>
        <div
          role="tablist"
          aria-label="What to change"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 pt-1"
        >
          {TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={t.kind === kind}
              onClick={() => setKind(t.kind)}
              className={`${TAB_CHIP} ${t.kind === kind ? TAB_ON : TAB_OFF}`}
            >
              <span className={TAB_ICON_DISC}>
                <FlIcon name={t.icon} className="size-7" />
              </span>
              {t.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          aria-label={tab.label}
          className="grid flex-1 content-start gap-4 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-2 [grid-template-columns:repeat(auto-fill,minmax(6.5rem,1fr))]"
        >
          {isSlot && (
            <button
              type="button"
              onClick={() => pick(null)}
              aria-pressed={pet.worn[kind as DressSlot] === null}
              aria-label={`No ${tab.label.toLowerCase()} item`}
              className={`${TILE} ${
                pet.worn[kind as DressSlot] === null ? TILE_ON : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="grid size-16 place-items-center rounded-full border-4 border-dashed border-[#d9b98f]"
              >
                <FlIcon name="close" className="size-8" />
              </span>
              <span
                aria-hidden="true"
                className={`${DISPLAY} text-sm font-semibold`}
              >
                None
              </span>
              {pet.worn[kind as DressSlot] === null && <WornBadge />}
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
                className={`${TILE} ${selected ? TILE_ON : ""}`}
              >
                <span
                  className={`grid size-20 place-items-center rounded-full ${owned ? SPOTLIGHT : ""}`}
                >
                  <ItemPreview
                    itemKey={key}
                    look={pet.look}
                    silhouette={!owned}
                    className="size-16"
                  />
                </span>
                <span
                  aria-hidden="true"
                  className={`${DISPLAY} flex items-center gap-1 text-center text-sm font-semibold leading-tight ${
                    owned ? "" : "text-[#9a7f8f]"
                  }`}
                >
                  {!owned && <FlIcon name="lock" className="size-4 shrink-0" />}
                  {owned ? labelOf(key) : lockText(key)}
                </span>
                {selected && <WornBadge />}
                {!owned && lockText(key) === "Gift" && (
                  <FlIcon
                    name="gift"
                    className="absolute right-2 top-2 size-7"
                  />
                )}
              </button>
            );
          })}
        </div>
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
