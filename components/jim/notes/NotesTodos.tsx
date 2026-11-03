"use client";

import { useId, useMemo, type KeyboardEvent, type ReactNode } from "react";
import {
  BarChart3,
  MessageCircle,
  Plus,
  Repeat,
  Search,
  X,
} from "lucide-react";
import { Empty, onPlainClick, Rows } from "@/components/jim/notes/NotesUi";
import ShortLabel from "@/components/jim/notes/ShortLabel";
import {
  AreaSplit,
  ColumnChart,
  comingColumns,
  comingSummary,
  doneColumns,
  doneSummary,
  TodoTiles,
} from "@/components/jim/notes/TodoCharts";
import { TodoCheckbox, ToastBar } from "@/components/jim/notes/TodoBits";
import useTodoFilters from "@/components/jim/notes/useTodoFilters";
import {
  todoKey,
  type Mark,
  type TodoSaves,
} from "@/components/jim/notes/useTodoSaves";
import type { JimNavType } from "@/components/jim/useJimRouter";
import {
  daysBetween,
  fmtDay,
  fmtShort,
  isRecurring,
  todoTitle,
  withoutDone,
} from "@/lib/jim/todos";
import {
  areaSplit,
  comingUp,
  DEFAULT_FILTERS,
  doneByDay,
  dueChip,
  dueGroups,
  filterDone,
  filterTodos,
  isDayFilter,
  isFiltered,
  projectCounts,
  projectGroups,
  projectLabel,
  projectPath,
  todoStats,
  type TodoArea,
  type TodoFilters,
  type TodoGroup,
  type TodoSort,
} from "@/lib/jim/todosPage";
import type { ViewData, ViewTodo } from "@/lib/jim/view";

interface NotesTodosProps {
  data: ViewData;
  /** The checkbox saves, kept by the shell so they outlive this page. */
  saves: TodoSaves;
  /** Puts text in the chat box, unsent, and shows Chat. */
  onDraft: (text: string) => void;
  /** The desktop layout: the whole filter bar stays pinned. */
  wide: boolean;
  /** The history entry showing, and how it was reached (for the filters). */
  entryKey: string;
  navType: JimNavType;
  /** Opens a project's note by its repo path. */
  onOpenNote: (path: string) => void;
  hrefForNote: (path: string) => string | null;
}

const AREA_OPTIONS: { id: TodoArea; label: string }[] = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
];

const WHEN_OPTIONS: { id: string; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "later", label: "Later" },
  { id: "nodate", label: "No date" },
];

/** Short enough for a phone; read out as "Sort" then the choice. */
const SORT_OPTIONS: { id: TodoSort; label: string; name?: string }[] = [
  { id: "due", label: "Due date" },
  { id: "project", label: "Project" },
  { id: "done", label: "Done", name: "Recently done" },
];

function count(n: number): string {
  return `${n} todo${n === 1 ? "" : "s"}`;
}

/** What an empty list says, for the filters that emptied it. */
function emptyLine(f: TodoFilters, anyOpen: boolean): string {
  if (f.sort === "done") {
    return isDayFilter(f.when)
      ? `Nothing done on ${fmtDay(f.when)}.`
      : f.q.trim()
        ? `Nothing done matches “${f.q.trim()}”.`
        : "Nothing done in the last 14 days here yet.";
  }
  if (!anyOpen) return "No open todos. Enjoy it.";
  if (f.q.trim()) return `No todos match “${f.q.trim()}”.`;
  switch (f.when) {
    case "overdue":
      return "Nothing overdue. Nice.";
    case "today":
      return "Nothing due today.";
    case "week":
      return "Nothing due this week.";
    case "later":
      return "Nothing due later on.";
    case "nodate":
      return "Every todo here has a date.";
    case "any":
      return "No open todos here.";
    default:
      return `Nothing due on ${fmtDay(f.when)}.`;
  }
}

/** A row of chips that scrolls sideways on its own, never the page. */
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex scroll-px-4 gap-1.5 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] @2xl:mx-0 @2xl:flex-wrap @2xl:overflow-visible @2xl:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "accent" | "red";
}

/** 44px to tap, a 36px pill to see. */
function FilterChip({
  selected,
  onClick,
  children,
  tone = "accent",
}: FilterChipProps) {
  const on =
    tone === "red"
      ? "bg-ayu-red/12 text-ayu-red ring-ayu-red/30"
      : "bg-ayu-accent/12 text-ayu-accent ring-ayu-accent/30";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="group flex min-h-11 shrink-0 items-center"
    >
      <span
        className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap ring-1 transition-colors duration-150 ring-inset ${
          selected
            ? on
            : "text-ayu-subtle ring-white/10 group-hover:bg-white/[0.06] group-hover:text-ayu-text"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  /** `name` is read out when it says more than the label. */
  options: { id: T; label: string; name?: string }[];
  onChange: (next: T) => void;
}

/** A row of radios drawn as one control (Area, Sort). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  /** Arrow keys move the choice (and focus) along, wrapping: one tab stop. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const at = options.findIndex((o) => o.id === value);
    const next = (at + step + options.length) % options.length;
    onChange(options[next].id);
    const radios =
      event.currentTarget.querySelectorAll<HTMLElement>("[role=radio]");
    radios[next]?.focus();
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="jim-card flex min-w-0 gap-1 rounded-2xl! p-1"
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.name}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={`min-h-11 min-w-0 flex-auto truncate rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
              selected
                ? "bg-ayu-accent/12 text-ayu-accent ring-1 ring-ayu-accent/30 ring-inset"
                : "text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface RowProps {
  todo: ViewTodo;
  today: string;
  mark: Mark | undefined;
  onToggle: (todo: ViewTodo, done: boolean) => void;
  /** The project chip: a link to its note, or a filter to it. */
  project: { label: string; href: string | null; path: string | null } | null;
  onProject: () => void;
  onOpenNote: (path: string) => void;
  onAsk: () => void;
}

function TodoRow({
  todo,
  today,
  mark,
  onToggle,
  project,
  onProject,
  onOpenNote,
  onAsk,
}: RowProps) {
  const full = todo.done ? withoutDone(todo.text) : todo.text;
  const title = todoTitle(full) || full;
  const checked = mark ? mark.done : todo.done;
  const pending = mark?.pending ?? false;
  const repeats = todo.recurring ?? isRecurring(todo.text);
  const n = todo.due ? daysBetween(today, todo.due) : null;
  const dueTone =
    n !== null && n < 0
      ? "bg-ayu-red/12 text-ayu-red ring-ayu-red/25"
      : n === 0
        ? "bg-ayu-accent/12 text-ayu-accent ring-ayu-accent/25"
        : "bg-white/[0.04] text-ayu-subtle ring-white/10";
  const pill =
    "inline-flex h-7 max-w-[14rem] items-center truncate rounded-full px-2.5 text-xs font-medium ring-1 ring-inset";
  return (
    <li className="flex items-start gap-1 py-1 pr-1 pl-1">
      <div className="pt-0.5">
        <TodoCheckbox
          label={title}
          checked={checked}
          pending={pending}
          onToggle={(done) => onToggle(todo, done)}
        />
      </div>
      <div className="min-w-0 flex-1 py-1.5">
        <ShortLabel
          dataTitle
          short={todo.short}
          full={title}
          className={checked ? "text-ayu-subtle line-through" : "text-ayu-text"}
        />
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5">
          {todo.done ? (
            <span
              className={`${pill} bg-ayu-green/10 text-ayu-green ring-ayu-green/20`}
            >
              done {todo.done_on === today ? "today" : fmtShort(todo.done_on)}
            </span>
          ) : (
            <span className={`${pill} ${dueTone} tabular-nums`}>
              {dueChip(todo.due, today)}
            </span>
          )}
          {project &&
            (project.href && project.path ? (
              <a
                href={project.href}
                onClick={onPlainClick(() => onOpenNote(project.path!))}
                className="group flex min-h-11 items-center"
              >
                <span
                  className={`${pill} bg-ayu-blue/10 text-ayu-blue ring-ayu-blue/20 group-hover:bg-ayu-blue/20`}
                >
                  {project.label}
                </span>
              </a>
            ) : (
              <button
                type="button"
                aria-label={`Show ${project.label} todos`}
                onClick={onProject}
                className="group flex min-h-11 items-center"
              >
                <span
                  className={`${pill} bg-white/[0.04] text-ayu-text ring-white/10 group-hover:bg-white/[0.08]`}
                >
                  {project.label}
                </span>
              </button>
            ))}
          {(todo.recurring ?? false) && (
            <span
              role="img"
              aria-label="Repeats"
              title="Repeats"
              className="flex min-h-11 items-center px-1 text-ayu-subtle"
            >
              <Repeat aria-hidden="true" className="size-3.5" />
            </span>
          )}
          {repeats && checked && pending && (
            // The server adds the next one; its reply then names the date.
            <span className="flex min-h-11 items-center text-xs text-ayu-subtle">
              next one coming
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Ask Jim about ${title}`}
        title="Ask Jim"
        onClick={onAsk}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-accent"
      >
        <MessageCircle aria-hidden="true" className="size-[1.125rem]" />
      </button>
    </li>
  );
}

/**
 * The Todos page: what's open at a glance, filters that live in the
 * address, and the list (ticked as on Home). Edits other than the tick go
 * through Jim in Chat.
 */
export default function NotesTodos({
  data,
  saves,
  onDraft,
  wide,
  entryKey,
  navType,
  onOpenNote,
  hrefForNote,
}: NotesTodosProps) {
  const [f, setF] = useTodoFilters(entryKey, navType);
  const today = data.today;
  const listId = useId();
  const searchId = useId();
  const set = (patch: Partial<TodoFilters>) => setF({ ...f, ...patch });

  /** Who a project tag names, and its note when the payload knows it. */
  const named = useMemo(
    () => [
      ...data.people,
      ...(data.work?.team ?? []).map((m) => ({ name: m.name, path: m.path })),
    ],
    [data]
  );
  const knownPaths = useMemo(
    () =>
      [
        ...(data.work?.team ?? []).map((m) => m.path),
        ...(data.work?.meetings ?? []).map((m) => m.path),
        ...(data.work?.directory?.people ?? []).map((p) => p.path),
        ...(data.dates ?? []).map((d) => d.path),
      ].filter(Boolean),
    [data]
  );
  const nameOf = (project: string) => projectLabel(project, named);

  // The charts show the area and project picked; never the when or search.
  const { stats, up, perDay, split } = useMemo(() => {
    const scope: TodoFilters = {
      ...DEFAULT_FILTERS,
      area: f.area,
      project: f.project,
    };
    const scoped = filterTodos(data.todos, scope, today);
    const scopedDone = filterDone(data.doneTodos, scope, today);
    return {
      stats: todoStats(scoped, scopedDone, today),
      up: comingUp(scoped, today),
      perDay: doneByDay(scopedDone, today),
      split: areaSplit(
        filterTodos(
          data.todos,
          { ...DEFAULT_FILTERS, project: f.project },
          today
        )
      ),
    };
  }, [data, today, f.area, f.project]);

  const doneMode = f.sort === "done";
  const open = filterTodos(data.todos, f, today);
  const done = filterDone(data.doneTodos, f, today);
  /** The closed Done section: the area, project and search, any day. */
  const doneHere = filterDone(data.doneTodos, { ...f, when: "any" }, today);
  const shown = doneMode ? done : open;
  const groups: TodoGroup[] = doneMode
    ? [{ key: "done", label: "Recently done", todos: done }]
    : f.sort === "project"
      ? projectGroups(open, nameOf)
      : dueGroups(open, today);
  const projects = projectCounts(data.todos, f.area);
  const filtered = isFiltered(f);

  function projectFor(t: ViewTodo): RowProps["project"] {
    if (!t.project) return null;
    const path = projectPath(t.project, named, knownPaths);
    return {
      label: nameOf(t.project),
      path,
      href: path ? hrefForNote(path) : null,
    };
  }

  function pickArea(area: TodoArea) {
    // A project with nothing in the new area would leave an empty list.
    const keep =
      f.project !== "" &&
      projectCounts(data.todos, area).some((p) => p.project === f.project);
    set({ area, project: keep ? f.project : "" });
  }

  function pickWhen(when: string) {
    set({ when, sort: doneMode ? "due" : f.sort });
  }

  function pickSort(sort: TodoSort) {
    // A due bucket means nothing for done todos.
    const when =
      sort === "done" && !isDayFilter(f.when)
        ? "any"
        : sort !== "done" && doneMode && isDayFilter(f.when)
          ? "any"
          : f.when;
    set({ sort, when });
  }

  const tileOn = doneMode
    ? f.when === "any"
      ? "done"
      : null
    : f.when === "any"
      ? "open"
      : f.when === "overdue"
        ? "overdue"
        : f.when === "week"
          ? "week"
          : null;

  const rows = (list: ViewTodo[]) => (
    <Rows>
      {list.map((t) => (
        <TodoRow
          key={todoKey(t)}
          todo={t}
          today={today}
          mark={saves.marks[todoKey(t)]}
          onToggle={saves.toggle}
          project={projectFor(t)}
          onProject={() =>
            set({
              project: t.project,
              area: f.area === "all" || f.area === t.area ? f.area : "all",
            })
          }
          onOpenNote={onOpenNote}
          onAsk={() => onDraft(`Help me with: ${withoutDone(t.text)}`)}
        />
      ))}
    </Rows>
  );

  const newTodo = (
    <button
      type="button"
      onClick={() => onDraft("Add a todo: ")}
      className="jim-glow flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-medium whitespace-nowrap text-ayu-bg hover:brightness-110"
    >
      <Plus aria-hidden="true" className="size-4" strokeWidth={2.5} />
      New todo
    </button>
  );

  const chartsToggle = (
    <button
      type="button"
      onClick={() => set({ view: f.view === "list" ? "charts" : "list" })}
      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
    >
      <BarChart3 aria-hidden="true" className="size-4" />
      {f.view === "list" ? "Show charts" : "Hide charts"}
    </button>
  );

  const areaControl = (
    <Segmented
      label="Area"
      value={f.area}
      options={AREA_OPTIONS}
      onChange={pickArea}
    />
  );

  const projectChips = (
    <ChipRow label="Projects">
      <FilterChip
        selected={f.project === ""}
        onClick={() => set({ project: "" })}
      >
        All projects
      </FilterChip>
      {projects.map((p) => (
        <FilterChip
          key={p.project}
          selected={f.project === p.project}
          onClick={() =>
            set({ project: f.project === p.project ? "" : p.project })
          }
        >
          {nameOf(p.project)}
          <span className="text-xs text-ayu-subtle tabular-nums">
            {p.count}
          </span>
        </FilterChip>
      ))}
    </ChipRow>
  );

  const whenChips =
    doneMode && !isDayFilter(f.when) ? null : (
      <ChipRow label="When">
        {!doneMode &&
          WHEN_OPTIONS.map((w) => (
            <FilterChip
              key={w.id}
              selected={f.when === w.id}
              tone={w.id === "overdue" ? "red" : "accent"}
              onClick={() => pickWhen(f.when === w.id ? "any" : w.id)}
            >
              {w.label}
            </FilterChip>
          ))}
        {isDayFilter(f.when) && (
          <FilterChip selected onClick={() => set({ when: "any" })}>
            {doneMode ? "Done " : "Due "}
            {f.when === today ? "today" : fmtDay(f.when)}
            <X aria-hidden="true" className="size-3.5" />
          </FilterChip>
        )}
      </ChipRow>
    );

  const searchBox = (
    <div role="search" className="relative min-w-0 flex-1">
      <label htmlFor={searchId} className="sr-only">
        Search todos
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ayu-subtle"
      />
      <input
        id={searchId}
        type="search"
        value={f.q}
        onChange={(e) => set({ q: e.target.value.slice(0, 100) })}
        placeholder="Search todos"
        maxLength={100}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="min-h-11 w-full rounded-2xl border border-white/[0.08] bg-ayu-panel/70 py-2 pr-11 pl-10 text-base text-ayu-text shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] backdrop-blur placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {f.q && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => set({ q: "" })}
          className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:text-ayu-text"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );

  const sortControl = (
    <Segmented
      label="Sort"
      value={f.sort}
      options={SORT_OPTIONS}
      onChange={pickSort}
    />
  );

  const status = (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-ayu-subtle tabular-nums"
      >
        {count(shown.length)}
      </p>
      {filtered && (
        <button
          type="button"
          onClick={() => set({ area: "all", project: "", when: "any", q: "" })}
          className="-mr-2 flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-ayu-accent hover:bg-white/[0.06]"
        >
          <X aria-hidden="true" className="size-4" />
          Clear
        </button>
      )}
    </div>
  );

  const pinned =
    "sticky top-0 z-10 -mx-4 border-b border-white/[0.06] bg-ayu-bg/85 px-4 pt-2 pb-2 backdrop-blur-xl @2xl:-mx-8 @2xl:px-8";

  return (
    <div className="space-y-6">
      {!wide && (
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text">
            Todos
          </h1>
          {newTodo}
        </div>
      )}

      <section aria-label="At a glance" className="space-y-3">
        <div className="-my-1 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ayu-subtle uppercase">
            <span
              aria-hidden="true"
              className="h-3 w-1 rounded-full bg-gradient-to-b from-ayu-accent to-ayu-orange"
            />
            At a glance
          </h2>
          <div className="-mr-3">{chartsToggle}</div>
        </div>
        {f.view !== "list" && (
          <>
            <TodoTiles
              stats={stats}
              selected={tileOn}
              onPick={(tile) => {
                if (tile === "done") set({ sort: "done", when: "any" });
                else
                  set({
                    sort: doneMode ? "due" : f.sort,
                    when: tile === "open" ? "any" : tile,
                  });
              }}
            />
            <div className="grid gap-3 @2xl:grid-cols-3">
              <ColumnChart
                title="Coming up"
                summary={comingSummary(up)}
                columns={comingColumns(up, today)}
                selected={
                  doneMode
                    ? null
                    : f.when === "overdue"
                      ? "overdue"
                      : f.when === "today"
                        ? today
                        : isDayFilter(f.when)
                          ? f.when
                          : null
                }
                onPick={(key) =>
                  pickWhen(
                    key === "overdue"
                      ? "overdue"
                      : key === today
                        ? "today"
                        : key
                  )
                }
              />
              <ColumnChart
                title="Done per day"
                summary={doneSummary(perDay)}
                columns={doneColumns(perDay, today)}
                selected={doneMode && isDayFilter(f.when) ? f.when : null}
                onPick={(day) => set({ sort: "done", when: day })}
              />
              <AreaSplit
                {...split}
                area={f.area}
                onPick={(area) => pickArea(f.area === area ? "all" : area)}
              />
            </div>
          </>
        )}
      </section>

      {wide ? (
        <div className={`${pinned} space-y-1`}>
          <div className="flex items-center gap-3">
            <div className="w-60 shrink-0">{areaControl}</div>
            <span aria-hidden="true" className="text-sm text-ayu-subtle">
              Sort
            </span>
            <div className="shrink-0">{sortControl}</div>
            <div className="ml-auto">{newTodo}</div>
          </div>
          {projectChips}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">{whenChips}</div>
            <div className="flex w-56 shrink-0">{searchBox}</div>
          </div>
        </div>
      ) : (
        <>
          {/* On a phone only Area and Projects stay pinned: the rest
              would cover the list. */}
          <div className={`${pinned} space-y-1`}>
            {areaControl}
            {projectChips}
          </div>
          <div className="-mt-4 space-y-2">
            {whenChips}
            <div className="flex flex-col gap-2">
              {searchBox}
              {sortControl}
            </div>
          </div>
        </>
      )}

      <section aria-labelledby={listId} className="-mt-3 space-y-4">
        <h2 id={listId} className="sr-only">
          {doneMode ? "Recently done" : "Open todos"}
        </h2>
        {status}
        {shown.length === 0 ? (
          <div className="space-y-3">
            <Empty>
              {emptyLine(
                f,
                data.todos.some((t) => !t.done)
              )}
            </Empty>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="space-y-1.5">
              {!doneMode && (
                <h3
                  className={`flex items-baseline gap-2 text-sm font-medium ${
                    g.key === "overdue" ? "text-ayu-red" : "text-ayu-text"
                  }`}
                >
                  {g.label}
                  <span className="text-ayu-subtle tabular-nums">
                    {g.todos.length}
                  </span>
                </h3>
              )}
              {rows(g.todos)}
            </div>
          ))
        )}
      </section>

      {!doneMode && (
        <details className="group space-y-1.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-ayu-text [&::-webkit-details-marker]:hidden">
            Done in the last 14 days ({doneHere.length})
            <span
              aria-hidden="true"
              className="text-ayu-subtle transition-transform group-open:rotate-90 motion-reduce:transition-none"
            >
              ›
            </span>
          </summary>
          {doneHere.length === 0 ? (
            <Empty>Nothing done here in the last 14 days.</Empty>
          ) : (
            rows(doneHere)
          )}
        </details>
      )}
      <ToastBar toast={saves.toast} onUndo={saves.undo} />
    </div>
  );
}
