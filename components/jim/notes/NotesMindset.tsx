import { Empty, Rows, Section } from "@/components/jim/notes/NotesUi";
import { fmtDay, stripMd } from "@/lib/jim/todos";
import type { ViewData } from "@/lib/jim/view";

const FULL_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Mindset: the practice's counts, today's intention, threads and recent sessions. */
export default function NotesMindset({ data }: { data: ViewData }) {
  const m = data.mindset;
  if (!m) {
    return (
      <Empty>
        No mindset sessions yet. They show here once Jim sends them.
      </Empty>
    );
  }
  const max = Math.max(1, ...m.threads.map((t) => t.count));
  return (
    <div className="space-y-8">
      {/* One card, three figures: three tiles don't fit 320px. */}
      <dl className="jim-card grid grid-cols-3 divide-x divide-white/[0.06] py-3.5">
        {(
          [
            ["Sessions", m.sessions],
            ["Day streak", m.streak],
            ["Reflections", m.reflections],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex min-w-0 flex-col-reverse items-center px-1 text-center"
          >
            <dt className="text-xs text-ayu-subtle">{label}</dt>
            <dd className="jim-figure text-3xl font-semibold tracking-tight tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {m.intention && (
        <Section title="Intention">
          <blockquote className="jim-card px-4 py-3.5 text-lg text-ayu-text [overflow-wrap:anywhere]">
            “{stripMd(m.intention)}”
          </blockquote>
        </Section>
      )}

      {m.threads.length > 0 && (
        <Section title="Threads that keep returning">
          <ul
            aria-label="Threads by mentions"
            className="jim-card space-y-2.5 px-4 py-3.5"
          >
            {m.threads.map((t) => (
              <li key={t.name} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
                    {t.name}
                  </span>
                  <span className="shrink-0 text-ayu-subtle tabular-nums">
                    {t.count}
                    <span className="sr-only">
                      {t.count === 1 ? " mention" : " mentions"}
                    </span>
                  </span>
                </div>
                <progress
                  value={t.count}
                  max={max}
                  aria-hidden="true"
                  className="block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-white/[0.06] [&::-moz-progress-bar]:bg-ayu-accent [&::-webkit-progress-bar]:bg-white/[0.06] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-ayu-accent"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recent sessions">
        {m.recent.length ? (
          <Rows>
            {m.recent.map((r, i) => (
              <li key={`${r.date}-${i}`} className="px-4 py-3">
                <p className="text-sm text-ayu-subtle">
                  {FULL_DAY.test(r.date) ? fmtDay(r.date) : r.date}
                </p>
                <p className="mt-0.5 text-ayu-text [overflow-wrap:anywhere]">
                  {stripMd(r.text)}
                </p>
              </li>
            ))}
          </Rows>
        ) : (
          <Empty>No sessions yet.</Empty>
        )}
      </Section>
    </div>
  );
}
