import { flamelingsChannels } from "./audio/sound";
import FlIcon from "./FlIcon";
import { STICKER_BUTTON } from "./styles";

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
      className={`${STICKER_BUTTON} size-16 shrink-0 ${className}`}
    >
      <FlIcon name={isOn ? "sound-on" : "sound-off"} className="size-8" />
    </button>
  );
}
