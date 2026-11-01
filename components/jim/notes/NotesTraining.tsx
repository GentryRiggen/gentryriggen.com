import { useState } from "react";
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
import {
  fmtWeight,
  fmtWeightValue,
  convertWeightsInText,
  loadWeightUnit,
  saveWeightUnit,
  type WeightUnit,
} from "@/lib/jim/weightUnit";

interface NotesTrainingProps {
  data: ViewData;
}

const RECENT_WORKOUTS = 14;

const UNITS: WeightUnit[] = ["lb", "kg"];

interface UnitToggleProps {
  unit: WeightUnit;
  onChange: (unit: WeightUnit) => void;
}

/** lb | kg, a segmented switch. Each half is 44px to tap. */
function UnitToggle({ unit, onChange }: UnitToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Weight unit"
      className="flex justify-end"
    >
      {UNITS.map((u, i) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={unit === u}
          onClick={() => onChange(u)}
          className={`min-h-11 min-w-14 border border-ayu-muted px-4 text-sm font-medium transition-colors! duration-150! ${
            i === 0 ? "rounded-l-full border-r-0" : "rounded-r-full"
          } ${
            unit === u
              ? "bg-ayu-accent text-ayu-bg"
              : "bg-ayu-panel text-ayu-subtle hover:text-ayu-text"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function best(m: Movement, unit: WeightUnit): string | null {
  if (m.bodyweight) {
    return m.maxReps ? `Most ${m.maxReps} ${m.last.repUnit || "reps"}` : null;
  }
  if (!m.heaviest || m.heaviest.weight == null) return null;
  const amount =
    m.heaviest.unit === "in"
      ? `${fmtNum(m.heaviest.weight)}"`
      : fmtWeight(m.heaviest.weight, unit);
  return `Best ${amount} ×${m.heaviest.reps ?? "?"}`;
}

/** Training: recent workouts and each movement's bests. */
export default function NotesTraining({ data }: NotesTrainingProps) {
  const [unit, setUnit] = useState(loadWeightUnit);
  const wods = data.training.workouts
    .filter((w) => typeof w?.date === "string")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_WORKOUTS);
  const moves = movementBests(data.training.lifts);

  function chooseUnit(next: WeightUnit) {
    setUnit(next);
    saveWeightUnit(next);
  }

  return (
    <div className="space-y-8">
      <UnitToggle unit={unit} onChange={chooseUnit} />
      {/* Side by side where the page is wide. */}
      <div className="space-y-8 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-6 @2xl:space-y-0">
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
                        {convertWeightsInText(w.score, unit)}
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
                      {convertWeightsInText(w.workout, unit)}
                    </p>
                  )}
                  {w.note && (
                    <p className="mt-1 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                      {convertWeightsInText(w.note, unit)}
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
                const top = best(m, unit);
                return (
                  <li key={m.name} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-medium text-ayu-text [overflow-wrap:anywhere]">
                        {m.name}
                      </span>
                      {m.est1rm != null && (
                        <span className="shrink-0 text-sm text-ayu-accent">
                          Est. 1RM {fmtWeight(m.est1rm, unit)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                      Last {fmtWhen(m.last.date)}: {setText(m.last, unit)}
                      {m.last.kind === "wod" ? " in a WOD" : ""}
                      {top ? ` · ${top}` : ""}
                    </p>
                    {m.repMax.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.repMax.map((r) => (
                          <Chip key={r.reps} tone="cyan">
                            {`${r.reps}RM ${fmtWeightValue(r.weight, unit)}`}
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
    </div>
  );
}
