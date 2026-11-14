interface UpdatePillProps {
  onUpdate: () => void;
  /** Positions the wrapper; the default is bottom centre. */
  className?: string;
  /** Styles the button, so each game can theme it. */
  buttonClassName?: string;
  label?: string;
  testId?: string;
}

const DEFAULT_WRAPPER =
  "pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4";
const DEFAULT_BUTTON =
  "pointer-events-auto min-h-11 touch-manipulation rounded-full border-2 border-sky-500 bg-white px-5 py-2 text-sm font-semibold text-sky-800 shadow-lg hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-sky-400 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800";

/** A small button for the moment a newer version of the game is ready. */
export default function UpdatePill({
  onUpdate,
  className = DEFAULT_WRAPPER,
  buttonClassName = DEFAULT_BUTTON,
  label = "Update ready — tap to update",
  testId = "update-pill",
}: UpdatePillProps) {
  return (
    <div className={className}>
      <button
        type="button"
        data-testid={testId}
        onClick={onUpdate}
        className={buttonClassName}
      >
        {label}
      </button>
    </div>
  );
}
