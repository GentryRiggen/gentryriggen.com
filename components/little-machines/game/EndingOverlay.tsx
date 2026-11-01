import { primaryButtonClass } from "../styles";

interface EndingOverlayProps {
  /** The closing lines, in order. */
  lines: readonly string[];
  onContinue: () => void;
}

/** Fixed classes so Tailwind sees them; line i appears after DELAYS[i]. */
const DELAYS = [
  "[animation-delay:1s]",
  "[animation-delay:4.5s]",
  "[animation-delay:8s]",
  "[animation-delay:11s]",
];

export default function EndingOverlay({
  lines,
  onContinue,
}: EndingOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The ending"
      data-testid="lm-ending"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black p-6 text-slate-50"
    >
      <div className="relative max-w-md space-y-6 py-8 text-center">
        <div
          aria-hidden="true"
          className="lm-flicker mx-auto h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_40px_14px_rgb(251_191_36/0.45)]"
        />
        {lines.map((line, i) => (
          <p
            key={line}
            className={`lm-fade-up text-lg text-slate-200 ${DELAYS[Math.min(i, DELAYS.length - 2)]}`}
          >
            {line}
          </p>
        ))}
        <div className={`lm-fade-up ${DELAYS[DELAYS.length - 1]}`}>
          <button
            type="button"
            onClick={onContinue}
            className={`${primaryButtonClass} min-w-40 !ring-offset-black`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
