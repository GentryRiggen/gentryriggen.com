import type { PlayGame } from "@/lib/flamelings/types";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import { BIG_BUTTON, FOCUS_RING } from "./styles";

const GAMES: { id: PlayGame; icon: string; label: string; tone: string }[] = [
  {
    id: "fireflies",
    icon: "🦋",
    label: "Firefly Catch",
    tone: "from-lime-200 to-emerald-300 text-emerald-950",
  },
  {
    id: "marshmallow",
    icon: "🍡",
    label: "Marshmallow Toast",
    tone: "from-pink-100 to-orange-200 text-orange-950",
  },
  {
    id: "logs",
    icon: "🪵",
    label: "Log Stack",
    tone: "from-amber-200 to-amber-400 text-amber-950",
  },
];

interface PlayPickerProps {
  /** Paying rounds left in this check-in window (0 shows a sleeping badge). */
  roundsLeft: number;
  onPick: (game: PlayGame) => void;
  onClose: () => void;
}

/** Three big pictures to pick a game from: no reading needed. */
export default function PlayPicker({
  roundsLeft,
  onPick,
  onClose,
}: PlayPickerProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a game"
      data-testid="play-picker"
      className={`fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-indigo-950/90 p-4 backdrop-blur-sm ${SAFE_INSETS}`}
    >
      <div className="flex w-full max-w-3xl flex-col items-center gap-4">
        <p
          className="rounded-full bg-black/40 px-5 py-2 text-2xl font-black text-white"
          aria-label={
            roundsLeft > 0
              ? `${roundsLeft} sparkly rounds left`
              : "No sparkly rounds left, but playing still cheers up your flameling"
          }
          data-testid="play-rounds-left"
        >
          <span aria-hidden="true">
            {roundsLeft > 0 ? "✨".repeat(roundsLeft) : "💤"}
          </span>
        </p>
        <div className="grid w-full grid-cols-1 gap-4 min-[560px]:grid-cols-3">
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => onPick(game.id)}
              data-testid={`play-${game.id}`}
              className={`flex min-h-32 flex-row items-center justify-center gap-4 rounded-[2rem] bg-gradient-to-b p-5 text-xl font-black shadow-xl transition-transform active:scale-95 min-[560px]:min-h-56 min-[560px]:flex-col ${game.tone} ${FOCUS_RING}`}
            >
              <span
                aria-hidden="true"
                className="text-7xl leading-none min-[560px]:text-8xl"
              >
                {game.icon}
              </span>
              <span>{game.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`${BIG_BUTTON} bg-white/90 px-8 text-3xl text-stone-900`}
        >
          <span aria-hidden="true">✖️</span>
        </button>
      </div>
    </div>
  );
}
