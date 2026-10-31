import type { ViewTodo } from "@/lib/jim/view";

/**
 * Todo dates, titles and grouping for the Notes Home, mirroring the Mac
 * viewer (bin/view/core.js and home.js in Jim's repo). Dates are plain
 * YYYY-MM-DD strings, read as UTC so a daylight-saving change can't shift
 * a day.
 */

const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 864e5);
}

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * 864e5).toISOString().slice(0, 10);
}

/** "Nov 2". */
export function fmtShort(iso: string): string {
  return `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}

/** "Mon, Nov 2" (weekday from the date itself, not the device clock). */
export function fmtDay(iso: string): string {
  const day = new Date(utc(iso)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${day}, ${fmtShort(iso)}`;
}

export function monthName(m: number): string {
  return MON[m - 1] ?? "";
}

/** Markdown links become their label; *, _ and ` go. */
export function stripMd(s: string): string {
  return String(s)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "");
}

/** A todo line as a short title: no "(due …)", no "See …" pointer, no tags. */
export function todoTitle(text: string): string {
  return stripMd(text)
    .replace(/(\s+#(?=[a-z0-9-]*[a-z])[a-z0-9-]+)+\s*$/, "")
    .replace(/\s*\(due [^)]*\)/, "")
    .replace(/\.?\s*(See|Saved in|Ideas in)\b.*$/, "")
    .trim();
}

/** A recurring todo carries "every N days/weeks/…" in its due group. */
export function isRecurring(text: string): boolean {
  return /\(due [^)]*\bevery \d+ (day|week|month|year)s?\b/i.test(text);
}

/** "2d late", "today", "tomorrow", "in 5d", then "Nov 15"; "no date". */
export function dueLabel(due: string, today: string): string {
  if (!due) return "no date";
  const n = daysBetween(today, due);
  if (n < 0) return `${-n}d late`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n <= 7) return `in ${n}d`;
  return fmtShort(due);
}

export interface TodoGroups {
  overdue: ViewTodo[];
  today: ViewTodo[];
  /** Due in 1 to 7 days. */
  week: ViewTodo[];
  /** Due later, then undated. */
  later: ViewTodo[];
}

function byDue(a: ViewTodo, b: ViewTodo): number {
  if (!a.due !== !b.due) return a.due ? -1 : 1;
  return a.due.localeCompare(b.due) || a.order - b.order;
}

/** Open todos by when they're due, each group soonest first. */
export function groupTodos(todos: ViewTodo[], today: string): TodoGroups {
  const groups: TodoGroups = { overdue: [], today: [], week: [], later: [] };
  for (const t of [...todos].filter((t) => !t.done).sort(byDue)) {
    const n = t.due ? daysBetween(today, t.due) : null;
    if (n === null || n > 7) groups.later.push(t);
    else if (n < 0) groups.overdue.push(t);
    else if (n === 0) groups.today.push(t);
    else groups.week.push(t);
  }
  return groups;
}

/** A todo's text without the "(done YYYY-MM-DD)" a check-off adds. */
export function withoutDone(text: string): string {
  return text.replace(/\s*\(done \d{4}-\d{2}-\d{2}\)/g, "").trim();
}

/**
 * The line a todo became once checked off, from a fresh payload: done, the
 * same text apart from its "(done …)" stamp, the same area and project, and
 * the nearest line to where it was. Null when it isn't there (it changed).
 */
export function doneLine(
  data: { todos: ViewTodo[]; doneTodos: ViewTodo[] },
  todo: ViewTodo
): ViewTodo | null {
  const want = withoutDone(todo.text);
  const found = [...data.todos, ...data.doneTodos].filter(
    (t) =>
      t.done &&
      withoutDone(t.text) === want &&
      t.area === todo.area &&
      t.project === todo.project
  );
  found.sort(
    (a, b) => Math.abs(a.order - todo.order) - Math.abs(b.order - todo.order)
  );
  return found[0] ?? null;
}
