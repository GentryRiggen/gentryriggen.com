import { ONLINE_NAMES } from "@/lib/flamelings/online/names";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import { BIG_BUTTON, FOCUS_RING } from "../styles";

interface NamePickerProps {
  selected: number;
  onPick: (nameId: number) => void;
  onClose: () => void;
}

/** Big name chips: friends see one of these, never a typed name. */
export default function NamePicker({
  selected,
  onPick,
  onClose,
}: NamePickerProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick the name friends see"
      data-testid="name-picker"
      className={`fixed inset-0 z-30 flex flex-col bg-indigo-950/95 p-4 text-white ${SAFE_INSETS}`}
    >
      <div className="flex items-center justify-between gap-3 py-2">
        <p className="text-2xl font-black">
          <span aria-hidden="true">🏷️ </span>Pick a name
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`${BIG_BUTTON} bg-white px-5 text-2xl text-stone-900`}
        >
          <span aria-hidden="true">✖️</span>
        </button>
      </div>
      <div className="flex flex-1 flex-wrap content-start gap-2 overflow-y-auto py-2">
        {ONLINE_NAMES.map((name, id) => (
          <button
            key={name}
            type="button"
            aria-pressed={id === selected}
            onClick={() => onPick(id)}
            className={`min-h-14 rounded-full px-5 text-xl font-extrabold shadow-md active:scale-95 ${FOCUS_RING} ${
              id === selected
                ? "bg-orange-400 text-stone-900"
                : "bg-white/90 text-stone-900"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
