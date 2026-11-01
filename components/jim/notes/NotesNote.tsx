"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Empty } from "@/components/jim/notes/NotesUi";
import { JimError, type JimErrorKind } from "@/lib/jim/api";
import JimMarkdown from "@/lib/jim/markdown";
import { fmtShort } from "@/lib/jim/todos";
import { fetchNote, type Note } from "@/lib/jim/view";

interface NotesNoteProps {
  /** Repo-relative path, from a search result. */
  path: string;
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onBack: () => void;
}

type State =
  | { kind: "loading" }
  | { kind: "note"; note: Note }
  | { kind: "missing" }
  | { kind: "error"; error: JimErrorKind };

const ERRORS: Record<JimErrorKind, string> = {
  waking: "Couldn't load this note.",
  uncertain: "Couldn't load this note.",
  server: "Couldn't load this note.",
  rejected: "Couldn't load this note.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
};

function updatedLabel(updated: string): string | null {
  return /^\d{4}-\d{2}-\d{2}/.test(updated)
    ? `${fmtShort(updated)}, ${updated.slice(0, 4)}`
    : null;
}

/** One note from a search, read-only, rendered from its Markdown. */
export default function NotesNote({
  path,
  api,
  getToken,
  onBack,
}: NotesNoteProps) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetchNote(path, getToken, undefined, api).then(
      (note) => {
        if (current)
          setState(note ? { kind: "note", note } : { kind: "missing" });
      },
      (err: unknown) => {
        if (current) {
          setState({
            kind: "error",
            error: err instanceof JimError ? err.kind : "server",
          });
        }
      }
    );
    return () => {
      current = false;
    };
  }, [path, api, getToken, attempt]);

  const note = state.kind === "note" ? state.note : null;
  const updated = note ? updatedLabel(note.updated) : null;

  return (
    <article className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex min-h-11 items-center gap-1 rounded-md pr-3 pl-1 text-ayu-accent hover:bg-white/[0.06]"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
        Results
      </button>
      {state.kind === "loading" && (
        <div aria-busy="true" className="space-y-3">
          <p className="sr-only" role="status">
            Loading note…
          </p>
          <div className="h-7 w-48 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.04]" />
        </div>
      )}
      {state.kind === "missing" && (
        <Empty>{"That note isn't there anymore."}</Empty>
      )}
      {state.kind === "error" && (
        <div className="space-y-3">
          <p role="alert" className="text-ayu-text">
            {ERRORS[state.error]}
          </p>
          {state.error !== "denied" && (
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                setAttempt((n) => n + 1);
              }}
              className="min-h-11 rounded-full jim-glow px-5 font-medium text-ayu-bg hover:brightness-110"
            >
              Try again
            </button>
          )}
        </div>
      )}
      {note && (
        <>
          <header className="space-y-1">
            <h2 className="text-2xl font-semibold text-ayu-text [overflow-wrap:anywhere]">
              {note.title || note.path}
            </h2>
            <p className="text-sm text-ayu-subtle [overflow-wrap:anywhere]">
              {note.path}
            </p>
          </header>
          <div className="border-t border-ayu-line pt-5 text-ayu-text">
            {note.body.trim() ? (
              <JimMarkdown text={note.body} links="label" />
            ) : (
              <Empty>This note is empty.</Empty>
            )}
          </div>
          {updated && (
            <p className="text-sm text-ayu-subtle">Updated {updated}</p>
          )}
        </>
      )}
    </article>
  );
}
