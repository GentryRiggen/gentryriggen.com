export interface Effect {
  id: number;
  text: string;
}

interface EffectFloaterProps {
  effect: Effect | null;
  testId?: string;
  /** Read aloud to screen readers (only one copy on screen should). */
  isAnnounced?: boolean;
}

/** What the upgrade just bought changed ("Coins/sec 12 → 17 ⬆"). */
export default function EffectFloater({
  effect,
  testId = "lm-effect",
  isAnnounced = true,
}: EffectFloaterProps) {
  if (!effect) return null;
  return (
    <span
      key={effect.id}
      role={isAnnounced ? "status" : undefined}
      aria-hidden={isAnnounced ? undefined : true}
      data-testid={testId}
      className="lm-effect pointer-events-none absolute left-3 top-full z-10 max-w-[75%] bg-slate-950/90 px-1 font-mono text-sm font-bold tabular-nums text-emerald-300 [text-shadow:1px_1px_0_#022c22]"
    >
      {effect.text}
    </span>
  );
}
