"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  BackLink,
  Empty,
  OpenLink,
  Rows,
  Section,
} from "@/components/jim/notes/NotesUi";
import { defaultAt, reminderError } from "@/components/jim/notes/reminderUi";
import { addReminder, listReminders, type Reminder } from "@/lib/jim/reminders";

const MAX_TEXT = 200;

interface NotesRemindersProps {
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onBack: () => void;
  backLabel?: string;
  backHref?: string;
  backAside?: ReactNode;
  onOpen: (id: string) => void;
  hrefFor?: (id: string) => string;
  /** A quiet line after something finished ("Done"). */
  notice?: string | null;
}

function ReminderRow({
  reminder,
  onOpen,
  href,
}: {
  reminder: Reminder;
  onOpen: () => void;
  href?: string;
}) {
  return (
    <li>
      <OpenLink
        href={href}
        onOpen={onOpen}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04]"
        linkClassName="no-underline"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-ayu-text [overflow-wrap:anywhere]">
            {reminder.text}
          </span>
          <span className="block text-sm text-ayu-subtle">{reminder.when}</span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-ayu-subtle"
        />
      </OpenLink>
    </li>
  );
}

/** The reminders list, with a form to add one. */
export default function NotesReminders({
  api,
  getToken,
  onBack,
  backLabel = "Home",
  backHref,
  backAside,
  onOpen,
  hrefFor,
  notice,
}: NotesRemindersProps) {
  const [items, setItems] = useState<Reminder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [at, setAt] = useState(() => defaultAt());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await listReminders(getToken, undefined, api));
    } catch (err) {
      setLoadError(reminderError(err, "Couldn't load reminders."));
    }
  }, [api, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || !at || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const made = await addReminder(at, clean, getToken, undefined, api);
      setItems((prev) =>
        [...(prev ?? []), made].sort((a, b) => a.at.localeCompare(b.at))
      );
      setText("");
      setAt(defaultAt());
    } catch (err) {
      setFormError(reminderError(err, "Couldn't add that reminder."));
    } finally {
      setSaving(false);
    }
  }

  const due = (items ?? []).filter((r) => r.sent !== null);
  const upcoming = (items ?? []).filter((r) => r.sent === null);

  return (
    <article className="space-y-6">
      <BackLink
        label={backLabel}
        onBack={onBack}
        href={backHref}
        aside={backAside}
      />
      <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text">
        Reminders
      </h2>
      {notice && (
        <p role="status" className="text-sm font-medium text-ayu-green">
          {notice}
        </p>
      )}

      <Section title="Add reminder">
        <form onSubmit={add} className="jim-card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-sm text-ayu-subtle">What</span>
            <input
              type="text"
              value={text}
              maxLength={MAX_TEXT}
              onChange={(e) => setText(e.target.value)}
              className="min-h-11 w-full rounded-lg bg-white/[0.06] px-3 text-base text-ayu-text ring-1 ring-white/10 ring-inset focus:ring-ayu-accent focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-ayu-subtle">When</span>
            <input
              type="datetime-local"
              value={at}
              step={900}
              onChange={(e) => setAt(e.target.value)}
              className="min-h-11 w-full max-w-full rounded-lg bg-white/[0.06] px-3 text-base text-ayu-text ring-1 ring-white/10 ring-inset focus:ring-ayu-accent focus:outline-none"
            />
          </label>
          {formError && (
            <p role="alert" className="text-sm text-ayu-red">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={saving || !text.trim() || !at}
            className="min-h-11 rounded-full jim-glow px-5 font-medium text-ayu-bg hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add reminder"}
          </button>
        </form>
      </Section>

      {loadError && (
        <div className="space-y-2">
          <p role="alert" className="text-ayu-text">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-11 text-sm font-medium text-ayu-accent"
          >
            Try again
          </button>
        </div>
      )}
      {!loadError && items === null && (
        <p className="text-ayu-subtle">Loading…</p>
      )}
      {due.length > 0 && (
        <Section title="Due">
          <Rows>
            {due.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                onOpen={() => onOpen(r.id)}
                href={hrefFor?.(r.id)}
              />
            ))}
          </Rows>
        </Section>
      )}
      {items !== null && (
        <Section title="Upcoming">
          {upcoming.length ? (
            <Rows>
              {upcoming.map((r) => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  onOpen={() => onOpen(r.id)}
                  href={hrefFor?.(r.id)}
                />
              ))}
            </Rows>
          ) : (
            <Empty>Nothing coming up.</Empty>
          )}
        </Section>
      )}
    </article>
  );
}
