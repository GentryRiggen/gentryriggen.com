import { useId, type ReactNode } from "react";

/**
 * Small shared pieces for the Notes pages (Ayu Mirage tokens throughout).
 */

interface SectionProps {
  title: string;
  /** Shown quietly to the right of the title. */
  aside?: ReactNode;
  children: ReactNode;
}

/** A titled region of a page. */
export function Section({ title, aside, children }: SectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={id}
          className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ayu-subtle uppercase"
        >
          <span
            aria-hidden="true"
            className="h-3 w-1 rounded-full bg-gradient-to-b from-ayu-accent to-ayu-orange"
          />
          {title}
        </h2>
        {aside && (
          <span className="min-w-0 text-right text-sm text-ayu-subtle">
            {aside}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Colors the number: green for good, red for bad. */
  tone?: "good" | "bad" | "";
}

const STAT_TONES = {
  good: "text-ayu-green",
  bad: "text-ayu-red",
  "": "jim-figure",
};

/** A tile with one big number. */
export function Stat({ label, value, detail, tone = "" }: StatProps) {
  return (
    <div className="jim-card relative min-w-0 overflow-hidden px-4 py-3.5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-24 rounded-full bg-ayu-accent/10 blur-2xl"
      />
      <p className="text-sm text-ayu-subtle">{label}</p>
      <p
        className={`${STAT_TONES[tone]} mt-1 text-3xl font-semibold tracking-tight tabular-nums`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-0.5 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
          {detail}
        </p>
      )}
    </div>
  );
}

/** A calm line where a list would be. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="jim-card border-dashed! px-4 py-3.5 text-ayu-subtle shadow-none!">
      {children}
    </p>
  );
}

/** The list every page uses: rows on a panel, split by hairlines. */
export function Rows({ children }: { children: ReactNode }) {
  return (
    <ul className="jim-card divide-y divide-white/[0.05] overflow-hidden">
      {children}
    </ul>
  );
}

interface ChipProps {
  children: ReactNode;
  tone?: "plain" | "red" | "green" | "blue" | "purple" | "cyan";
}

const CHIP_TONES: Record<NonNullable<ChipProps["tone"]>, string> = {
  plain: "bg-white/[0.06] text-ayu-text ring-white/10",
  red: "bg-ayu-red/12 text-ayu-red ring-ayu-red/25",
  green: "bg-ayu-green/10 text-ayu-green ring-ayu-green/20",
  blue: "bg-ayu-blue/10 text-ayu-blue ring-ayu-blue/20",
  purple: "bg-ayu-purple/10 text-ayu-purple ring-ayu-purple/20",
  cyan: "bg-ayu-cyan/10 text-ayu-cyan ring-ayu-cyan/20",
};

export function Chip({ children, tone = "plain" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
