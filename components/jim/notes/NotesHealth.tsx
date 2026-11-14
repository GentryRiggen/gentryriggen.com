"use client";

import { useState } from "react";
import Sparkline from "@/components/jim/notes/Sparkline";
import {
  Chip,
  Empty,
  Rows,
  Section,
  Stat,
} from "@/components/jim/notes/NotesUi";
import {
  agoText,
  keyMarkerRank,
  nextShot,
  otherSide,
  plans,
  shotsNewestFirst,
  shotTime,
  sideLabel,
  sideOf,
  weekGrid,
  weeklyTotals,
  type WeekDay,
  type WeekTotal,
} from "@/lib/jim/healthPlan";
import { labCards, type LabCard } from "@/lib/jim/notesData";
import { daysBetween, fmtDay, fmtShort } from "@/lib/jim/todos";
import type { DosePlan, Injection, ViewData } from "@/lib/jim/view";

interface NotesHealthProps {
  data: ViewData;
}

/** Injections shown before "Show all". */
const FIRST_INJECTIONS = 6;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "in about 20 days"; it's an estimate, so "about" leads. */
function nextDrawWhen(n: number): string {
  if (n === 0) return "about today";
  if (n === 1) return "about tomorrow";
  return n > 0 ? `in about ${n} days` : `about ${-n} days ago`;
}

function mlText(ml: number | null): string {
  return ml == null ? "" : ` (${ml} mL)`;
}

function LabTile({ card }: { card: LabCard }) {
  const flag = card.latest.flag;
  const value = card.latest.raw.replace(/\s+[HL]\b.*$/, "");
  const trend = card.points
    .map((p) => `${p.v} on ${fmtShort(p.date)}`)
    .join(", ");
  return (
    <article className="jim-card min-w-0 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 font-medium text-ayu-text [overflow-wrap:anywhere]">
          {card.marker}
        </h3>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-ayu-text tabular-nums">
            {value}
          </span>
          {flag && <Chip tone="red">{flag === "H" ? "High" : "Low"}</Chip>}
        </span>
      </div>
      <div className="mt-2">
        <Sparkline
          points={card.points}
          lo={card.lo}
          hi={card.hi}
          label={`${card.marker} trend: ${trend}`}
        />
      </div>
      <p className="mt-1 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
        {fmtShort(card.latest.date)} {card.latest.date.slice(0, 4)}
        {card.range ? ` · range ${card.range}` : ""}
        {card.points.length > 1 ? ` · ${card.points.length} results` : ""}
      </p>
    </article>
  );
}

/** The last shot, big: which side first, then when and how much. */
function LastShot({ shot, today }: { shot: Injection; today: string }) {
  const side = sideOf(shot.site);
  const time = shotTime(shot.time);
  return (
    <Stat
      label="Last injection"
      value={side ? sideLabel(side) : fmtShort(shot.date)}
      detail={
        <>
          <span className="block text-ayu-text">
            {fmtDay(shot.date)}
            {time ? ` · ${time}` : ""}
          </span>
          <span className="block">
            {shot.mg != null ? `${shot.mg} mg` : ""}
            {shot.ml ? ` (${shot.ml} mL)` : ""}
            {shot.mg != null || shot.ml ? " · " : ""}
            {agoText(daysBetween(shot.date, today))}
            {side ? "" : " · site not logged"}
          </span>
        </>
      }
    />
  );
}

/** The next shot from the schedule, and the side to use (the other one). */
function NextShot({
  data,
  last,
}: {
  data: ViewData;
  last: Injection | undefined;
}) {
  const next = nextShot(data.health.schedule, last?.date ?? null, data.today);
  const { current } = plans(data.health.schedule, data.today);
  if (!next) {
    return (
      <Stat
        label="Next injection"
        value="Not set"
        detail={
          current
            ? `${current.label}: no fixed days yet`
            : "No schedule in Jim's notes yet"
        }
      />
    );
  }
  const side = otherSide(sideOf(last?.site));
  const when = next.state === "today" ? "Today" : fmtDay(next.date);
  return (
    <Stat
      label={
        next.state === "overdue"
          ? "Overdue"
          : next.state === "today"
            ? "Due today"
            : "Next injection"
      }
      value={when}
      tone={next.state === "overdue" ? "bad" : ""}
      detail={
        <>
          <span className="block text-ayu-text">
            {next.mg} mg{mlText(next.ml)}
          </span>
          <span className="block">
            {side ? `${sideLabel(side)} (the other side)` : "Alternate sides"}
            {next.state === "overdue"
              ? ` · was due ${agoText(daysBetween(next.date, data.today))}`
              : ""}
          </span>
        </>
      }
    />
  );
}

function dayLabel(d: WeekDay): string {
  const names = d.shots.map((s) => {
    const side = sideOf(s.site);
    return `${side ? sideLabel(side) : "injection"}${s.mg != null ? ` ${s.mg} mg` : ""}`;
  });
  return `${fmtDay(d.date)}: ${
    names.length ? names.join(", ") : d.due ? "injection due" : "no injection"
  }`;
}

/** One day of the week strip: what was done, or what is due. */
function DayCell({ d, today }: { d: WeekDay; today: string }) {
  const shot = d.shots[d.shots.length - 1];
  const side = shot ? sideOf(shot.site) : null;
  const missed = !shot && d.due && d.date < today;
  let mark = "";
  let cls = "text-ayu-subtle";
  if (shot) {
    mark = side === "left" ? "L" : side === "right" ? "R" : "✓";
    cls = "bg-ayu-green/15 text-ayu-green ring-1 ring-ayu-green/30";
  } else if (missed) {
    mark = "!";
    cls = "bg-ayu-red/12 text-ayu-red ring-1 ring-ayu-red/25";
  } else if (d.due) {
    mark = "•";
    cls = "border border-dashed border-ayu-accent/60 text-ayu-accent";
  }
  return (
    <li
      aria-label={dayLabel(d)}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 ${
        d.today ? "bg-white/[0.06] ring-1 ring-ayu-accent/40" : ""
      }`}
    >
      <span className="text-xs text-ayu-subtle" aria-hidden="true">
        {WEEKDAYS[(new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7]}
      </span>
      <span className="text-sm text-ayu-text tabular-nums" aria-hidden="true">
        {Number(d.date.slice(8, 10))}
      </span>
      <span
        aria-hidden="true"
        className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${cls}`}
      >
        {mark}
      </span>
    </li>
  );
}

function PlanLine({ plan, label }: { plan: DosePlan; label: string }) {
  return (
    <li className="px-4 py-2.5">
      <p className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-ayu-text">
          {plan.label || "No days set"}
        </span>
        <span className="shrink-0 text-ayu-text tabular-nums">
          {plan.mg} mg{mlText(plan.ml)}
        </span>
      </p>
      <p className="text-sm text-ayu-subtle [overflow-wrap:anywhere]">
        {label} {fmtShort(plan.from)}
        {plan.days.length ? ` · ${plan.days.length * plan.mg} mg a week` : ""}
        {plan.note ? ` · ${plan.note}` : ""}
      </p>
    </li>
  );
}

/** Milligrams per week, last eight weeks, against the prescription. */
function WeeklyDose({
  weeks,
  prescribed,
}: {
  weeks: WeekTotal[];
  prescribed: number | null;
}) {
  const max = Math.max(1, prescribed ?? 0, ...weeks.map((w) => w.mg));
  const label = `Milligrams per week: ${weeks
    .map((w) => `${fmtShort(w.monday)} ${w.mg}${w.partial ? " so far" : ""}`)
    .join(", ")}${prescribed ? `. Prescribed ${prescribed}` : ""}`;
  return (
    <div className="jim-card px-4 py-3.5">
      <div role="img" aria-label={label} className="relative h-28">
        {prescribed ? (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-ayu-orange/70"
            style={{ bottom: `${(prescribed / max) * 90}%` }}
          />
        ) : null}
        <div className="absolute inset-0 flex items-end gap-1.5">
          {weeks.map((w) => (
            <div
              key={w.monday}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <span
                aria-hidden="true"
                className={`flex w-full justify-center rounded-t pt-0.5 text-xs font-medium tabular-nums ${
                  w.partial
                    ? "bg-ayu-accent/40 text-ayu-text"
                    : "bg-ayu-accent text-ayu-bg"
                }`}
                style={{ height: `${(w.mg / max) * 90}%` }}
              >
                {w.mg || ""}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-1.5">
        {weeks.map((w) => (
          <span
            key={w.monday}
            className="min-w-0 flex-1 text-center text-xs text-ayu-subtle"
          >
            {fmtShort(w.monday).replace(" ", " ")}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-ayu-subtle">
        Weeks start Monday; the dashed line is the prescription
        {prescribed ? ` (${prescribed} mg)` : ""}. The paler bar is this week so
        far.
      </p>
    </div>
  );
}

/** Health: the last shot and the schedule first, then the few labs that matter. */
export default function NotesHealth({ data }: NotesHealthProps) {
  const [allShots, setAllShots] = useState(false);
  const [moreLabs, setMoreLabs] = useState(false);
  const h = data.health;
  const shots = shotsNewestFirst(h.injections);
  const last = shots[0];
  const { current, upcoming } = plans(h.schedule, data.today);
  const weeks = weekGrid(h, data.today, 2);
  const totals = weeklyTotals(h.injections, data.today, 8);
  const cards = labCards(h);
  const key = cards
    .filter((c) => keyMarkerRank(c.marker) >= 0)
    .sort((a, b) => keyMarkerRank(a.marker) - keyMarkerRank(b.marker));
  const rest = cards.filter((c) => keyMarkerRank(c.marker) < 0);
  const shown = allShots ? shots : shots.slice(0, FIRST_INJECTIONS);
  const hold =
    h.hold && !h.draws.some((d) => d.date > (h.hold?.until ?? ""))
      ? h.hold
      : null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {last ? (
          <LastShot shot={last} today={data.today} />
        ) : (
          <Stat label="Last injection" value="None yet" />
        )}
        <NextShot data={data} last={last} />
      </div>

      <Section
        title="Schedule"
        aside={
          h.nextDraw
            ? `Labs ${fmtShort(h.nextDraw)} · ${nextDrawWhen(daysBetween(data.today, h.nextDraw))}`
            : undefined
        }
      >
        <div className="jim-card px-2 py-2">
          {weeks.map((row, i) => (
            <ul
              key={row[0].date}
              aria-label={i === 0 ? "This week" : "Next week"}
              className="grid grid-cols-7 gap-0.5"
            >
              {row.map((d) => (
                <DayCell key={d.date} d={d} today={data.today} />
              ))}
            </ul>
          ))}
        </div>
        <p className="text-sm text-ayu-subtle">
          L and R are the side used, a dot is due, ! is a scheduled day with no
          shot logged.
        </p>
        {current || upcoming ? (
          <Rows>
            {current && <PlanLine plan={current} label="Since" />}
            {upcoming && <PlanLine plan={upcoming} label="Changes" />}
          </Rows>
        ) : null}
      </Section>

      <Section title="Dose each week">
        <WeeklyDose weeks={totals} prescribed={h.prescribedWeekly} />
      </Section>

      <Section
        title="Labs"
        aside={h.draws.length ? `${h.draws.length} draws` : undefined}
      >
        {hold && (
          <p className="jim-card px-4 py-3 text-sm text-ayu-subtle">
            Set aside until the next draw:{" "}
            <span className="text-ayu-text">{hold.markers.join(", ")}</span>
          </p>
        )}
        {cards.length === 0 ? (
          <Empty>No lab results yet.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @4xl:grid-cols-3">
              {(key.length ? key : cards).map((c) => (
                <LabTile key={c.marker} card={c} />
              ))}
              {moreLabs &&
                key.length > 0 &&
                rest.map((c) => <LabTile key={c.marker} card={c} />)}
            </div>
            {key.length > 0 && rest.length > 0 && (
              <button
                type="button"
                onClick={() => setMoreLabs((v) => !v)}
                className="min-h-11 rounded-md px-1 text-sm font-medium text-ayu-accent underline underline-offset-2"
              >
                {moreLabs
                  ? "Show fewer markers"
                  : `Show ${rest.length} more markers`}
              </button>
            )}
          </>
        )}
      </Section>

      <Section
        title="Injections"
        aside={shots.length ? `${shots.length} logged` : undefined}
      >
        {shots.length === 0 ? (
          <Empty>No injections logged yet.</Empty>
        ) : (
          <>
            <Rows>
              {shown.map((s, i) => {
                const side = sideOf(s.site);
                return (
                  <li
                    key={`${s.date}-${s.time}-${i}`}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0">
                      <span data-date className="block text-ayu-text">
                        {fmtShort(s.date)}, {s.date.slice(0, 4)}
                      </span>
                      {shotTime(s.time) && (
                        <span className="block text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                          {shotTime(s.time)}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {side && (
                        <Chip tone={side === "left" ? "blue" : "purple"}>
                          {side === "left" ? "Left" : "Right"}
                        </Chip>
                      )}
                      <span className="text-ayu-text tabular-nums">
                        {s.mg != null ? `${s.mg} mg` : "?"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </Rows>
            {shots.length > FIRST_INJECTIONS && (
              <button
                type="button"
                onClick={() => setAllShots((v) => !v)}
                className="min-h-11 rounded-md px-1 text-sm font-medium text-ayu-accent underline underline-offset-2"
              >
                {allShots ? "Show fewer" : `Show all ${shots.length}`}
              </button>
            )}
          </>
        )}
      </Section>
      <p className="text-sm text-ayu-subtle">
        Information only, not medical advice.
      </p>
    </div>
  );
}
