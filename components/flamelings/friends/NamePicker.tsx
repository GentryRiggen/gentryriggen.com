import { ONLINE_NAMES } from "@/lib/flamelings/online/names";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import FlIcon from "../FlIcon";
import {
  DIALOG_BACKDROP,
  DISPLAY,
  STICKER,
  PEACH_BUTTON,
  TAB_CHIP,
  TAB_OFF_ON_CREAM,
  TAB_ON,
} from "../styles";

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
      className={`fl-fade-in fixed inset-0 z-30 flex items-center justify-center ${DIALOG_BACKDROP} ${SAFE_INSETS}`}
    >
      <div
        className={`${STICKER} fl-pop-in m-3 flex max-h-[calc(100%-1.5rem)] w-full max-w-3xl flex-col p-4 sm:p-5`}
      >
        <div className="flex items-center justify-between gap-3 pb-2">
          <p className={`${DISPLAY} text-3xl font-bold text-[#7a3d2c]`}>
            <span aria-hidden="true">🏷️ </span>Pick a name
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
        <div className="-mx-1 flex flex-1 flex-wrap content-start gap-2.5 overflow-y-auto px-1 py-2">
          {ONLINE_NAMES.map((name, id) => (
            <button
              key={name}
              type="button"
              aria-pressed={id === selected}
              onClick={() => onPick(id)}
              className={`${TAB_CHIP} ${
                id === selected ? TAB_ON : TAB_OFF_ON_CREAM
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
