import { useEffect, useState } from "react";
import { parseUnlockKey } from "@/lib/flamelings/catalog";
import { FORM_INFO } from "@/lib/flamelings/forms";
import { STAGES, stageFor } from "@/lib/flamelings/progress";
import { playSound } from "@/lib/flamelings/sound";
import { labelOf } from "@/lib/flamelings/status";
import { useFlamelings, type Celebration } from "@/lib/flamelings/store";
import Blob from "./Blob";
import CardBlob from "./friends/CardBlob";
import { VISITED_REWARD } from "@/lib/flamelings/online/friendActions";
import { onlineName } from "@/lib/flamelings/online/names";
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

/** How long the glow-out and the spin last before the reveal. */
const GLOW_MS = 1300;
const SPIN_MS = 1200;

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The big grown-up moment: the pet glows out, spins, then the new form is
 * revealed with confetti, a sound and a name card. Reduced motion goes
 * straight to the reveal.
 */
function EvolutionCard({
  celebration,
}: {
  celebration: Extract<Celebration, { kind: "evolve" }>;
}) {
  const dismiss = useFlamelings((s) => s.dismissCelebration);
  const pet = useFlamelings((s) =>
    s.save.pets.find((p) => p.id === celebration.petId)
  );
  const [phase, setPhase] = useState<"glow" | "spin" | "reveal">(() =>
    reducedMotion() ? "reveal" : "glow"
  );
  useEffect(() => {
    if (phase === "reveal") {
      playSound("evolve");
      void burstConfetti({ particleCount: 160, originY: 0.5 });
      return;
    }
    const id = window.setTimeout(
      () => setPhase(phase === "glow" ? "spin" : "reveal"),
      phase === "glow" ? GLOW_MS : SPIN_MS
    );
    return () => window.clearTimeout(id);
  }, [phase]);
  if (!pet) return null;
  const info = FORM_INFO[celebration.form];
  const revealed = phase === "reveal";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${pet.name} grew up!`}
      data-testid="evolution"
      data-phase={phase}
      className={`fixed inset-0 z-40 grid place-items-center overflow-hidden bg-slate-950/95 p-5 ${SAFE_INSETS}`}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-3 text-center text-amber-50">
        <p className="text-4xl font-black drop-shadow-lg">
          {revealed ? `${pet.name} grew up!` : "Something is happening..."}
        </p>
        <div className="relative grid size-80 place-items-center sm:size-96">
          <span
            aria-hidden="true"
            className={`fl-evo-glow pointer-events-none absolute inset-0 rounded-full ${
              phase === "glow" ? "fl-evo-glow-out" : ""
            } ${phase === "spin" ? "fl-evo-glow-full" : ""} ${
              revealed ? "fl-evo-flash" : ""
            }`}
          />
          <div className={phase === "spin" ? "fl-evo-spin" : ""}>
            <Blob
              look={pet.look}
              worn={pet.worn}
              form={revealed ? celebration.form : null}
              mood={revealed ? "excited" : "happy"}
              stage={stageFor(pet.level).id}
              className="size-72 sm:size-80"
            />
          </div>
        </div>
        {revealed && (
          <div
            data-testid="evolution-name"
            className="fl-card-in flex flex-col items-center gap-1 rounded-3xl bg-gradient-to-b from-amber-100 to-orange-200 px-8 py-4 text-stone-900 shadow-2xl dark:from-slate-800 dark:to-indigo-950 dark:text-amber-50"
          >
            <span aria-hidden="true" className="text-6xl">
              {info.glyph}
            </span>
            <span className="text-3xl font-black">{info.name} Blaze</span>
            <span className="text-base font-bold opacity-80">{info.blurb}</span>
          </div>
        )}
        {revealed && (
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            className={PRIMARY_BUTTON}
          >
            Yay!
          </button>
        )}
      </div>
    </div>
  );
}

/** "<friend> visited!": their pet, and what the visit paid. */
function VisitedCard({
  celebration,
}: {
  celebration: Extract<Celebration, { kind: "visited" }>;
}) {
  const dismiss = useFlamelings((s) => s.dismissCelebration);
  const petName = useFlamelings(
    (s) => s.save.pets.find((p) => p.id === celebration.petId)?.name
  );
  useEffect(() => {
    playSound("arrive");
    void burstConfetti();
  }, [celebration]);
  if (!petName) return null;
  const name = onlineName(celebration.friend.card.nameId);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} visited ${petName}!`}
      data-testid="visited"
      className={`fixed inset-0 z-40 grid place-items-center bg-black/60 ${SAFE_INSETS}`}
    >
      <div className="fl-card-in mx-4 flex w-[calc(100%-2rem)] max-w-md flex-col items-center gap-3 rounded-[2rem] bg-gradient-to-b from-amber-100 to-orange-200 p-6 text-center text-stone-900 shadow-2xl dark:from-slate-800 dark:to-indigo-950 dark:text-amber-50">
        <p className="text-4xl font-black">
          <span aria-hidden="true">🎉 </span>
          {name} visited!
        </p>
        <CardBlob
          card={celebration.friend.card}
          mood="excited"
          className="size-44"
        />
        <p
          role="img"
          aria-label={`${VISITED_REWARD.sparks} sparks and ${VISITED_REWARD.joy} joy`}
          className="flex gap-3 text-3xl font-black"
        >
          <span aria-hidden="true">✨ +{VISITED_REWARD.sparks}</span>
          <span aria-hidden="true">😊 +{VISITED_REWARD.joy}</span>
        </p>
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

/** The "NEW!" level-up, present and relight cards. One shows at a time. */
export default function CelebrationCard({
  celebration,
}: {
  celebration: Celebration;
}) {
  if (celebration.kind === "evolve") {
    return <EvolutionCard key={celebration.petId} celebration={celebration} />;
  }
  if (celebration.kind === "visited") {
    return <VisitedCard celebration={celebration} />;
  }
  return <PlainCard celebration={celebration} />;
}

function PlainCard({
  celebration,
}: {
  celebration: Exclude<Celebration, { kind: "evolve" | "visited" }>;
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
