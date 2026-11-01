export interface Spend {
  id: number;
  text: string;
}

interface SpendFloaterProps {
  spend: Spend | null;
}

/** The amount just paid, drifting down from the counter it came out of. */
export default function SpendFloater({ spend }: SpendFloaterProps) {
  if (!spend) return null;
  return (
    <span
      key={spend.id}
      aria-hidden="true"
      data-testid="lm-spend"
      className="lm-spend pointer-events-none absolute right-3 top-full z-10 text-sm font-bold tabular-nums text-red-500 dark:text-red-400"
    >
      {spend.text}
    </span>
  );
}
