"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { BackLink, Empty } from "@/components/jim/notes/NotesUi";
import { timeLabel } from "@/lib/jim/notesData";
import { RETRO_MESSAGES, saveRetro } from "@/lib/jim/retro";
import type { RetroKind } from "@/lib/jim/routes";
import type { RetroData } from "@/lib/jim/view";

/** The server cleans answers to this length; the box stops there too. */
const MAX_ANSWER = 2000;

const TITLES: Record<RetroKind, string> = {
  morning: "Morning retro",
  evening: "Evening retro",
};

const KINDS: { id: RetroKind; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "evening", label: "Evening" },
];

const EMPTY = ["", "", ""];

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** False while the device says it has no connection. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true
  );
}

/**
 * "Saturday, November 1" in the device's locale. The day is a plain date,
 * read at noon UTC and shown in UTC, so no time zone can shift it.
 */
function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

interface NotesRetroProps {
  kind: RetroKind;
  /** The payload's retro; absent from an older server. */
  retro: RetroData | undefined;
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  /** The Morning | Evening switch. */
  onSwitch: (kind: RetroKind) => void;
  onBack: () => void;
  backLabel?: string;
  backHref?: string;
  backAside?: ReactNode;
  /** A save landed: the shell marks it on the payload (Home's card). */
  onSaved: (kind: RetroKind, day: string, answers: string[]) => void;
}

/**
 * A morning or evening retro: the server's three questions, the answers
 * saved for the day, and Save. The day is the one the page opened with, so
 * an evening finished after midnight still lands on its evening.
 */
export default function NotesRetro({
  kind,
  retro,
  api,
  getToken,
  onSwitch,
  onBack,
  backLabel = "Home",
  backHref,
  backAside,
  onSaved,
}: NotesRetroProps) {
  const online = useOnline();
  /** The retro the page opened with; a later payload for its day refreshes it. */
  const [shown, setShown] = useState(retro);
  if (retro && retro !== shown && (!shown || retro.day === shown.day)) {
    setShown(retro);
  }
  /** What's typed, per kind, kept across the switch. */
  const [drafts, setDrafts] = useState<Partial<Record<RetroKind, string[]>>>(
    {}
  );
  /** The answers last saved from here, and when, per kind. */
  const [savedHere, setSavedHere] = useState<
    Partial<Record<RetroKind, { answers: string[]; at: string }>>
  >({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = (
    <BackLink
      label={backLabel}
      onBack={onBack}
      href={backHref}
      aside={backAside}
    />
  );
  const header = (
    <>
      {back}
      <div>
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text">
          {TITLES[kind]}
        </h2>
        {shown && (
          <p className="mt-1 text-sm text-ayu-subtle">{dayLabel(shown.day)}</p>
        )}
      </div>
      <div
        role="tablist"
        aria-label="Which retro"
        className="jim-card grid grid-cols-2 gap-1 p-1"
      >
        {KINDS.map((k) => {
          const selected = k.id === kind;
          return (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                if (!selected) {
                  setError(null);
                  onSwitch(k.id);
                }
              }}
              className={`min-h-11 min-w-0 truncate rounded-xl px-2 text-sm font-medium transition-colors duration-200 ${
                selected
                  ? "bg-ayu-accent/12 text-ayu-accent ring-1 ring-ayu-accent/30 ring-inset"
                  : "text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>
    </>
  );

  if (!shown) {
    return (
      <article className="space-y-5">
        {header}
        <Empty>{RETRO_MESSAGES.unavailable}</Empty>
      </article>
    );
  }

  const side = shown[kind];
  const here = savedHere[kind];
  const saved = here?.answers ?? side.answers;
  const answers = drafts[kind] ?? saved ?? EMPTY;
  const isSaved = saved !== null && same(answers, saved);
  const empty = answers.every((a) => a.trim() === "");
  const day = shown.day;

  function edit(index: number, value: string) {
    setDrafts((prev) => {
      const next = [...(prev[kind] ?? saved ?? EMPTY)];
      next[index] = value;
      return { ...prev, [kind]: next };
    });
  }

  async function save() {
    if (saving || empty || !online) return;
    const sent = [...answers];
    const savingKind = kind;
    setSaving(true);
    setError(null);
    try {
      await saveRetro(getToken, api, {
        kind: savingKind,
        day,
        answers: sent,
      });
      setSavedHere((prev) => ({
        ...prev,
        [savingKind]: { answers: sent, at: new Date().toISOString() },
      }));
      onSaved(savingKind, day, sent);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : RETRO_MESSAGES.failed
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="space-y-5">
      {header}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        {side.questions.map((question, i) => (
          <label key={`${kind}-${i}`} className="block space-y-2">
            <span className="block text-ayu-text [overflow-wrap:anywhere]">
              {question}
            </span>
            <textarea
              value={answers[i] ?? ""}
              maxLength={MAX_ANSWER}
              rows={3}
              onChange={(e) => edit(i, e.target.value)}
              className="block w-full max-w-full resize-y rounded-xl bg-white/[0.06] px-3 py-2.5 text-base text-ayu-text ring-1 ring-white/10 ring-inset placeholder:text-ayu-subtle focus:ring-ayu-accent focus:outline-none"
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="text-sm text-ayu-red">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={saving || empty || !online}
            aria-busy={saving || undefined}
            className="min-h-11 rounded-full jim-glow px-6 font-medium text-ayu-bg hover:brightness-110 disabled:opacity-50"
          >
            Save
          </button>
          <p aria-live="polite" className="text-sm text-ayu-subtle">
            {!online
              ? "You're offline"
              : saving
                ? "Saving…"
                : isSaved
                  ? here && same(here.answers, answers)
                    ? `Saved ${timeLabel(here.at)}`
                    : "Saved"
                  : null}
          </p>
        </div>
      </form>
    </article>
  );
}
