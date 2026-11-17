import { useEffect } from "react";
import { parseUnlockKey } from "@/lib/flamelings/catalog";
import { STAGES } from "@/lib/flamelings/progress";
import { labelOf } from "@/lib/flamelings/status";
import { useFlamelings, type Celebration } from "@/lib/flamelings/store";
import Blob from "./Blob";
import { burstConfetti } from "./confetti";
import ItemPreview from "./ItemPreview";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import { PRIMARY_BUTTON } from "./styles";

const KIND_WORD: Record<string, string> = {
  colour: "colour",
  shape: "shape",
  eyes: "eyes",
  hat: "hat",
  face: "face item",
  neck: "neck item",
  emote: "emote",
  food: "food",
  decor: "decoration",
};

/** The "NEW!" level-up, present and relight cards. One shows at a time. */
export default function CelebrationCard({
  celebration,
}: {
  celebration: Celebration;
}) {
  const dismiss = useFlamelings((s) => s.dismissCelebration);
  const pet = useFlamelings((s) =>
    s.save.pets.find((p) => p.id === celebration.petId)
  );
  useEffect(() => {
    void burstConfetti();
  }, [celebration]);
  if (!pet) return null;

  const itemKey =
    celebration.kind === "levelUp"
      ? celebration.unlocked
      : celebration.kind === "gift" || celebration.kind === "bought"
        ? celebration.key
        : null;
  const parsed = itemKey ? parseUnlockKey(itemKey) : null;
  const stage =
    celebration.kind === "levelUp"
      ? STAGES.find((s) => s.id === celebration.stage)
      : undefined;
  const title =
    celebration.kind === "levelUp"
      ? `Level ${celebration.level}!`
      : celebration.kind === "gift"
        ? "A surprise!"
        : celebration.kind === "bought"
          ? "You got it!"
          : `${pet.name} is glowing again!`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-40 grid place-items-center bg-black/60 p-5 ${SAFE_INSETS}`}
    >
      <div className="fl-card-in flex w-full max-w-md flex-col items-center gap-3 rounded-[2rem] bg-gradient-to-b from-amber-100 to-orange-200 p-6 text-center text-stone-900 shadow-2xl dark:from-slate-800 dark:to-indigo-950 dark:text-amber-50">
        <p className="text-4xl font-black">{title}</p>
        {celebration.kind === "levelUp" && stage && (
          <p className="text-lg font-bold">
            {pet.name} is a {stage.name} now
          </p>
        )}
        {celebration.kind === "relit" && (
          <p className="text-lg font-bold">
            You brought {pet.name} back to life!
          </p>
        )}
        <Blob
          look={pet.look}
          worn={pet.worn}
          mood="excited"
          stage="bonfire"
          className="size-40"
        />
        {itemKey && parsed ? (
          <div className="flex items-center gap-4 rounded-3xl bg-white/80 px-5 py-3 dark:bg-slate-900/70">
            <span className="fl-shine-text rounded-full bg-red-500 px-3 py-1 text-lg font-black text-white">
              NEW!
            </span>
            <ItemPreview
              itemKey={itemKey}
              look={pet.look}
              className="size-20"
            />
            <span className="text-left text-xl font-extrabold">
              {labelOf(itemKey)}
              <span className="block text-sm font-semibold opacity-70">
                a new {KIND_WORD[parsed.kind]}
              </span>
            </span>
          </div>
        ) : null}
        <button
          type="button"
          autoFocus
          onClick={dismiss}
          className={PRIMARY_BUTTON}
        >
          Yay!
        </button>
      </div>
    </div>
  );
}
