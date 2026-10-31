"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doneLine } from "@/lib/jim/todos";
import {
  TODO_MESSAGES,
  toggleTodo,
  type TodoResult,
  type ViewData,
  type ViewTodo,
} from "@/lib/jim/view";

/** How long "Done · Undo" (or a failure) stays up. */
export const TOAST_MS = 5_000;

/** A todo's box as shown: checked or not, and whether it is saving. */
export interface Mark {
  done: boolean;
  pending: boolean;
}

export type ToastBody =
  | {
      kind: "done";
      todo: ViewTodo;
      /** The refetch after the save, which has the line as it is now. */
      fresh: Promise<ViewData | null>;
    }
  | { kind: "error"; message: string };

export type Toast = ToastBody & { id: number };

export type DoneToast = Extract<Toast, { kind: "done" }>;

export function todoKey(t: Pick<ViewTodo, "order" | "text">): string {
  return `${t.order}-${t.text}`;
}

export interface TodoSaves {
  marks: Record<string, Mark>;
  toast: Toast | null;
  toggle: (todo: ViewTodo, done: boolean) => void;
  undo: (toast: DoneToast) => void;
}

interface Options {
  /** The payload showing; fresh data clears the boxes no longer saving. */
  data: ViewData | null;
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  /** Fetches the notes again; resolves to the fresh payload or null. */
  onChanged: () => Promise<ViewData | null>;
}

/**
 * The todo checkboxes' saves. Held by the Notes shell rather than Home, so
 * leaving Home while a save is out keeps what is still saving, its Undo and
 * the refetch after it.
 */
export default function useTodoSaves({
  data,
  api,
  getToken,
  onChanged,
}: Options): TodoSaves {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);
  /** Todos saving now: a second tap on one is ignored. */
  const saving = useRef(new Set<string>());
  /** The todo requests, sent one at a time. */
  const queue = useRef<Promise<void>>(Promise.resolve());
  /** Checked off this session, with the refetch that has the done line. */
  const saved = useRef(new Map<string, Promise<ViewData | null>>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Fresh data has the truth: keep only the boxes still saving.
  const [marksFor, setMarksFor] = useState(data);
  if (marksFor !== data) {
    setMarksFor(data);
    setMarks((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([, m]) => m.pending))
    );
  }

  useEffect(() => {
    saved.current.clear();
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = useCallback((next: ToastBody) => {
    toastId.current += 1;
    setToast({ ...next, id: toastId.current });
  }, []);

  /**
   * Ticks a todo (or unticks it). The box changes at once; the requests go
   * one at a time, in tap order. `line` is the line to send when it isn't
   * the todo as listed (an Undo sends the line the check-off produced).
   */
  const send = useCallback(
    (todo: ViewTodo, done: boolean, line?: Promise<ViewTodo | null>) => {
      const key = todoKey(todo);
      if (saving.current.has(key)) return;
      saving.current.add(key);
      saved.current.delete(key);
      setMarks((prev) => ({ ...prev, [key]: { done, pending: true } }));
      if (!done) setToast(null);
      queue.current = queue.current.then(async () => {
        const target = line ? await line : todo;
        const result: TodoResult = target
          ? await toggleTodo(target, done, getToken, undefined, api)
          : { ok: false, reason: "changed", message: TODO_MESSAGES.changed };
        saving.current.delete(key);
        if (result.ok) {
          // Refetch even if the shell went away meanwhile: it is cheap and
          // keeps the shared cache true.
          const fresh = onChanged();
          if (done) saved.current.set(key, fresh);
          if (!mounted.current) return;
          setMarks((prev) => ({ ...prev, [key]: { done, pending: false } }));
          if (done) show({ kind: "done", todo, fresh });
          return;
        }
        if (result.reason !== "denied") void onChanged();
        if (!mounted.current) return;
        // Back to what the list says, and why.
        setMarks((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        show({ kind: "error", message: result.message });
      });
    },
    [api, getToken, onChanged, show]
  );

  /** Undo sends the line as it is now, once the refetch has it. */
  const undoSaved = useCallback(
    (todo: ViewTodo, fresh: Promise<ViewData | null>) => {
      send(
        todo,
        false,
        fresh.then(
          (next) => (next ? doneLine(next, todo) : null),
          () => null
        )
      );
    },
    [send]
  );

  const toggle = useCallback(
    (todo: ViewTodo, done: boolean) => {
      // Unticking one ticked this session, before the list caught up: the
      // listed line is the open one, so go the Undo way.
      const fresh = done ? undefined : saved.current.get(todoKey(todo));
      if (fresh) undoSaved(todo, fresh);
      else send(todo, done);
    },
    [send, undoSaved]
  );

  const undo = useCallback(
    (t: DoneToast) => undoSaved(t.todo, t.fresh),
    [undoSaved]
  );

  return { marks, toast, toggle, undo };
}
