import { Chip, Empty, Rows, Section } from "@/components/jim/notes/NotesUi";
import {
  fmtNum,
  fmtWhen,
  movementBests,
  setText,
  type Movement,
} from "@/lib/jim/notesData";
import { fmtDay } from "@/lib/jim/todos";
import type { ViewData } from "@/lib/jim/view";

interface NotesTrainingProps {
  data: ViewData;
}

const RECENT_WORKOUTS = 14;

function best(m: Movement): string | null {
  if (m.bodyweight) {
    return m.maxReps ? `Most ${m.maxReps} ${m.last.repUnit || "reps"}` : null;
  }
  if (!m.heaviest || m.heaviest.weight == null) return null;
  const unit = m.heaviest.unit === "in" ? '"' : " lb";
  return `Best ${fmtNum(m.heaviest.weight)}${unit} ×${m.heaviest.reps ?? "?"}`;
}

/** Training: recent workouts and each movement's bests. */
export default function NotesTraining({ data }: NotesTrainingProps) {
  const wods = data.training.workouts
    .filter((w) => typeof w?.date === "string")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_WORKOUTS);
  const moves = movementBests(data.training.lifts);

  return (
    <div className="space-y-8">
      <Section title="Recent workouts">
        {wods.length === 0 ? (
          <Empty>No workouts logged yet.</Empty>
        ) : (
          <Rows>
            {wods.map((w, i) => (
              <li key={`${w.date}-${i}`} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-sm text-ayu-subtle">
                    {w.date.length === 10 ? fmtDay(w.date) : w.date}
                    {w.type ? ` · ${w.type}` : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold text-ayu-text">
                      {w.score}
                    </span>
                    {w.rx && (
                      <Chip tone={/^rx/i.test(w.rx) ? "green" : "plain"}>
                        {w.rx}
                      </Chip>
                    )}
                  </span>
                </div>
                {w.workout && (
                  <p className="mt-1 text-ayu-text [overflow-wrap:anywhere]">
                    {w.workout}
                  </p>
                )}
                {w.note && (
                  <p className="mt-1 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                    {w.note}
                  </p>
                )}
              </li>
            ))}
          </Rows>
        )}
      </Section>

      <Section
        title="Movements"
        aside={moves.length ? `${moves.length} tracked` : undefined}
      >
        {moves.length === 0 ? (
          <Empty>No lifts logged yet.</Empty>
        ) : (
          <Rows>
            {moves.map((m) => {
              const top = best(m);
              return (
                <li key={m.name} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium text-ayu-text [overflow-wrap:anywhere]">
                      {m.name}
                    </span>
                    {m.est1rm != null && (
                      <span className="shrink-0 text-sm text-ayu-accent">
                        Est. 1RM {fmtNum(m.est1rm)} lb
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                    Last {fmtWhen(m.last.date)}: {setText(m.last)}
                    {m.last.kind === "wod" ? " in a WOD" : ""}
                    {top ? ` · ${top}` : ""}
                  </p>
                  {m.repMax.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.repMax.map((r) => (
                        <Chip key={r.reps} tone="cyan">
                          {`${r.reps}RM ${fmtNum(r.weight)}`}
                        </Chip>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </Rows>
        )}
      </Section>
    </div>
  );
}
