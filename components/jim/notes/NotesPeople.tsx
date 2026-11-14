import { Cake, CalendarClock, Heart, Search } from "lucide-react";
import type { ReactNode } from "react";
import {
  Empty,
  onPlainClick,
  Rows,
  Section,
} from "@/components/jim/notes/NotesUi";
import { PERSON_GROUPS, personGroup } from "@/lib/jim/notesData";
import { fmtShort, stripMd } from "@/lib/jim/todos";
import type { Person, UpcomingDate, ViewData } from "@/lib/jim/view";

interface NotesPeopleProps {
  data: ViewData;
  query: string;
  onQuery: (query: string) => void;
  onOpen: (path: string) => void;
  /** A person's address: rows become real links (⌘-click opens a tab). */
  hrefFor?: (path: string) => string;
}

interface OpenRowProps {
  path: string;
  className: string;
  onOpen: (path: string) => void;
  hrefFor?: (path: string) => string;
  children: ReactNode;
}

/** A row that opens a person: a link when it has an address. */
function OpenRow({ path, className, onOpen, hrefFor, children }: OpenRowProps) {
  if (!hrefFor) {
    return (
      <button type="button" onClick={() => onOpen(path)} className={className}>
        {children}
      </button>
    );
  }
  return (
    <a
      href={hrefFor(path)}
      onClick={onPlainClick(() => onOpen(path))}
      className={className}
    >
      {children}
    </a>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .filter((c) => /[A-Za-z]/.test(c))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const KIND_ICON = {
  birthday: Cake,
  anniversary: Heart,
  renewal: CalendarClock,
} as const;

/** "Nov 5 · in 5 days · turns 40"; today and tomorrow in words. */
function dateLabel(d: UpcomingDate): string {
  const when =
    d.days === 0 ? "today" : d.days === 1 ? "tomorrow" : `in ${d.days} days`;
  return [fmtShort(d.on), when, d.turns !== null ? `turns ${d.turns}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function matches(p: Person, words: string[]): boolean {
  const hay =
    `${p.name} ${p.about ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** People: a searchable list, by group. */
export default function NotesPeople({
  data,
  query,
  onQuery,
  onOpen,
  hrefFor,
}: NotesPeopleProps) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const people = data.people
    .filter((p) => typeof p?.name === "string" && typeof p.path === "string")
    .filter((p) => matches(p, words));
  const known = new Set(data.people.map((p) => p.path));
  const upcoming = (data.dates ?? []).filter(
    (d) => typeof d?.name === "string" && typeof d.on === "string"
  );
  const groups = PERSON_GROUPS.map((g) => ({
    group: g,
    people: people
      .filter((p) => personGroup(p) === g)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.people.length);

  return (
    <div className="space-y-6">
      <div className="relative">
        <label htmlFor="jim-people-search" className="sr-only">
          Search people
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ayu-subtle"
        />
        <input
          id="jim-people-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Search ${data.people.length} people`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-11 w-full rounded-2xl border border-white/[0.08] bg-ayu-panel/70 py-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] backdrop-blur pr-4 pl-10 text-base text-ayu-text placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none"
        />
      </div>
      {!words.length && upcoming.length > 0 && (
        <Section title="Coming up" aside={upcoming.length}>
          <Rows>
            {upcoming.map((d) => {
              const Icon = KIND_ICON[d.kind] ?? CalendarClock;
              const opens = known.has(d.path);
              const body = (
                <>
                  <Icon
                    aria-hidden="true"
                    className="size-5 shrink-0 text-ayu-accent"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ayu-text">
                      {d.name}
                    </span>
                    <span className="block text-sm text-ayu-subtle">
                      {dateLabel(d)}
                    </span>
                  </span>
                  {opens && (
                    <span aria-hidden="true" className="text-ayu-subtle">
                      ›
                    </span>
                  )}
                </>
              );
              return (
                <li key={`${d.kind}-${d.path}-${d.on}-${d.name}`}>
                  {opens ? (
                    <OpenRow
                      path={d.path}
                      onOpen={onOpen}
                      hrefFor={hrefFor}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.04]"
                    >
                      {body}
                    </OpenRow>
                  ) : (
                    <div className="flex min-h-14 w-full items-center gap-3 px-4 py-2">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </Rows>
        </Section>
      )}
      {groups.length === 0 && (
        <Empty>
          {data.people.length ? "No one matches." : "No people yet."}
        </Empty>
      )}
      {groups.map(({ group, people }) => (
        <div key={group} className="space-y-1.5">
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ayu-subtle uppercase">
            {group}{" "}
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[0.6875rem] tracking-normal text-ayu-subtle tabular-nums">
              {people.length}
            </span>
          </h3>
          {/* One panel of rows; cards in columns where the page is wide. */}
          <ul className="jim-card divide-y divide-white/[0.05] overflow-hidden @2xl:grid @2xl:grid-cols-2 @2xl:gap-3 @2xl:divide-y-0 @2xl:overflow-visible @2xl:border-0 @2xl:bg-transparent @2xl:bg-none @2xl:shadow-none @4xl:grid-cols-3">
            {people.map((p) => (
              <li
                key={p.path}
                className="@2xl:jim-card @2xl:overflow-hidden @2xl:transition-colors @2xl:hover:border-ayu-accent/30"
              >
                <OpenRow
                  path={p.path}
                  onOpen={onOpen}
                  hrefFor={hrefFor}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.04] @2xl:min-h-16"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ayu-accent/25 to-ayu-purple/20 text-sm font-semibold text-ayu-accent ring-1 ring-ayu-accent/25 ring-inset"
                  >
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ayu-text">
                      {p.name}
                    </span>
                    {p.about && (
                      <span className="block truncate text-sm text-ayu-subtle">
                        {stripMd(p.about)}
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="text-ayu-subtle">
                    ›
                  </span>
                </OpenRow>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
