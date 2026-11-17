import { flamelingsChannels } from "./audio/sound";
import { FOCUS_RING } from "./styles";

/** A big icon button: sound on or off. */
export default function SoundToggle({
  className = "",
}: {
  className?: string;
}) {
  const isOn = flamelingsChannels.effects.useValue();
  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={isOn ? "Sound on" : "Sound off"}
      data-testid="sound-toggle"
      onClick={() => flamelingsChannels.effects.set(!isOn)}
      className={`grid size-16 shrink-0 place-items-center rounded-3xl bg-white/90 text-3xl shadow-lg active:scale-95 dark:bg-slate-800/90 ${FOCUS_RING} ${className}`}
    >
      <span aria-hidden="true">{isOn ? "🔊" : "🔇"}</span>
    </button>
  );
}
