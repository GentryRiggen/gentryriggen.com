"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle, Sunrise } from "lucide-react";
import {
  Chip,
  Empty,
  onPlainClick,
  Rows,
  Section,
} from "@/components/jim/notes/NotesUi";
import DailyWord from "@/components/jim/notes/DailyWord";
import ShortLabel from "@/components/jim/notes/ShortLabel";
import JimNoticed from "@/components/jim/notes/JimNoticed";
import NeedsYou from "@/components/jim/notes/NeedsYou";
import RemindersCard from "@/components/jim/notes/RemindersCard";
import RetroCard from "@/components/jim/notes/RetroCard";
import QuickLog from "@/components/jim/notes/QuickLog";
import { TodoCheckbox, ToastBar } from "@/components/jim/notes/TodoBits";
import {
  todoKey,
  type Mark,
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
import type { RetroKind } from "@/lib/jim/routes";
import type { CalendarEvent, ViewData, ViewTodo } from "@/lib/jim/view";

interface NotesHomeProps {
  data: ViewData;
  /** The checkbox saves, kept by the shell so they outlive this page. */
  saves: TodoSaves;
  /** Sends a quick-log sentence as a chat message and switches to Chat. */
  onLog: (text: string) => void;
  /** Puts outside-sourced text in the chat box, unsent, and switches to Chat. */
  onDraft: (text: string) => void;
  /** Opens the Todos page ("All todos →"). Without it the link is hidden. */
  onOpenTodos?: () => void;
  todosHref?: string;
  /** Plays the morning brief (a tap). Without it the button is hidden. */
  onHearBrief?: () => void;
  /** What the brief is waiting on: the button spins and says it. */
  briefStage?: string | null;
  /** Why the brief didn't play, shown under the button. */
  briefError?: string | null;
  /** Reminders card: its server, and where a tap goes. Without them it is hidden. */
  reminders?: {
    api: string;
    getToken: (force?: boolean) => Promise<string | null>;
    onOpen: (id: string | null) => void;
    hrefFor?: (id: string | null) => string;
  };
  /** Retro card: where a tap goes. Without it (or retro data) it is hidden. */
  retro?: {
    onOpen: (kind: RetroKind) => void;
    hrefFor?: (kind: RetroKind) => string;
  };
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
      <span className="w-16 shrink-0 pt-0.5 text-sm font-medium text-ayu-blue tabular-nums">
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
            {stamp ? `Calendar as of ${stamp}.` : "Calendar time unknown."}{" "}
            Refreshes every morning.
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
      <ul className="jim-card divide-y divide-white/[0.05] overflow-hidden">
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
      <TodoCheckbox
        label={title}
        checked={checked}
        pending={pending}
        onToggle={(done) => onToggle(todo, done)}
      />
      <div className="min-w-0 flex-1 py-1">
        <ShortLabel
          dataTitle
          short={todo.short}
          full={title}
          className={checked ? "text-ayu-subtle line-through" : "text-ayu-text"}
        />
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={`font-medium ${tone}`}>
            {dueLabel(todo.due, today)}
          </span>
          {AREA_LABEL[todo.area] && (
            <Chip tone={todo.area === "work" ? "blue" : "purple"}>
              {AREA_LABEL[todo.area]}
            </Chip>
          )}
          {isRecurring(todo.text) && (
            // Ticked and saving: the server adds the next one, so say so
            // before its reply (which then names the date).
            <Chip>{checked && pending ? "next one coming" : "repeats"}</Chip>
          )}
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
  onOpenTodos?: () => void;
  todosHref?: string;
}

function Todos({ data, marks, onToggle, onOpenTodos, todosHref }: TodosProps) {
  const [area, setArea] = useState<"all" | "work" | "personal">("all");
  const todos =
    area === "all" ? data.todos : data.todos.filter((t) => t.area === area);
  const g = groupTodos(todos, data.today);
  const open = g.overdue.length + g.today.length + g.week.length;
  const list = { today: data.today, marks, onToggle };
  return (
    <Section
      title="Todos"
      aside={g.overdue.length ? `${g.overdue.length} overdue` : undefined}
    >
      <div role="group" aria-label="Filter todos" className="flex gap-2">
        {(["all", "work", "personal"] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={area === a}
            onClick={() => setArea(a)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium ring-1 ring-inset ${
              area === a
                ? "bg-ayu-accent/15 text-ayu-accent ring-ayu-accent/30"
                : "text-ayu-subtle ring-white/10 hover:bg-white/[0.06]"
            }`}
          >
            {a === "all" ? "All" : AREA_LABEL[a]}
          </button>
        ))}
      </div>
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
      {onOpenTodos && (
        <a
          href={todosHref}
          onClick={onPlainClick(onOpenTodos)}
          className="-ml-3 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-ayu-accent hover:bg-white/[0.06]"
        >
          All todos
          <span aria-hidden="true">→</span>
        </a>
      )}
    </Section>
  );
}

/** "Good morning" and friends, by the device's clock. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Home: the calendar this week, then what's due, with boxes to tick. */
export default function NotesHome({
  data,
  saves,
  onLog,
  onDraft,
  onOpenTodos,
  todosHref,
  onHearBrief,
  briefStage = null,
  briefError = null,
  reminders,
  retro,
}: NotesHomeProps) {
  const date = new Date(`${data.today}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  // One column on a phone; where the page is wide (a desktop), the day on
  // the left and the calendar and todos beside it.
  return (
    <div className="space-y-8 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-8 @2xl:space-y-0">
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-ayu-accent uppercase">
            {greeting()}
          </p>
          <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text">
            {date}
          </p>
        </div>
        {onHearBrief && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onHearBrief}
              disabled={briefStage !== null}
              aria-busy={briefStage !== null ? true : undefined}
              className="jim-card flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-ayu-text hover:border-ayu-accent/40 hover:text-ayu-accent disabled:border-ayu-accent/30 disabled:text-ayu-accent disabled:hover:border-ayu-accent/30"
            >
              {briefStage !== null ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Sunrise aria-hidden="true" className="size-4" />
              )}
              {briefStage ?? "Hear your morning"}
            </button>
            {briefError && (
              <p
                role="alert"
                className="jim-rise rounded-xl border border-ayu-red/25 bg-ayu-red/10 px-3 py-2 text-sm text-ayu-red"
              >
                {briefError}
              </p>
            )}
          </div>
        )}
        {retro && <RetroCard retro={data.retro} {...retro} />}
        {data.daily && <DailyWord word={data.daily} />}
        {data.noticed && <JimNoticed items={data.noticed} onAsk={onLog} />}
        <div className="space-y-3">
          <TodayCard data={data} />
          <QuickLog today={data.today} onLog={onLog} />
        </div>
        {reminders && <RemindersCard {...reminders} />}
        {data.actions && (
          <NeedsYou
            actions={data.actions}
            actionsAsOf={data.actionsAsOf}
            today={data.today}
            onAsk={onLog}
            onDraft={onDraft}
          />
        )}
      </div>
      <div className="space-y-8">
        <Calendar data={data} />
        <Todos
          data={data}
          marks={saves.marks}
          onToggle={saves.toggle}
          onOpenTodos={onOpenTodos}
          todosHref={todosHref}
        />
      </div>
      <ToastBar toast={saves.toast} onUndo={saves.undo} />
    </div>
  );
}
