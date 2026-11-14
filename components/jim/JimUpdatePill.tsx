interface JimUpdatePillProps {
  onUpdate: () => void;
  /** A turn is streaming: reloading now would cut it off. */
  disabled?: boolean;
}

/**
 * "Update ready" for the home-screen app. Sits at the top of the message
 * area, clear of the header, the composer and the now-playing bar.
 */
export default function JimUpdatePill({
  onUpdate,
  disabled = false,
}: JimUpdatePillProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-4">
      <button
        type="button"
        data-testid="jim-update"
        onClick={onUpdate}
        disabled={disabled}
        className="jim-card pointer-events-auto min-h-11 rounded-full! px-5 py-2 text-sm font-semibold text-ayu-accent shadow-[0_0_18px_rgb(255_204_102/0.25)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ayu-accent focus-visible:outline-none disabled:opacity-60"
      >
        {disabled
          ? "Update ready ✨ — after this reply"
          : "Update ready ✨ — tap to update"}
      </button>
    </div>
  );
}
