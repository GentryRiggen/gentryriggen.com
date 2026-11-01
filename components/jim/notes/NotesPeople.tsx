import { Search } from "lucide-react";
import { Empty, Rows } from "@/components/jim/notes/NotesUi";
import { PERSON_GROUPS, personGroup } from "@/lib/jim/notesData";
import { stripMd } from "@/lib/jim/todos";
import type { Person, ViewData } from "@/lib/jim/view";

interface NotesPeopleProps {
  data: ViewData;
  query: string;
  onQuery: (query: string) => void;
  onOpen: (path: string) => void;
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
}: NotesPeopleProps) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const people = data.people
    .filter((p) => typeof p?.name === "string" && typeof p.path === "string")
    .filter((p) => matches(p, words));
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
          <Rows>
            {people.map((p) => (
              <li key={p.path}>
                <button
                  type="button"
                  onClick={() => onOpen(p.path)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.04]"
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
                </button>
              </li>
            ))}
          </Rows>
        </div>
      ))}
    </div>
  );
}
