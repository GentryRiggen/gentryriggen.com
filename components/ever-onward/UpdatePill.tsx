interface UpdatePillProps {
  onUpdate: () => void;
}

/** A small button for the moment a newer version of the game is ready. */
export default function UpdatePill({ onUpdate }: UpdatePillProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <button
        type="button"
        data-testid="eo-update"
        onClick={onUpdate}
        className="pointer-events-auto min-h-11 rounded-full border-2 border-amber-300 bg-slate-950 px-5 py-2 text-sm font-semibold text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.45)] hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Update ready ✨ — tap to update
      </button>
    </div>
  );
}
