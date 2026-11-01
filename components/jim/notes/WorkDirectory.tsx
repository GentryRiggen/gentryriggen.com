import { Fragment } from "react";
import { ChevronLeft, Mail, Phone, Search } from "lucide-react";
import { Chip, Empty, Rows, Section } from "@/components/jim/notes/NotesUi";
import { fmtShort } from "@/lib/jim/todos";
import type { DirectoryPerson, Person, WorkDirectory } from "@/lib/jim/view";

/** More matches than this ask for a longer search. */
const MAX_RESULTS = 25;
/** The manager chain stops here even without a cycle. */
const MAX_HOPS = 10;

const ROW =
  "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.04]";

function byId(directory: WorkDirectory): Map<number, DirectoryPerson> {
  return new Map(directory.people.map((p) => [p.id, p]));
}

/** Lower is better: name start, a name word's start, in the name, elsewhere. */
function rank(p: DirectoryPerson, words: string[]): number | null {
  const name = p.name.toLowerCase();
  const hay = `${name} ${p.title} ${p.team} ${p.location}`.toLowerCase();
  if (!words.every((w) => hay.includes(w))) return null;
  const first = words[0];
  if (name.startsWith(first)) return 0;
  if (name.split(/\s+/).some((part) => part.startsWith(first))) return 1;
  if (name.includes(first)) return 2;
  return 3;
}

/** Matches for the directory search, best first. */
export function searchDirectory(
  directory: WorkDirectory,
  query: string
): DirectoryPerson[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return directory.people
    .map((p) => ({ p, r: rank(p, words) }))
    .filter((m): m is { p: DirectoryPerson; r: number } => m.r !== null)
    .sort((a, b) => a.r - b.r || a.p.name.localeCompare(b.p.name))
    .map((m) => m.p);
}

/** The managers above someone, top first; stops on a cycle or at MAX_HOPS. */
export function managerChain(
  directory: WorkDirectory,
  id: number
): { chain: DirectoryPerson[]; unknown: string } {
  const people = byId(directory);
  const seen = new Set<number>([id]);
  const chain: DirectoryPerson[] = [];
  let at = people.get(id);
  while (at && at.managerId !== null && chain.length < MAX_HOPS) {
    const up = people.get(at.managerId);
    if (!up || seen.has(up.id)) break;
    seen.add(up.id);
    chain.unshift(up);
    at = up;
  }
  // A manager the directory doesn't list shows by name only.
  const unknown =
    at &&
    (at.managerId === null || !people.has(at.managerId)) &&
    chain.length < MAX_HOPS
      ? at.managerName
      : "";
  return { chain, unknown };
}

/** A mailto: link only for something shaped like an address. */
export function mailHref(email: string): string | null {
  const e = email.trim();
  return /^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(e)
    ? `mailto:${encodeURIComponent(e)}`
    : null;
}

/** A tel: link from the dial characters only. */
export function telHref(cell: string): string | null {
  const trimmed = cell.trim();
  const dial =
    (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
  return (dial.match(/\d/g)?.length ?? 0) >= 3 ? `tel:${dial}` : null;
}

function dateText(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${fmtShort(value)}, ${value.slice(0, 4)}`
    : value;
}

function subtitle(p: DirectoryPerson): string {
  return [p.title, p.team].filter(Boolean).join(" · ");
}

interface DirectorySearchProps {
  directory: WorkDirectory;
  query: string;
  onQuery: (query: string) => void;
  onOpen: (id: number) => void;
}

/** The directory's search field and its results. */
export function DirectorySearch({
  directory,
  query,
  onQuery,
  onOpen,
}: DirectorySearchProps) {
  const results = searchDirectory(directory, query);
  const shown = results.slice(0, MAX_RESULTS);
  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="jim-directory-search" className="sr-only">
          Search the directory
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ayu-subtle"
        />
        <input
          id="jim-directory-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Search ${directory.people.length} people`}
          maxLength={100}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-11 w-full rounded-2xl border border-white/[0.08] bg-ayu-panel/70 py-2 pr-4 pl-10 text-base text-ayu-text shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] backdrop-blur placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none"
        />
      </div>
      {query.trim() !== "" &&
        (shown.length ? (
          <Rows>
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className={ROW}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ayu-text">
                      {p.name}
                    </span>
                    {subtitle(p) && (
                      <span className="block truncate text-sm text-ayu-subtle">
                        {subtitle(p)}
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
        ) : (
          <Empty>No one matches.</Empty>
        ))}
      {results.length > MAX_RESULTS && (
        <p className="text-sm text-ayu-subtle">
          {results.length - MAX_RESULTS} more. Keep typing to narrow it.
        </p>
      )}
    </div>
  );
}

interface DirectoryCardProps {
  directory: WorkDirectory;
  id: number;
  /** The people notes, for "Open profile". */
  people: Person[];
  onOpen: (id: number) => void;
  onProfile: (path: string) => void;
  onBack: () => void;
}

/** One directory person: manager chain, facts, DISC, strengths, reports. */
export function DirectoryCard({
  directory,
  id,
  people,
  onOpen,
  onProfile,
  onBack,
}: DirectoryCardProps) {
  const everyone = byId(directory);
  const p = everyone.get(id);
  const back = (
    <button
      type="button"
      onClick={onBack}
      className="-ml-2 flex min-h-11 items-center gap-1 rounded-md pr-3 pl-1 text-ayu-accent hover:bg-white/[0.06]"
    >
      <ChevronLeft aria-hidden="true" className="size-5" />
      Work
    </button>
  );
  if (!p) {
    return (
      <article className="space-y-5">
        {back}
        <Empty>That person isn&apos;t in the directory anymore.</Empty>
      </article>
    );
  }

  const { chain, unknown } = managerChain(directory, id);
  const reports = p.reportIds
    .map((r) => everyone.get(r))
    .filter((r): r is DirectoryPerson => r !== undefined && r.id !== id);
  const profile = p.path ? people.find((n) => n.path === p.path) : undefined;
  const facts: [string, string][] = (
    [
      ["Location", p.location],
      ["Birthday", dateText(p.birthday)],
      ["Work anniversary", dateText(p.anniversary)],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const mail = p.email ? mailHref(p.email) : null;
  const tel = p.cell ? telHref(p.cell) : null;

  return (
    <article className="space-y-5">
      {back}
      {(chain.length > 0 || unknown) && (
        <nav aria-label="Reports to" className="-my-2">
          <ol className="flex flex-wrap items-center gap-x-1 text-sm">
            <li aria-hidden="true" className="pr-0.5 text-ayu-subtle">
              Reports to
            </li>
            {chain.map((m, i) => (
              <Fragment key={m.id}>
                {i > 0 && (
                  <li aria-hidden="true" className="text-ayu-subtle">
                    ›
                  </li>
                )}
                <li className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpen(m.id)}
                    className="min-h-11 max-w-full truncate rounded-md px-1.5 text-ayu-accent hover:bg-white/[0.06]"
                  >
                    {m.name}
                  </button>
                </li>
              </Fragment>
            ))}
            {unknown && (
              <>
                {chain.length > 0 && (
                  <li aria-hidden="true" className="text-ayu-subtle">
                    ›
                  </li>
                )}
                <li className="flex min-h-11 items-center px-1.5 text-ayu-subtle">
                  {unknown}
                </li>
              </>
            )}
          </ol>
        </nav>
      )}
      <header className="space-y-1">
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text [overflow-wrap:anywhere]">
          {p.name}
        </h2>
        {subtitle(p) && (
          <p className="text-ayu-subtle [overflow-wrap:anywhere]">
            {subtitle(p)}
          </p>
        )}
      </header>
      {profile && (
        <button
          type="button"
          onClick={() => onProfile(profile.path)}
          className="min-h-11 rounded-full px-4 font-medium text-ayu-accent ring-1 ring-ayu-accent/30 ring-inset hover:bg-ayu-accent/10"
        >
          Open profile
        </button>
      )}
      {(p.email || p.cell) && (
        <Rows>
          {p.email && (
            <li>
              {mail ? (
                <a href={mail} className={ROW}>
                  <Mail
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ayu-accent"
                  />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-ayu-text">
                    {p.email}
                  </span>
                </a>
              ) : (
                <p className={ROW}>
                  <Mail
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ayu-subtle"
                  />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {p.email}
                  </span>
                </p>
              )}
            </li>
          )}
          {p.cell && (
            <li>
              {tel ? (
                <a href={tel} className={ROW}>
                  <Phone
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ayu-accent"
                  />
                  <span className="min-w-0 flex-1 text-ayu-text tabular-nums">
                    {p.cell}
                  </span>
                </a>
              ) : (
                <p className={ROW}>
                  <Phone
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ayu-subtle"
                  />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {p.cell}
                  </span>
                </p>
              )}
            </li>
          )}
        </Rows>
      )}
      {facts.length > 0 && (
        <dl className="jim-card grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3.5">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-sm text-ayu-subtle">{label}</dt>
              <dd className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {p.disc && (
        <Section title="DISC">
          <div className="jim-card flex items-start gap-3 px-4 py-3.5">
            <Chip tone="cyan">{p.disc}</Chip>
            {p.discGloss && (
              <p className="min-w-0 text-ayu-text">{p.discGloss}</p>
            )}
          </div>
        </Section>
      )}
      {p.strengths.length > 0 && (
        <Section title="Strengths">
          <ul className="jim-card space-y-2.5 px-4 py-3.5">
            {p.strengths.map((s) => (
              <li key={s.name} className="space-y-1">
                <Chip tone="purple">{s.name}</Chip>
                {s.gloss && (
                  <p className="text-sm text-ayu-subtle">{s.gloss}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {reports.length > 0 && (
        <Section title="Direct reports" aside={reports.length}>
          <Rows>
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className={ROW}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ayu-text">
                      {r.name}
                    </span>
                    {r.title && (
                      <span className="block truncate text-sm text-ayu-subtle">
                        {r.title}
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
        </Section>
      )}
    </article>
  );
}
