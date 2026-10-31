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
          className="text-sm font-semibold tracking-wide text-ayu-accent uppercase"
        >
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
}

/** A tile with one big number. */
export function Stat({ label, value, detail }: StatProps) {
  return (
    <div className="min-w-0 rounded-xl bg-ayu-panel px-4 py-3">
      <p className="text-sm text-ayu-subtle">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-ayu-text">{value}</p>
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
  return <p className="text-ayu-subtle">{children}</p>;
}

/** The list every page uses: rows on a panel, split by hairlines. */
export function Rows({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-ayu-line overflow-hidden rounded-xl bg-ayu-panel">
      {children}
    </ul>
  );
}

interface ChipProps {
  children: ReactNode;
  tone?: "plain" | "red" | "green" | "blue" | "purple" | "cyan";
}

const CHIP_TONES: Record<NonNullable<ChipProps["tone"]>, string> = {
  plain: "bg-ayu-line text-ayu-text",
  red: "bg-ayu-red/15 text-ayu-red",
  green: "bg-ayu-green/10 text-ayu-green",
  blue: "bg-ayu-blue/10 text-ayu-blue",
  purple: "bg-ayu-purple/10 text-ayu-purple",
  cyan: "bg-ayu-cyan/10 text-ayu-cyan",
};

export function Chip({ children, tone = "plain" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
