import { DIALOG_BACKDROP, DISPLAY, PRIMARY_BUTTON, STICKER } from "./styles";

interface GameResultProps {
  /** The headline: what the player did. */
  title: string;
  /** A row of pictures under it (decoration). */
  art: string;
  onDone: () => void;
  /** Extra classes for the overlay (its z-index). */
  className?: string;
}

/** The end of a mini-game: a cream card that pops in over the dimmed game. */
export default function GameResult({
  title,
  art,
  onDone,
  className = "",
}: GameResultProps) {
  return (
    <div
      className={`absolute inset-0 grid place-items-center p-6 ${DIALOG_BACKDROP} ${className}`}
    >
      <div
        data-testid="game-result"
        className={`${STICKER} fl-pop-in flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center`}
      >
        <p className={`${DISPLAY} text-3xl font-bold text-[#7a3d2c]`}>
          {title}
        </p>
        <p
          aria-hidden="true"
          className="grid w-full place-items-center rounded-full bg-[radial-gradient(circle,#ffe2b0_0%,rgba(255,226,176,0)_70%)] py-2 text-5xl"
        >
          {art}
        </p>
        <button type="button" onClick={onDone} className={PRIMARY_BUTTON}>
          Done
        </button>
      </div>
    </div>
  );
}
