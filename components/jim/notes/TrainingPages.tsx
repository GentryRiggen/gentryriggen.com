"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  BackLink,
  Chip,
  Empty,
  OpenLink,
  Rows,
  Section,
  Stat,
} from "@/components/jim/notes/NotesUi";
import Sparkline from "@/components/jim/notes/Sparkline";
import YearHeat from "@/components/jim/notes/YearHeat";
import { fmtNum, fmtWhen, setText } from "@/lib/jim/notesData";
import { movementSlug } from "@/lib/jim/routes";
import {
  isFullDay,
  movementPage,
  neighborDays,
  prLifts,
  trainingDays,
  yearWeeks,
  type HeatLevel,
} from "@/lib/jim/training";
import { daysBetween, fmtDay, fmtShort } from "@/lib/jim/todos";
import type { Lift, TrainingData, Workout } from "@/lib/jim/view";
import {
  convertWeightsInText,
  fmtWeight,
  fmtWeightValue,
  loadWeightUnit,
  type WeightUnit,
} from "@/lib/jim/weightUnit";

/**
 * Training's own pages: one movement (history, rep maxes, PRs, est. 1RM
 * trend, a year of calendar) and one day (its workouts and lifts).
 */

export interface TrainingLinks {
  onOpenMovement: (slug: string) => void;
  movementHref?: (slug: string) => string;
  onOpenDay: (date: string) => void;
  dayHref?: (date: string) => string;
}

interface BackProps {
  onBack: () => void;
  backLabel: string;
  backHref?: string;
  backAside?: ReactNode;
}

const LINK =
  "inline-flex min-h-11 items-center text-ayu-accent hover:underline";

function ago(date: string, today: string): string {
  if (!isFullDay(date)) return "";
  const n = daysBetween(date, today);
  return n <= 0 ? "today" : `${n}d ago`;
}

function amount(l: Lift, unit: WeightUnit): string {
  if (l.weight == null) return "";
  return l.unit === "in" ? `${fmtNum(l.weight)}"` : fmtWeight(l.weight, unit);
}

/** A day as a link to its page, or plain text when only the month is known. */
function DayLink({ date, links }: { date: string; links: TrainingLinks }) {
  if (!isFullDay(date)) return <span>{fmtWhen(date)}</span>;
  return (
    <OpenLink
      href={links.dayHref?.(date)}
      onOpen={() => links.onOpenDay(date)}
      className={`${LINK} text-left`}
    >
      {fmtWhen(date)}
    </OpenLink>
  );
}

interface MovementProps extends BackProps {
  training: TrainingData;
  slug: string;
  today: string;
  links: TrainingLinks;
}

export function TrainingMovement({
  training,
  slug,
  today,
  links,
  ...back
}: MovementProps) {
  const [unit] = useState(loadWeightUnit);
  const page = useMemo(
    () => movementPage(training.lifts, slug, today),
    [training.lifts, slug, today]
  );
  const prs = useMemo(() => prLifts(training.lifts), [training.lifts]);
  const header = (
    <BackLink
      label={back.backLabel}
      onBack={back.onBack}
      href={back.backHref}
      aside={back.backAside}
    />
  );
  if (!page) {
    return (
      <article className="space-y-5">
        {header}
        <Empty>That movement isn&apos;t in the lift log.</Empty>
      </article>
    );
  }
  const { movement: m, rows, trend, trendTrimmed } = page;
  const byDay = new Map<string, Lift[]>();
  for (const l of rows) {
    if (isFullDay(l.date)) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
  }
  const level = (d: string): HeatLevel => {
    const ls = byDay.get(d);
    if (!ls) return 0;
    if (ls.some((l) => prs.has(l))) return 3;
    return ls.some((l) => l.kind === "strength") ? 2 : 1;
  };
  const weeks = yearWeeks(today, level);
  const daysThisYear = weeks
    .flatMap((w) => w.days)
    .filter((d) => d && d.level > 0).length;
  const lastAgo = ago(m.last.date, today);

  return (
    <article className="space-y-8">
      <div className="space-y-3">
        {header}
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text [overflow-wrap:anywhere]">
          {m.name}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Last done"
          value={
            isFullDay(m.last.date)
              ? fmtShort(m.last.date)
              : fmtWhen(m.last.date)
          }
          detail={`${setText(m.last, unit)}${lastAgo ? ` · ${lastAgo}` : ""}`}
        />
        <Stat label="Entries" value={m.entries} />
        {m.bodyweight ? (
          m.maxReps ? (
            <Stat
              label={`Most ${m.last.repUnit || "reps"}`}
              value={m.maxReps}
            />
          ) : null
        ) : m.heaviest ? (
          <Stat
            label="Heaviest"
            value={amount(m.heaviest, unit)}
            detail={`×${m.heaviest.reps ?? "?"} · ${fmtWhen(m.heaviest.date)}`}
          />
        ) : null}
        {m.est1rm != null && (
          <Stat
            label="Est. 1RM"
            value={fmtWeight(Math.round(m.est1rm), unit)}
          />
        )}
      </div>

      <Section title="Past year" aside={`${daysThisYear} days`}>
        <YearHeat
          weeks={weeks}
          label={`${m.name}: done on ${daysThisYear} ${daysThisYear === 1 ? "day" : "days"} in the past year`}
          legend={["In a WOD", "Strength", "A PR"]}
        />
      </Section>

      {m.repMax.length > 0 && (
        <Section title="Rep maxes">
          <div className="grid grid-cols-3 gap-2 @md:grid-cols-5">
            {m.repMax.map((r) => {
              const inner = (
                <>
                  <span className="text-xs text-ayu-subtle">{r.reps}RM</span>
                  <span className="jim-figure text-lg font-semibold tabular-nums">
                    {fmtWeightValue(r.weight, unit)}
                  </span>
                  <span className="text-xs text-ayu-subtle">
                    {fmtWhen(r.date)}
                  </span>
                </>
              );
              const box =
                "jim-card flex min-h-11 flex-col items-start px-3 py-2 text-left";
              return isFullDay(r.date) ? (
                <OpenLink
                  key={r.reps}
                  href={links.dayHref?.(r.date)}
                  onOpen={() => links.onOpenDay(r.date)}
                  className={`${box} hover:bg-white/[0.04]`}
                >
                  {inner}
                </OpenLink>
              ) : (
                <div key={r.reps} className={box}>
                  {inner}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {trend.length > 1 && (
        <Section
          title="Est. 1RM trend"
          aside={trendTrimmed ? "Past year" : undefined}
        >
          <div className="jim-card px-4 py-3">
            <Sparkline
              points={trend}
              label={`Estimated one-rep max over ${trend.length} days, from ${fmtWeight(trend[0].v, unit)} to ${fmtWeight(trend[trend.length - 1].v, unit)}`}
            />
          </div>
        </Section>
      )}

      <Section title="Every entry" aside={rows.length}>
        <Rows>
          {rows.map((l, i) => (
            <li key={`${l.date}-${i}`} className="px-4 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <DayLink date={l.date} links={links} />
                <span className="flex items-center gap-2 text-ayu-text">
                  {setText(l, unit)}
                  {prs.has(l) && <Chip tone="green">PR</Chip>}
                  {l.kind === "wod" && <Chip>WOD</Chip>}
                </span>
              </div>
              {l.note && (
                <p className="pb-1.5 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                  {convertWeightsInText(l.note, unit)}
                </p>
              )}
            </li>
          ))}
        </Rows>
      </Section>
    </article>
  );
}

function WorkoutCard({ w, unit }: { w: Workout; unit: WeightUnit }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm text-ayu-subtle">{w.type}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-ayu-text">
            {convertWeightsInText(w.score, unit)}
          </span>
          {w.rx && (
            <Chip tone={/^rx/i.test(w.rx) ? "green" : "plain"}>{w.rx}</Chip>
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
    </>
  );
}

interface DayProps extends BackProps {
  training: TrainingData;
  date: string;
  links: TrainingLinks;
}

export function TrainingDayPage({ training, date, links, ...back }: DayProps) {
  const [unit] = useState(loadWeightUnit);
  const days = useMemo(() => trainingDays(training), [training]);
  const prs = useMemo(() => prLifts(training.lifts), [training.lifts]);
  const day = days.get(date);
  const { prev, next } = neighborDays(days, date);

  return (
    <article className="space-y-6">
      <div className="space-y-3">
        <BackLink
          label={back.backLabel}
          onBack={back.onBack}
          href={back.backHref}
          aside={back.backAside}
        />
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text">
          {fmtDay(date)} {date.slice(0, 4)}
        </h2>
        {(prev || next) && (
          <nav
            aria-label="Other training days"
            className="flex justify-between gap-3"
          >
            {prev ? (
              <OpenLink
                href={links.dayHref?.(prev)}
                onOpen={() => links.onOpenDay(prev)}
                className={LINK}
              >
                ‹ {fmtShort(prev)}
              </OpenLink>
            ) : (
              <span />
            )}
            {next && (
              <OpenLink
                href={links.dayHref?.(next)}
                onOpen={() => links.onOpenDay(next)}
                className={LINK}
              >
                {fmtShort(next)} ›
              </OpenLink>
            )}
          </nav>
        )}
      </div>

      {!day ? (
        <Empty>Nothing logged that day.</Empty>
      ) : (
        <>
          {day.workouts.length > 0 && (
            <Section title="Workouts">
              <Rows>
                {day.workouts.map((w, i) => (
                  <li key={i} className="px-4 py-3">
                    <WorkoutCard w={w} unit={unit} />
                  </li>
                ))}
              </Rows>
            </Section>
          )}
          {day.lifts.length > 0 && (
            <Section title="Lifts and movements">
              <Rows>
                {day.lifts.map((l, i) => (
                  <li key={i} className="px-4 py-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3">
                      <OpenLink
                        href={links.movementHref?.(movementSlug(l.movement))}
                        onOpen={() =>
                          links.onOpenMovement(movementSlug(l.movement))
                        }
                        className={`${LINK} text-left`}
                      >
                        {l.movement}
                      </OpenLink>
                      <span className="flex items-center gap-2 text-ayu-text">
                        {setText(l, unit)}
                        {prs.has(l) && <Chip tone="green">PR</Chip>}
                        {l.kind === "wod" && <Chip>WOD</Chip>}
                      </span>
                    </div>
                    {l.note && (
                      <p className="pb-1.5 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                        {convertWeightsInText(l.note, unit)}
                      </p>
                    )}
                  </li>
                ))}
              </Rows>
            </Section>
          )}
        </>
      )}
    </article>
  );
}
