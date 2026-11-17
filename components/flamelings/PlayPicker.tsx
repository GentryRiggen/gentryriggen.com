import type { PlayGame } from "@/lib/flamelings/types";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import FlIcon from "./FlIcon";
import {
  DIALOG_BACKDROP,
  DISPLAY,
  FOCUS_RING,
  PEACH_BUTTON,
  TRAY,
} from "./styles";

const GAMES: { id: PlayGame; icon: string; label: string; tone: string }[] = [
  {
    id: "fireflies",
    icon: "🦋",
    label: "Firefly Catch",
    tone: "from-[#e4f9c8] to-[#a8e6b4] text-[#1f5a3a] shadow-[0_5px_0_#6fbf86,0_10px_20px_rgba(30,10,40,.18)]",
  },
  {
    id: "marshmallow",
    icon: "🍡",
    label: "Marshmallow Toast",
    tone: "from-[#ffe4ec] to-[#ffc9a8] text-[#7a2d1c] shadow-[0_5px_0_#e79a7a,0_10px_20px_rgba(30,10,40,.18)]",
  },
  {
    id: "logs",
    icon: "🪵",
    label: "Log Stack",
    tone: "from-[#ffeab0] to-[#ffc76b] text-[#6b3a10] shadow-[0_5px_0_#d9952a,0_10px_20px_rgba(30,10,40,.18)]",
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
      className={`fl-fade-in fixed inset-0 z-20 flex items-end justify-center overflow-y-auto p-3 sm:items-center ${DIALOG_BACKDROP} ${SAFE_INSETS}`}
    >
      <div
        className={`${TRAY} mb-1 flex w-full min-w-0 max-w-3xl flex-col items-center gap-4 p-4 sm:p-5`}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <p
            role="img"
            className={`${DISPLAY} flex min-h-12 items-center rounded-full bg-[#2a1d47] px-5 text-2xl font-bold text-[#ffe58a] shadow-[inset_0_-3px_0_rgba(0,0,0,.25)]`}
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${PEACH_BUTTON} size-16`}
          >
            <FlIcon name="close" className="size-8" />
          </button>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 min-[560px]:grid-cols-3">
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => onPick(game.id)}
              data-testid={`play-${game.id}`}
              className={`${DISPLAY} flex min-h-28 min-w-0 flex-row items-center justify-center gap-4 rounded-[28px] bg-gradient-to-b p-4 text-2xl font-semibold transition-transform active:translate-y-[3px] min-[560px]:min-h-52 min-[560px]:flex-col ${game.tone} ${FOCUS_RING}`}
            >
              <span
                aria-hidden="true"
                className="text-6xl leading-none min-[560px]:text-8xl"
              >
                {game.icon}
              </span>
              <span>{game.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
