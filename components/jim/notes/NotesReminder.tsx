"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BackLink, Empty } from "@/components/jim/notes/NotesUi";
import {
  reminderError,
  toLocalInput,
  withOffset,
} from "@/components/jim/notes/reminderUi";
import {
  doneReminder,
  getReminder,
  patchReminder,
  type ReminderPatch,
  type Reminder,
} from "@/lib/jim/reminders";

interface NotesReminderProps {
  id: string;
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onBack: () => void;
  backLabel?: string;
  backHref?: string;
  backAside?: ReactNode;
  /** After Done: the shell goes to the list and says "Done". */
  onDone: () => void;
  /** The list's address, for the gone message. */
  listHref?: string;
  onList: () => void;
}

const BTN =
  "min-h-11 rounded-full px-4 text-sm font-medium ring-1 ring-white/10 ring-inset bg-white/[0.06] text-ayu-text hover:bg-white/[0.1] disabled:opacity-50";

/** One reminder: what it says, when, and how to move or finish it. */
export default function NotesReminder({
  id,
  api,
  getToken,
  onBack,
  backLabel = "Reminders",
  backHref,
  backAside,
  onDone,
  listHref,
  onList,
}: NotesReminderProps) {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "gone" | "error">(
    "loading"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [at, setAt] = useState("");

  useEffect(() => {
    let live = true;
    setState("loading");
    getReminder(id, getToken, undefined, api)
      .then((r) => {
        if (!live) return;
        setReminder(r);
        setState(r ? "ready" : "gone");
      })
      .catch((err) => {
        if (!live) return;
        setError(reminderError(err, "Couldn't load that reminder."));
        setState("error");
      });
    return () => {
      live = false;
    };
  }, [id, api, getToken]);

  async function change(body: ReminderPatch) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await patchReminder(id, body, getToken, undefined, api);
      setReminder(next);
      setEditing(false);
    } catch (err) {
      setError(reminderError(err, "Couldn't change that reminder."));
    } finally {
      setBusy(false);
    }
  }

  async function done() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await doneReminder(id, getToken, undefined, api);
      onDone();
    } catch (err) {
      setError(reminderError(err, "Couldn't finish that reminder."));
      setBusy(false);
    }
  }

  const back = (
    <BackLink
      label={backLabel}
      onBack={onBack}
      href={backHref}
      aside={backAside}
    />
  );

  if (state === "loading") {
    return (
      <article className="space-y-5">
        {back}
        <p className="text-ayu-subtle">Loading…</p>
      </article>
    );
  }
  if (state === "gone" || state === "error" || !reminder) {
    return (
      <article className="space-y-5">
        {back}
        {state === "error" ? (
          <p role="alert" className="text-ayu-text">
            {error}
          </p>
        ) : (
          <>
            <Empty>This reminder is done or gone.</Empty>
            <a
              href={listHref ?? "/jim/reminders"}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                onList();
              }}
              className="flex min-h-11 w-fit items-center text-ayu-accent"
            >
              All reminders
            </a>
          </>
        )}
      </article>
    );
  }

  return (
    <article className="space-y-5">
      {back}
      <header className="space-y-1">
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text [overflow-wrap:anywhere]">
          {reminder.text}
        </h2>
        <p className="text-ayu-subtle">{reminder.when}</p>
      </header>
      {error && (
        <p role="alert" className="text-sm text-ayu-red">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void done()}
          className="min-h-11 rounded-full jim-glow px-5 font-medium text-ayu-bg hover:brightness-110 disabled:opacity-50"
        >
          Done
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void change({ snooze: "10m" })}
          className={BTN}
        >
          Snooze 10 min
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void change({ snooze: "1h" })}
          className={BTN}
        >
          Snooze 1 hour
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void change({ snooze: "tomorrow" })}
          className={BTN}
        >
          Tomorrow 9:00
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setAt(toLocalInput(new Date(reminder.at)));
            setEditing((v) => !v);
          }}
          className={BTN}
        >
          Edit time
        </button>
      </div>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (at) void change({ at: withOffset(at) });
          }}
          className="jim-card flex flex-wrap items-end gap-3 p-4"
        >
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-sm text-ayu-subtle">New time</span>
            <input
              type="datetime-local"
              value={at}
              step={900}
              onChange={(e) => setAt(e.target.value)}
              className="min-h-11 w-full max-w-full rounded-lg bg-white/[0.06] px-3 text-base text-ayu-text ring-1 ring-white/10 ring-inset focus:ring-ayu-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !at}
            className="min-h-11 rounded-full jim-glow px-5 font-medium text-ayu-bg hover:brightness-110 disabled:opacity-50"
          >
            Save
          </button>
        </form>
      )}
    </article>
  );
}
