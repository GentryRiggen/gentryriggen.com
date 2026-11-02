import { addDays, daysBetween, fmtShort } from "@/lib/jim/todos";
import type { Person, ViewTodo } from "@/lib/jim/view";

/**
 * The Todos page's filters, sorting, grouping and chart numbers. Pure
 * functions over the payload's todos; dates are YYYY-MM-DD strings.
 */

export type TodoArea = "all" | "work" | "personal";
export type TodoSort = "due" | "project" | "done";
/** A due bucket, or one day (YYYY-MM-DD): a tapped chart column. */
export type TodoWhen =
  "any" | "overdue" | "today" | "week" | "later" | "nodate" | string;
/** With the charts at the top, or the list alone. */
export type TodoView = "charts" | "list";

export interface TodoFilters {
  area: TodoArea;
  /** A note basename, NO_PROJECT, or "" for every project. */
  project: string;
  when: TodoWhen;
  q: string;
  sort: TodoSort;
  view: TodoView;
}

/** The project filter for todos tagged with no project (never a basename). */
export const NO_PROJECT = "_none";

export const DEFAULT_FILTERS: TodoFilters = {
  area: "all",
  project: "",
  when: "any",
  q: "",
  sort: "due",
  view: "charts",
};

const AREAS: readonly TodoArea[] = ["all", "work", "personal"];
const SORTS: readonly TodoSort[] = ["due", "project", "done"];
const VIEWS: readonly TodoView[] = ["charts", "list"];
export const WHEN_BUCKETS = [
  "any",
  "overdue",
  "today",
  "week",
  "later",
  "nodate",
] as const;
const PROJECT = /^[a-z0-9][a-z0-9-]{0,99}$/;
const SEARCH_MAX = 100;
/** How far back the payload's done todos go. */
export const DONE_DAYS = 14;
/** "This week": today through this many days out. */
const WEEK_DAYS = 7;

function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isDayFilter(when: TodoWhen): boolean {
  return isDay(when);
}

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  return value !== null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** The filters a query string names; anything unknown is the default. */
export function parseFilters(search: string): TodoFilters {
  const p = new URLSearchParams(search);
  const project = p.get("project") ?? "";
  const when = p.get("when") ?? "";
  return {
    area: pick(p.get("area"), AREAS, "all"),
    project: project === NO_PROJECT || PROJECT.test(project) ? project : "",
    when:
      (WHEN_BUCKETS as readonly string[]).includes(when) || isDay(when)
        ? when
        : "any",
    q: (p.get("q") ?? "").slice(0, SEARCH_MAX),
    sort: pick(p.get("sort"), SORTS, "due"),
    view: pick(p.get("view"), VIEWS, "charts"),
  };
}

/** "?area=work&project=x", defaults left out; "" when all are defaults. */
export function formatFilters(f: TodoFilters): string {
  const p = new URLSearchParams();
  if (f.area !== "all") p.set("area", f.area);
  if (f.project) p.set("project", f.project);
  if (f.when !== "any") p.set("when", f.when);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.sort !== "due") p.set("sort", f.sort);
  if (f.view !== "charts") p.set("view", f.view);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Anything narrowing the list (sort and view only reorder or hide). */
export function isFiltered(f: TodoFilters): boolean {
  return (
    f.area !== "all" || f.project !== "" || f.when !== "any" || !!f.q.trim()
  );
}

function inArea(t: ViewTodo, area: TodoArea): boolean {
  return area === "all" || t.area === area;
}

function inProject(t: ViewTodo, project: string): boolean {
  if (!project) return true;
  return project === NO_PROJECT ? !t.project : t.project === project;
}

function matches(t: ViewTodo, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    t.text.toLowerCase().includes(needle) ||
    (t.short ?? "").toLowerCase().includes(needle)
  );
}

function inWhen(t: ViewTodo, when: TodoWhen, today: string): boolean {
  if (when === "any") return true;
  if (!t.due) return when === "nodate";
  const n = daysBetween(today, t.due);
  switch (when) {
    case "overdue":
      return n < 0;
    case "today":
      return n === 0;
    case "week":
      return n >= 0 && n <= WEEK_DAYS;
    case "later":
      return n > WEEK_DAYS;
    case "nodate":
      return false;
    default:
      return t.due === when;
  }
}

/** Late first, then soonest, then undated; file order breaks ties. */
export function byDue(a: ViewTodo, b: ViewTodo): number {
  if (!a.due !== !b.due) return a.due ? -1 : 1;
  return a.due.localeCompare(b.due) || a.order - b.order;
}

/** The open todos the filters keep, by due date. */
export function filterTodos(
  todos: ViewTodo[],
  f: TodoFilters,
  today: string
): ViewTodo[] {
  return todos
    .filter(
      (t) =>
        !t.done &&
        inArea(t, f.area) &&
        inProject(t, f.project) &&
        inWhen(t, f.when, today) &&
        matches(t, f.q)
    )
    .sort(byDue);
}

function recentlyDone(t: ViewTodo, today: string): boolean {
  if (!t.done_on) return false;
  const n = daysBetween(t.done_on, today);
  return n >= 0 && n < DONE_DAYS;
}

/**
 * Todos done in the last 14 days the filters keep, newest first. A day in
 * the when filter means the day it was done.
 */
export function filterDone(
  done: ViewTodo[],
  f: TodoFilters,
  today: string
): ViewTodo[] {
  return done
    .filter(
      (t) =>
        recentlyDone(t, today) &&
        inArea(t, f.area) &&
        inProject(t, f.project) &&
        (!isDay(f.when) || t.done_on === f.when) &&
        matches(t, f.q)
    )
    .sort((a, b) => b.done_on.localeCompare(a.done_on) || b.order - a.order);
}

export interface ProjectCount {
  project: string;
  count: number;
}

/** Open todos per project in the area: most first, then by name; none last. */
export function projectCounts(
  todos: ViewTodo[],
  area: TodoArea
): ProjectCount[] {
  const counts = new Map<string, number>();
  let none = 0;
  for (const t of todos) {
    if (t.done || !inArea(t, area)) continue;
    if (t.project) counts.set(t.project, (counts.get(t.project) ?? 0) + 1);
    else none += 1;
  }
  const list = [...counts]
    .map(([project, count]) => ({ project, count }))
    .sort((a, b) => b.count - a.count || a.project.localeCompare(b.project));
  if (none) list.push({ project: NO_PROJECT, count: none });
  return list;
}

export interface TodoGroup {
  key: string;
  label: string;
  todos: ViewTodo[];
}

const BUCKETS: { key: string; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "nodate", label: "No date" },
];

function bucketOf(t: ViewTodo, today: string): string {
  if (!t.due) return "nodate";
  const n = daysBetween(today, t.due);
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n <= WEEK_DAYS) return "week";
  return "later";
}

/** Overdue, Today, Tomorrow, This week, Later, No date: the ones with todos. */
export function dueGroups(todos: ViewTodo[], today: string): TodoGroup[] {
  const sorted = [...todos].sort(byDue);
  return BUCKETS.map((b) => ({
    ...b,
    todos: sorted.filter((t) => bucketOf(t, today) === b.key),
  })).filter((g) => g.todos.length > 0);
}

/** One group per project, biggest first, "No project" last; each by due. */
export function projectGroups(
  todos: ViewTodo[],
  nameOf: (project: string) => string
): TodoGroup[] {
  const groups = new Map<string, ViewTodo[]>();
  for (const t of [...todos].sort(byDue)) {
    const key = t.project || NO_PROJECT;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups]
    .map(([key, list]) => ({
      key,
      label: key === NO_PROJECT ? "No project" : nameOf(key),
      todos: list,
    }))
    .sort((a, b) => {
      if ((a.key === NO_PROJECT) !== (b.key === NO_PROJECT)) {
        return a.key === NO_PROJECT ? 1 : -1;
      }
      return b.todos.length - a.todos.length || a.label.localeCompare(b.label);
    });
}

export interface TodoStats {
  open: number;
  overdue: number;
  /** Due today through seven days out. */
  week: number;
  /** Done in the last 14 days. */
  done: number;
}

export function todoStats(
  todos: ViewTodo[],
  done: ViewTodo[],
  today: string
): TodoStats {
  const open = todos.filter((t) => !t.done);
  return {
    open: open.length,
    overdue: open.filter((t) => inWhen(t, "overdue", today)).length,
    week: open.filter((t) => inWhen(t, "week", today)).length,
    done: done.filter((t) => recentlyDone(t, today)).length,
  };
}

export interface DayCount {
  day: string;
  n: number;
}

/** Done per day for the last 14 days, oldest first, today last. */
export function doneByDay(done: ViewTodo[], today: string): DayCount[] {
  return Array.from({ length: DONE_DAYS }, (_, i) => {
    const day = addDays(today, i - (DONE_DAYS - 1));
    return { day, n: done.filter((t) => t.done_on === day).length };
  });
}

/** How many are late, and how many fall due each day from today on. */
export function comingUp(
  todos: ViewTodo[],
  today: string,
  days: number = 14
): { late: number; days: DayCount[] } {
  const open = todos.filter((t) => !t.done && t.due);
  return {
    late: open.filter((t) => t.due < today).length,
    days: Array.from({ length: days }, (_, i) => {
      const day = addDays(today, i);
      return { day, n: open.filter((t) => t.due === day).length };
    }),
  };
}

export function areaSplit(todos: ViewTodo[]): {
  work: number;
  personal: number;
  unsorted: number;
} {
  const open = todos.filter((t) => !t.done);
  const work = open.filter((t) => t.area === "work").length;
  const personal = open.filter((t) => t.area === "personal").length;
  return { work, personal, unsorted: open.length - work - personal };
}

/** "3 days late", "today", "tomorrow", "Nov 7", "no date". */
export function dueChip(due: string, today: string): string {
  if (!due) return "no date";
  const n = daysBetween(today, due);
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} late`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return fmtShort(due);
}

/** A project's name: its person's, or its tag in words ("Pricing model"). */
export function projectLabel(
  project: string,
  people: Pick<Person, "name" | "path">[]
): string {
  if (!project || project === NO_PROJECT) return "No project";
  const person = people.find((p) => p.path === `people/${project}.md`);
  if (person?.name) return person.name;
  const words = project.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A project's note, when the payload names it (a person, or any note path
 * it carries with that basename); null when it can't be known.
 */
export function projectPath(
  project: string,
  people: Pick<Person, "path">[],
  knownPaths: string[]
): string | null {
  if (!project || project === NO_PROJECT) return null;
  const person = `people/${project}.md`;
  if (people.some((p) => p.path === person)) return person;
  return (
    knownPaths.find(
      (path) => path.slice(path.lastIndexOf("/") + 1) === `${project}.md`
    ) ?? null
  );
}
