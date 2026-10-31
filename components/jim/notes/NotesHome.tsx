"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Chip, Empty, Rows, Section } from "@/components/jim/notes/NotesUi";
import QuickLog from "@/components/jim/notes/QuickLog";
import {
  todoKey,
  type DoneToast,
  type Mark,
  type Toast,
  type TodoSaves,
} from "@/components/jim/notes/useTodoSaves";
import {
  eventsByDay,
  localDay,
  timeLabel,
  todaySummary,
} from "@/lib/jim/notesData";
import {
  addDays,
  daysBetween,
  dueLabel,
  fmtDay,
  fmtShort,
  groupTodos,
  isRecurring,
  todoTitle,
} from "@/lib/jim/todos";
import type { CalendarEvent, ViewData, ViewTodo } from "@/lib/jim/view";

interface NotesHomeProps {
  data: ViewData;
  /** The checkbox saves, kept by the shell so they outlive this page. */
  saves: TodoSaves;
  /** Sends a quick-log sentence as a chat message and switches to Chat. */
  onLog: (text: string) => void;
}

const AREA_LABEL: Record<string, string> = {
  work: "Work",
  personal: "Personal",
};

function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  return fmtDay(day);
}

function asOf(fetchedAt: string | undefined): string | null {
  if (!fetchedAt || Number.isNaN(Date.parse(fetchedAt))) return null;
  return `${fmtShort(localDay(fetchedAt))}, ${timeLabel(fetchedAt)}`;
}

function EventRow({ event }: { event: CalendarEvent }) {
  const time = event.allDay ? "All day" : timeLabel(event.start);
  const span =
    event.allDay || !event.end
      ? ""
      : `${timeLabel(event.start)}–${timeLabel(event.end)}`;
  const detail = [span, event.company ? "company" : event.where]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <span className="w-16 shrink-0 pt-0.5 text-sm text-ayu-blue tabular-nums">
        {time}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block [overflow-wrap:anywhere] ${event.company ? "text-ayu-subtle" : "text-ayu-text"}`}
        >
          {event.subject}
        </span>
        {detail && (
          <span className="block text-sm text-ayu-subtle [overflow-wrap:anywhere]">
            {detail}
          </span>
        )}
      </span>
    </li>
  );
}

function Calendar({ data }: { data: ViewData }) {
  const cal = data.calendar;
  const stamp = asOf(cal?.fetchedAt);
  const days = cal ? eventsByDay(cal.events, data.today) : [];
  return (
    <Section title="Calendar">
      {!cal ? (
        <Empty>No calendar snapshot yet.</Empty>
      ) : (
        <>
          {days.length === 0 ? (
            <Empty>Nothing on the calendar this week.</Empty>
          ) : (
            <div className="space-y-4">
              {days.map(({ day, events }) => (
                <div key={day} className="space-y-1.5">
                  <h3 className="text-sm font-medium text-ayu-text">
                    {dayLabel(day, data.today)}
                  </h3>
                  <Rows>
                    {events.map((e, i) => (
                      <EventRow key={`${e.start}-${i}`} event={e} />
                    ))}
                  </Rows>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-ayu-subtle">
            {stamp ? `Calendar as of ${stamp}.` : "Calendar time unknown."} Say
            &ldquo;refresh&rdquo; to Jim on the Mac for the latest.
          </p>
        </>
      )}
    </Section>
  );
}

function ago(days: number): string {
  if (days === 0) return "today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Three quick facts for today; rows without data are left out. */
function TodayCard({ data }: { data: ViewData }) {
  const [now, setNow] = useState(() => new Date());
  // "Now" moves on: again when fresh data lands, and every minute.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [data]);
  const { meeting, injectionDays, workouts } = todaySummary(data, now);
  const rows: { label: string; value: ReactNode }[] = [];
  if (meeting) {
    rows.push({
      label: "Next",
      value: (
        <>
          <span className="text-ayu-blue tabular-nums">{meeting.time}</span>{" "}
          {meeting.subject}
        </>
      ),
    });
  }
  if (injectionDays !== null) {
    rows.push({ label: "Injection", value: ago(injectionDays) });
  }
  if (workouts !== null) {
    rows.push({ label: "Workouts this week", value: workouts });
  }
  if (!rows.length) return null;
  return (
    <Section title="Today">
      <ul className="divide-y divide-ayu-line overflow-hidden rounded-xl bg-ayu-panel">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-baseline justify-between gap-4 px-4 py-2.5"
          >
            <span className="shrink-0 text-sm text-ayu-subtle">{r.label}</span>
            <span className="min-w-0 text-right text-ayu-text [overflow-wrap:anywhere]">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

interface TodoRowProps {
  todo: ViewTodo;
  today: string;
  mark: Mark | undefined;
  onToggle: (todo: ViewTodo, done: boolean) => void;
}

function TodoRow({ todo, today, mark, onToggle }: TodoRowProps) {
  const title = todoTitle(todo.text) || todo.text;
  const checked = mark ? mark.done : todo.done;
  const pending = mark?.pending ?? false;
  const n = todo.due ? daysBetween(today, todo.due) : null;
  const tone =
    n === null
      ? "text-ayu-subtle"
      : n < 0
        ? "text-ayu-red"
        : n === 0
          ? "text-ayu-accent"
          : "text-ayu-subtle";
  return (
    <li className="flex items-center gap-1 py-1.5 pr-4 pl-1">
      {/* 44px to tap, a 22px box to see. A tap while it saves does nothing. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-busy={pending || undefined}
        aria-label={title}
        onClick={() => {
          if (!pending) onToggle(todo, !checked);
        }}
        className="group flex size-11 shrink-0 items-center justify-center rounded-full transition-colors! duration-150!"
      >
        <span
          aria-hidden="true"
          className={`flex size-[22px] items-center justify-center rounded-md border-2 ${
            checked
              ? "border-ayu-accent bg-ayu-accent text-ayu-bg"
              : "border-ayu-muted group-hover:border-ayu-accent"
          }`}
        >
          {pending ? (
            <LoaderCircle
              className={`size-3.5 animate-spin motion-reduce:animate-none ${checked ? "" : "text-ayu-accent"}`}
              strokeWidth={3}
            />
          ) : (
            checked && <Check className="size-4" strokeWidth={3} />
          )}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-1">
        <span
          data-title
          className={`block [overflow-wrap:anywhere] ${
            checked ? "text-ayu-subtle line-through" : "text-ayu-text"
          }`}
        >
          {title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={`font-medium ${tone}`}>
            {dueLabel(todo.due, today)}
          </span>
          {AREA_LABEL[todo.area] && (
            <Chip tone={todo.area === "work" ? "blue" : "purple"}>
              {AREA_LABEL[todo.area]}
            </Chip>
          )}
          {isRecurring(todo.text) && <Chip>repeats</Chip>}
        </span>
      </div>
    </li>
  );
}

interface TodoListProps {
  todos: ViewTodo[];
  today: string;
  marks: Record<string, Mark>;
  onToggle: (todo: ViewTodo, done: boolean) => void;
}

function TodoList({ todos, today, marks, onToggle }: TodoListProps) {
  return (
    <Rows>
      {todos.map((t) => (
        <TodoRow
          key={todoKey(t)}
          todo={t}
          today={today}
          mark={marks[todoKey(t)]}
          onToggle={onToggle}
        />
      ))}
    </Rows>
  );
}

interface TodoGroupProps extends TodoListProps {
  title: string;
  tone?: string;
}

function TodoGroup({ title, tone, ...list }: TodoGroupProps) {
  if (!list.todos.length) return null;
  return (
    <div className="space-y-1.5">
      <h3 className={`text-sm font-medium ${tone ?? "text-ayu-text"}`}>
        {title}
      </h3>
      <TodoList {...list} />
    </div>
  );
}

interface TodosProps {
  data: ViewData;
  marks: Record<string, Mark>;
  onToggle: (todo: ViewTodo, done: boolean) => void;
}

function Todos({ data, marks, onToggle }: TodosProps) {
  const g = groupTodos(data.todos, data.today);
  const open = g.overdue.length + g.today.length + g.week.length;
  const list = { today: data.today, marks, onToggle };
  return (
    <Section
      title="Todos"
      aside={g.overdue.length ? `${g.overdue.length} overdue` : undefined}
    >
      {open + g.later.length === 0 && <Empty>No open todos.</Empty>}
      {open === 0 && g.later.length > 0 && (
        <Empty>Nothing due this week.</Empty>
      )}
      <TodoGroup
        title="Overdue"
        tone="text-ayu-red"
        todos={g.overdue}
        {...list}
      />
      <TodoGroup title="Today" todos={g.today} {...list} />
      <TodoGroup title="Next 7 days" todos={g.week} {...list} />
      {g.later.length > 0 && (
        <details className="group space-y-1.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-ayu-text [&::-webkit-details-marker]:hidden">
            Later <span className="text-ayu-subtle">{g.later.length}</span>
            <span
              aria-hidden="true"
              className="text-ayu-subtle transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          <TodoList todos={g.later} {...list} />
        </details>
      )}
    </Section>
  );
}

interface ToastBarProps {
  toast: Toast | null;
  onUndo: (toast: DoneToast) => void;
}

/** Floats above the home bar; always in the page, so it is announced. */
function ToastBar({ toast, onUndo }: ToastBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div role="status" aria-live="polite" className="contents">
        {toast && (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1 pr-1 pl-5 shadow-lg ${
              toast.kind === "error"
                ? "bg-ayu-raised text-ayu-red"
                : "bg-ayu-raised text-ayu-text"
            } ${toast.kind === "error" ? "pr-5" : ""}`}
          >
            {toast.kind === "done" ? (
              <>
                <span className="min-h-11 content-center">Done</span>
                <span aria-hidden="true" className="text-ayu-subtle">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => onUndo(toast)}
                  className="min-h-11 rounded-full px-3 font-medium text-ayu-accent hover:bg-ayu-panel"
                >
                  Undo
                </button>
              </>
            ) : (
              <span className="min-h-11 content-center [overflow-wrap:anywhere]">
                {toast.message}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Home: the calendar this week, then what's due, with boxes to tick. */
export default function NotesHome({ data, saves, onLog }: NotesHomeProps) {
  const date = new Date(`${data.today}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="space-y-8">
      <p className="text-lg font-semibold text-ayu-text">{date}</p>
      <div className="space-y-3">
        <TodayCard data={data} />
        <QuickLog today={data.today} onLog={onLog} />
      </div>
      <Calendar data={data} />
      <Todos data={data} marks={saves.marks} onToggle={saves.toggle} />
      <ToastBar toast={saves.toast} onUndo={saves.undo} />
    </div>
  );
}
