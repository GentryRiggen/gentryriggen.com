import { Check } from "lucide-react";
import { Chip, Empty, Rows, Section } from "@/components/jim/notes/NotesUi";
import { eventsByDay, localDay, timeLabel } from "@/lib/jim/notesData";
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
  /** Puts "Done: <title>" in the chat box (Gentry sends it). */
  onDone: (title: string) => void;
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

interface TodoRowProps {
  todo: ViewTodo;
  today: string;
  onDone: (title: string) => void;
}

function TodoRow({ todo, today, onDone }: TodoRowProps) {
  const title = todoTitle(todo.text) || todo.text;
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
    <li className="flex items-center gap-3 py-1.5 pr-1.5 pl-4">
      <div className="min-w-0 flex-1 py-1">
        <span
          data-title
          className="block text-ayu-text [overflow-wrap:anywhere]"
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
      <button
        type="button"
        aria-label={`Done: ${title}`}
        onClick={() => onDone(title)}
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-ayu-muted px-3 text-sm text-ayu-text hover:border-ayu-accent hover:text-ayu-accent"
      >
        <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
        Done
      </button>
    </li>
  );
}

interface TodoGroupProps {
  title: string;
  todos: ViewTodo[];
  today: string;
  onDone: (title: string) => void;
  tone?: string;
}

function TodoGroup({ title, todos, today, onDone, tone }: TodoGroupProps) {
  if (!todos.length) return null;
  return (
    <div className="space-y-1.5">
      <h3 className={`text-sm font-medium ${tone ?? "text-ayu-text"}`}>
        {title}
      </h3>
      <Rows>
        {todos.map((t) => (
          <TodoRow
            key={`${t.order}-${t.text}`}
            todo={t}
            today={today}
            onDone={onDone}
          />
        ))}
      </Rows>
    </div>
  );
}

function Todos({ data, onDone }: NotesHomeProps) {
  const g = groupTodos(data.todos, data.today);
  const open = g.overdue.length + g.today.length + g.week.length;
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
        today={data.today}
        onDone={onDone}
      />
      <TodoGroup
        title="Today"
        todos={g.today}
        today={data.today}
        onDone={onDone}
      />
      <TodoGroup
        title="Next 7 days"
        todos={g.week}
        today={data.today}
        onDone={onDone}
      />
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
          <Rows>
            {g.later.map((t) => (
              <TodoRow
                key={`${t.order}-${t.text}`}
                todo={t}
                today={data.today}
                onDone={onDone}
              />
            ))}
          </Rows>
        </details>
      )}
    </Section>
  );
}

/** Home: the calendar this week, then what's due. */
export default function NotesHome({ data, onDone }: NotesHomeProps) {
  const date = new Date(`${data.today}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="space-y-8">
      <p className="text-lg font-semibold text-ayu-text">{date}</p>
      <Calendar data={data} />
      <Todos data={data} onDone={onDone} />
    </div>
  );
}
