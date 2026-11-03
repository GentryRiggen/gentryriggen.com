"use client";

import { useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import {
  Chip,
  Empty,
  FilterChip,
  OpenLink,
  Rows,
  Segmented,
} from "@/components/jim/notes/NotesUi";
import { fmtShort, stripMd } from "@/lib/jim/todos";
import type { MeetingStep, WorkMeeting } from "@/lib/jim/view";

/**
 * Work's meetings, three ways: the meetings themselves, every next step
 * (yours first) and every decision. Person and project chips narrow all
 * three, and so does the search.
 */

type Mode = "meetings" | "steps" | "decisions";

const MODES: readonly { id: Mode; label: string }[] = [
  { id: "meetings", label: "Meetings" },
  { id: "steps", label: "Next steps" },
  { id: "decisions", label: "Decisions" },
];

/** Chips beyond these (by meeting count) stay hidden unless picked. */
const MAX_CHIPS = 10;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

interface WorkMeetingsProps {
  meetings: WorkMeeting[];
  onOpenMeeting: (path: string) => void;
  meetingHref?: (path: string) => string | null;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const stepsOf = (m: WorkMeeting): MeetingStep[] => m.steps ?? [];
const decisionsOf = (m: WorkMeeting): string[] => m.decisions ?? [];

/** Most-met first, then by name; at most MAX_CHIPS plus the picked one. */
export function topCounts(
  values: string[],
  picked: string
): { key: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const all = [...counts]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
  const top = all.slice(0, MAX_CHIPS);
  const extra = all.find((c) => c.key === picked);
  return extra && !top.includes(extra) ? [...top, extra] : top;
}

/**
 * A project slug in words ("forecasting-tool" → "forecasting tool"). The Mac
 * viewer searches the project note's title; the work payload carries only
 * slugs, so the words stand in for it.
 */
export function projectWords(slug: string): string {
  return slug.replace(/[-_]+/g, " ").trim();
}

export function meetingMatches(
  m: WorkMeeting,
  words: string[],
  person: string,
  project: string
): boolean {
  if (
    person &&
    !m.people.includes(person) &&
    !stepsOf(m).some((s) => s.who === person)
  ) {
    return false;
  }
  if (project && !m.projects.includes(project)) return false;
  const hay = [
    m.title,
    m.series ?? "",
    ...m.people,
    ...m.projects,
    ...m.projects.map(projectWords),
  ]
    .join("\n")
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

function Who({ step }: { step: MeetingStep }) {
  return (
    <span
      className={`shrink-0 text-sm font-medium ${
        step.mine ? "text-ayu-accent" : "text-ayu-subtle"
      }`}
    >
      {step.who || "No owner"}
    </span>
  );
}

interface FromProps {
  meeting: WorkMeeting;
  onOpenMeeting: (path: string) => void;
  meetingHref?: (path: string) => string | null;
}

/** "Oct 30 · Garden planning": opens the meeting a row came from. */
function From({ meeting, onOpenMeeting, meetingHref }: FromProps) {
  return (
    <OpenLink
      href={meetingHref?.(meeting.path)}
      onOpen={() => onOpenMeeting(meeting.path)}
      className="flex min-h-11 items-center text-left text-sm text-ayu-accent hover:underline"
      linkClassName="w-fit"
    >
      {ISO.test(meeting.date) ? `${fmtShort(meeting.date)} · ` : ""}
      {meeting.title}
    </OpenLink>
  );
}

function MeetingMore({ m }: { m: WorkMeeting }) {
  const decisions = decisionsOf(m);
  const steps = stepsOf(m);
  if (!decisions.length && !steps.length && !m.transcript) return null;
  const summary = [
    decisions.length ? plural(decisions.length, "decision") : "",
    steps.length ? plural(steps.length, "next step") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details className="group border-t border-white/[0.04] px-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ayu-subtle hover:text-ayu-text">
        {summary || "More"}
      </summary>
      <div className="space-y-3 pb-3">
        {decisions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-ayu-subtle uppercase">
              Decisions
            </h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ayu-text">
              {decisions.map((d, i) => (
                <li key={i} className="[overflow-wrap:anywhere]">
                  {stripMd(d)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {steps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-ayu-subtle uppercase">
              Next steps
            </h4>
            <ul className="mt-1 space-y-1 text-sm">
              {steps.map((s, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <Who step={s} />
                  <span className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
                    {stripMd(s.text)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {m.transcript && (
          <a
            href={m.transcript}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ayu-accent hover:underline"
          >
            Transcript
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
      </div>
    </details>
  );
}

function MeetingList({
  meetings,
  onOpenMeeting,
  meetingHref,
}: WorkMeetingsProps) {
  return (
    <Rows>
      {meetings.map((m) => (
        <li key={m.path}>
          <OpenLink
            href={meetingHref?.(m.path)}
            onOpen={() => onOpenMeeting(m.path)}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04]"
          >
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-ayu-text">
                  {m.title}
                </span>
                <span className="shrink-0 text-sm text-ayu-subtle tabular-nums">
                  {ISO.test(m.date) ? fmtShort(m.date) : ""}
                </span>
              </span>
              {m.people.length > 0 && (
                <span className="block truncate text-sm text-ayu-subtle">
                  {m.people.join(", ")}
                </span>
              )}
              {(m.series || m.projects.length > 0) && (
                <span className="flex flex-wrap gap-1">
                  {m.series && <Chip tone="purple">{m.series}</Chip>}
                  {m.projects.map((p) => (
                    <Chip key={p} tone="blue">
                      {p}
                    </Chip>
                  ))}
                </span>
              )}
            </span>
            <span aria-hidden="true" className="text-ayu-subtle">
              ›
            </span>
          </OpenLink>
          <MeetingMore m={m} />
        </li>
      ))}
    </Rows>
  );
}

interface StepRow {
  m: WorkMeeting;
  s: MeetingStep;
}

function StepRows({
  title,
  rows,
  onOpenMeeting,
  meetingHref,
}: {
  title: string;
  rows: StepRow[];
  onOpenMeeting: (path: string) => void;
  meetingHref?: (path: string) => string | null;
}) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-ayu-subtle">
        {title} <span className="tabular-nums">{rows.length}</span>
      </h3>
      <Rows>
        {rows.map(({ m, s }, i) => (
          <li key={`${m.path}-${i}`} className="space-y-0.5 px-4 pt-2.5">
            <p className="flex flex-wrap gap-x-2">
              <Who step={s} />
              <span className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
                {stripMd(s.text)}
              </span>
            </p>
            <From
              meeting={m}
              onOpenMeeting={onOpenMeeting}
              meetingHref={meetingHref}
            />
          </li>
        ))}
      </Rows>
    </div>
  );
}

export default function WorkMeetings({
  meetings,
  onOpenMeeting,
  meetingHref,
}: WorkMeetingsProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("meetings");
  const [person, setPerson] = useState("");
  const [project, setProject] = useState("");

  if (!meetings.length) return <Empty>No meetings yet.</Empty>;

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = meetings.filter((m) =>
    meetingMatches(m, words, person, project)
  );
  const people = topCounts(
    meetings.flatMap((m) => m.people),
    person
  );
  const projects = topCounts(
    meetings.flatMap((m) => m.projects),
    project
  );
  const hasMore = meetings.some(
    (m) => stepsOf(m).length > 0 || decisionsOf(m).length > 0
  );

  let body;
  if (!hits.length) {
    body = (
      <Empty>No meeting matches. Clear a filter or try other words.</Empty>
    );
  } else if (mode === "steps") {
    const rows = hits.flatMap((m) =>
      stepsOf(m)
        .filter((s) => !person || s.who === person || m.people.includes(person))
        .map((s) => ({ m, s }))
    );
    body = rows.length ? (
      <div className="space-y-5">
        <StepRows
          title="Yours"
          rows={rows.filter((r) => r.s.mine)}
          onOpenMeeting={onOpenMeeting}
          meetingHref={meetingHref}
        />
        <StepRows
          title="Everyone else"
          rows={rows.filter((r) => !r.s.mine)}
          onOpenMeeting={onOpenMeeting}
          meetingHref={meetingHref}
        />
      </div>
    ) : (
      <Empty>No next steps in these meetings.</Empty>
    );
  } else if (mode === "decisions") {
    const rows = hits.flatMap((m) => decisionsOf(m).map((d) => ({ m, d })));
    body = rows.length ? (
      <Rows>
        {rows.map(({ m, d }, i) => (
          <li key={`${m.path}-${i}`} className="space-y-0.5 px-4 pt-2.5">
            <p className="text-ayu-text [overflow-wrap:anywhere]">
              {stripMd(d)}
            </p>
            <From
              meeting={m}
              onOpenMeeting={onOpenMeeting}
              meetingHref={meetingHref}
            />
          </li>
        ))}
      </Rows>
    ) : (
      <Empty>No decisions in these meetings.</Empty>
    );
  } else {
    body = (
      <MeetingList
        meetings={hits}
        onOpenMeeting={onOpenMeeting}
        meetingHref={meetingHref}
      />
    );
  }

  return (
    <div className="space-y-3">
      {hasMore && (
        <Segmented
          label="Meeting views"
          options={MODES}
          value={mode}
          onChange={setMode}
        />
      )}
      <div className="relative">
        <label htmlFor="jim-meetings-search" className="sr-only">
          Search meetings
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ayu-subtle"
        />
        <input
          id="jim-meetings-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, person or project"
          maxLength={100}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-11 w-full rounded-2xl border border-white/[0.08] bg-ayu-panel/70 py-2 pr-4 pl-10 text-base text-ayu-text shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] backdrop-blur placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none"
        />
      </div>
      {people.length > 1 && (
        <div
          role="group"
          aria-label="Filter by person"
          className="flex flex-wrap gap-1.5"
        >
          {people.map((c) => (
            <FilterChip
              key={c.key}
              label={c.key}
              count={c.n}
              on={person === c.key}
              onToggle={() => setPerson(person === c.key ? "" : c.key)}
            />
          ))}
        </div>
      )}
      {projects.length > 1 && (
        <div
          role="group"
          aria-label="Filter by project"
          className="flex flex-wrap gap-1.5"
        >
          {projects.map((c) => (
            <FilterChip
              key={c.key}
              label={c.key}
              count={c.n}
              on={project === c.key}
              onToggle={() => setProject(project === c.key ? "" : c.key)}
            />
          ))}
        </div>
      )}
      {body}
    </div>
  );
}
