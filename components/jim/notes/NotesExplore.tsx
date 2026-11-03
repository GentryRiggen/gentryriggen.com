"use client";

import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import NoteGraph from "@/components/jim/notes/NoteGraph";
import {
  Chip,
  Empty,
  FilterChip,
  OpenLink,
  Rows,
  Section,
  Segmented,
  Stat,
} from "@/components/jim/notes/NotesUi";
import type { JimErrorKind } from "@/lib/jim/api";
import {
  useExplore,
  type BallotSection,
  type BallotTable,
  type ExploreData,
  type ExploreKind,
  type ExploreState,
  type TimelineEvent,
  type TimelineKind,
} from "@/lib/jim/explore";
import JimMarkdown from "@/lib/jim/markdown";
import { addDays, daysBetween, fmtDay, stripMd } from "@/lib/jim/todos";

/**
 * Explore: the timeline, the note graph and the ballot. Each is fetched
 * when its page opens and held in this page's memory only.
 */

type GetToken = (force?: boolean) => Promise<string | null>;

interface ExplorePageProps {
  getToken: GetToken;
  api: string;
  today: string;
  onOpenNote: (path: string) => void;
  hrefForNote?: (path: string) => string | null;
}

const ERRORS: Record<JimErrorKind, string> = {
  waking: "Jim is waking up. Try again in a moment.",
  uncertain: "Jim is waking up. Try again in a moment.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
  server: "Couldn't load this page.",
  rejected: "Couldn't load this page.",
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

interface FrameProps<K extends ExploreKind> {
  state: ExploreState<K>;
  what: string;
  children: (data: ExploreData[K]) => ReactNode;
}

/** Loading, error and stale states around an Explore page. */
function ExploreFrame<K extends ExploreKind>({
  state,
  what,
  children,
}: FrameProps<K>) {
  const { status, data, error, reload } = state;
  if (!data) {
    if (status === "error" && error) {
      return (
        <div className="space-y-3 py-6 text-center">
          <p role="alert" className="text-ayu-text">
            {ERRORS[error]}
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className="jim-glow min-h-11 rounded-full px-5 font-medium text-ayu-bg hover:brightness-110"
          >
            Try again
          </button>
        </div>
      );
    }
    return (
      <div aria-busy="true" className="space-y-3">
        <p className="sr-only" role="status">
          Loading {what}…
        </p>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.04]"
          />
        ))}
      </div>
    );
  }
  const stale = "stale" in data && data.stale;
  return (
    <div className="space-y-5">
      {(stale || status === "error") && (
        <p className="text-sm text-ayu-orange">
          {status === "error"
            ? "Couldn't refresh. Showing what loaded before."
            : "Jim couldn't sync, so this may be behind."}
        </p>
      )}
      {children(data)}
    </div>
  );
}

// ---------- timeline ----------

const KIND_LABELS: Record<TimelineKind, string> = {
  log: "Sessions",
  note: "Notes",
  due: "Upcoming",
  done: "Done",
};
const KIND_ORDER: TimelineKind[] = ["note", "done", "due", "log"];
const KIND_TONES: Record<TimelineKind, "plain" | "blue" | "green" | "purple"> =
  {
    log: "purple",
    note: "blue",
    due: "plain",
    done: "green",
  };

/** The default window: the last four months (and anything ahead). */
const RECENT_DAYS = 120;
/** Rows drawn before "Show more". */
const PAGE_ROWS = 200;

const FULL_MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthTitle(ym: string): string {
  return `${FULL_MONTH[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

function relative(e: TimelineEvent, today: string): string {
  if (e.kind !== "due") return "";
  const n = daysBetween(today, e.date);
  return n < 0 ? ` · ${-n}d late` : n === 0 ? " · today" : ` · in ${n}d`;
}

export function filterTimeline(
  events: TimelineEvent[],
  kinds: ReadonlySet<TimelineKind>,
  query: string,
  since: string | null
): TimelineEvent[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return events.filter((e) => {
    if (!kinds.has(e.kind)) return false;
    // A search looks through everything; otherwise the window applies.
    if (!words.length) return since === null || e.date >= since;
    const hay = `${e.title ?? ""} ${e.text} ${e.src}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

function TimelineBody({
  events,
  today,
  onOpenNote,
  hrefForNote,
}: {
  events: TimelineEvent[];
  today: string;
  onOpenNote: (path: string) => void;
  hrefForNote?: (path: string) => string | null;
}) {
  const [kinds, setKinds] = useState<ReadonlySet<TimelineKind>>(
    () => new Set(KIND_ORDER)
  );
  const [allTime, setAllTime] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_ROWS);
  const since = allTime ? null : addDays(today, -RECENT_DAYS);
  const shown = filterTimeline(events, kinds, query, since);
  const counts = new Map<TimelineKind, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);

  const months: [string, TimelineEvent[]][] = [];
  for (const e of shown.slice(0, limit)) {
    const ym = e.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last[0] === ym) last[1].push(e);
    else months.push([ym, [e]]);
  }

  function toggle(kind: TimelineKind) {
    const next = new Set(kinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setKinds(next);
    setLimit(PAGE_ROWS);
  }

  return (
    <>
      <div className="relative">
        <label htmlFor="jim-timeline-search" className="sr-only">
          Search the timeline
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ayu-subtle"
        />
        <input
          id="jim-timeline-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_ROWS);
          }}
          placeholder="Search everything"
          maxLength={100}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-11 w-full rounded-2xl border border-white/[0.08] bg-ayu-panel/70 py-2 pr-4 pl-10 text-base text-ayu-text shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] backdrop-blur placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none"
        />
      </div>
      <div
        role="group"
        aria-label="Show kinds"
        className="flex flex-wrap gap-1.5"
      >
        {KIND_ORDER.filter((k) => counts.has(k)).map((k) => (
          <FilterChip
            key={k}
            label={KIND_LABELS[k]}
            count={counts.get(k)}
            on={kinds.has(k)}
            onToggle={() => toggle(k)}
          />
        ))}
        <FilterChip
          label="All time"
          on={allTime}
          onToggle={() => {
            setAllTime(!allTime);
            setLimit(PAGE_ROWS);
          }}
        />
      </div>
      <p className="text-sm text-ayu-subtle" aria-live="polite">
        {plural(shown.length, "event")}
        {query.trim() ? "" : allTime ? ", all time" : ", last 4 months"}
      </p>
      {months.length ? (
        months.map(([ym, list]) => (
          <Section key={ym} title={monthTitle(ym)} aside={list.length}>
            <Rows>
              {list.map((e, i) => (
                <li key={`${e.date}-${e.path}-${i}`}>
                  <OpenLink
                    href={e.path ? hrefForNote?.(e.path) : null}
                    onOpen={() => {
                      if (e.path) onOpenNote(e.path);
                    }}
                    className="block w-full space-y-0.5 px-4 py-2.5 text-left hover:bg-white/[0.04]"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-x-3 text-sm text-ayu-subtle">
                      <span>
                        {fmtDay(e.date)}
                        {e.time ? ` ${e.time}` : ""}
                        {relative(e, today)}
                      </span>
                      <Chip tone={KIND_TONES[e.kind]}>
                        {KIND_LABELS[e.kind]}
                      </Chip>
                    </span>
                    {e.title && (
                      <span className="block font-medium text-ayu-text [overflow-wrap:anywhere]">
                        {e.title}
                      </span>
                    )}
                    <span className="block text-ayu-text [overflow-wrap:anywhere]">
                      {stripMd(e.text)}
                    </span>
                    {e.src && (
                      <span className="block truncate text-sm text-ayu-subtle">
                        {e.src}
                      </span>
                    )}
                  </OpenLink>
                </li>
              ))}
            </Rows>
          </Section>
        ))
      ) : (
        <Empty>
          {events.length ? "Nothing matches." : "Nothing on the timeline yet."}
        </Empty>
      )}
      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + PAGE_ROWS)}
          className="min-h-11 rounded-full px-4 font-medium text-ayu-accent hover:bg-white/[0.06]"
        >
          Show more ({shown.length - limit} left)
        </button>
      )}
    </>
  );
}

export function ExploreTimeline(props: ExplorePageProps) {
  const state = useExplore("timeline", props.getToken, props.api, true);
  return (
    <ExploreFrame state={state} what="the timeline">
      {(data) => (
        <TimelineBody
          events={data.events}
          today={props.today}
          onOpenNote={props.onOpenNote}
          hrefForNote={props.hrefForNote}
        />
      )}
    </ExploreFrame>
  );
}

// ---------- graph ----------

export function ExploreGraph(props: ExplorePageProps) {
  const state = useExplore("graph", props.getToken, props.api, true);
  return (
    <ExploreFrame state={state} what="the graph">
      {(data) =>
        data.nodes.length ? (
          <NoteGraph
            graph={data}
            onOpen={props.onOpenNote}
            hrefFor={props.hrefForNote}
          />
        ) : (
          <Empty>No notes to draw yet.</Empty>
        )
      }
    </ExploreFrame>
  );
}

// ---------- ballot ----------

function BallotTableView({ table }: { table: BallotTable }) {
  const [first, ...rest] = table.header;
  return (
    <div className="space-y-2">
      {table.heading && (
        <h4 className="text-sm font-medium text-ayu-subtle">{table.heading}</h4>
      )}
      <Rows>
        {table.rows.map((row, i) => (
          <li key={i} className="space-y-1 px-4 py-3">
            <p className="font-medium text-ayu-text [overflow-wrap:anywhere]">
              {stripMd(row[0] ?? "") || first}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              {rest.map((h, j) =>
                row[j + 1] ? (
                  <div key={`${h}-${j}`} className="contents">
                    <dt className="text-ayu-subtle">{h}</dt>
                    <dd className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
                      {stripMd(row[j + 1])}
                    </dd>
                  </div>
                ) : null
              )}
            </dl>
          </li>
        ))}
      </Rows>
    </div>
  );
}

function BallotSections({ sections }: { sections: BallotSection[] }) {
  return (
    <>
      {sections.map((s, i) => (
        <Section key={`${s.heading}-${i}`} title={s.heading || "More"}>
          {s.before && (
            <div className="jim-card px-4 py-3.5 [overflow-wrap:anywhere]">
              <JimMarkdown text={s.before} links="label" />
            </div>
          )}
          {s.tables.map((t, j) => (
            <BallotTableView key={j} table={t} />
          ))}
          {s.after && (
            <div className="jim-card px-4 py-3.5 [overflow-wrap:anywhere]">
              <JimMarkdown text={s.after} links="label" />
            </div>
          )}
        </Section>
      ))}
    </>
  );
}

function countdown(date: string, today: string): string {
  const left = daysBetween(today, date);
  if (left > 1) return `${left} days to go`;
  if (left === 1) return "tomorrow";
  if (left === 0) return "today";
  return "has passed";
}

type BallotView = "voted" | "guide";

const BALLOT_VIEWS: readonly { id: BallotView; label: string }[] = [
  { id: "voted", label: "My ballot" },
  { id: "guide", label: "The guide" },
];

export function ExploreBallot(props: ExplorePageProps) {
  const state = useExplore("ballot", props.getToken, props.api, true);
  const [chosen, setChosen] = useState<BallotView>("voted");
  return (
    <ExploreFrame state={state} what="the ballot">
      {({ voted, guide }) => {
        if (!voted && !guide) {
          return (
            <Empty>
              No ballot yet. A voting guide or a marked ballot in the notes
              shows here.
            </Empty>
          );
        }
        const shown: BallotView = !voted ? "guide" : !guide ? "voted" : chosen;
        return (
          <>
            {voted && guide && (
              <Segmented
                label="Ballot views"
                options={BALLOT_VIEWS}
                value={shown}
                onChange={setChosen}
              />
            )}
            {shown === "voted" && voted ? (
              <>
                <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text [overflow-wrap:anywhere]">
                  {voted.title}
                </h2>
                {Object.keys(voted.facts).length > 0 && (
                  <dl className="jim-card grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3.5 text-sm">
                    {Object.entries(voted.facts).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-ayu-subtle">{k}</dt>
                        <dd className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
                          {stripMd(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <BallotSections sections={voted.sections} />
              </>
            ) : guide ? (
              <>
                <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text [overflow-wrap:anywhere]">
                  {guide.title}
                </h2>
                {guide.date && (
                  <Stat
                    label="Election day"
                    value={fmtDay(guide.date)}
                    detail={countdown(guide.date, props.today)}
                  />
                )}
                {guide.intro && (
                  <div className="jim-card px-4 py-3.5 [overflow-wrap:anywhere]">
                    <JimMarkdown text={guide.intro} links="label" />
                  </div>
                )}
                <BallotSections sections={guide.sections} />
              </>
            ) : null}
          </>
        );
      }}
    </ExploreFrame>
  );
}
