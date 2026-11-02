"use client";

import { useEffect, useRef, useState } from "react";
import type { JimNavType } from "@/components/jim/useJimRouter";
import { formatJimPath } from "@/lib/jim/routes";
import {
  DEFAULT_FILTERS,
  formatFilters,
  parseFilters,
  type TodoFilters,
} from "@/lib/jim/todosPage";

const TODOS_PATH = formatJimPath({ kind: "page", page: "todos" });

function onTodosPath(): boolean {
  return window.location.pathname.replace(/\/+$/, "") === TODOS_PATH;
}

/** The filters in the address, when it is the Todos page's. */
function readFilters(): TodoFilters {
  return onTodosPath() ? parseFilters(window.location.search) : DEFAULT_FILTERS;
}

/** How long the search waits after the last key before it is in the address. */
export const SEARCH_WRITE_MS = 300;

const RESET_EVENT = "jim:todos-reset";

/** Todos picked again while it shows (sidebar or pill): back to no filters. */
export function resetTodoFilters(): void {
  window.dispatchEvent(new Event(RESET_EVENT));
}

/**
 * Puts the filters in the address in place (no new history entry), keeping
 * the entry's own state. Next's fields are left out so its router takes the
 * new address and doesn't write the old one back. Safari refuses too many
 * address changes in a short time (a SecurityError): the address is then
 * skipped and the page carries on.
 */
function writeFilters(f: TodoFilters) {
  try {
    if (!onTodosPath()) return;
    const search = formatFilters(f);
    if (search === window.location.search) return;
    const kept = {
      ...(window.history.state as Record<string, unknown> | null),
    };
    delete kept.__NA;
    delete kept.__PRIVATE_NEXTJS_INTERNALS_TREE;
    window.history.replaceState(
      kept,
      "",
      `${window.location.pathname}${search}${window.location.hash}`
    );
  } catch {
    // The address is a convenience; the filters still apply.
  }
}

/**
 * The Todos page's filters, kept in its address (?area=work&project=…) so a
 * reload, Back or a shared link brings them back. A change replaces the
 * entry's address; Back or Forward to a Todos entry reads it again; a fresh
 * entry for the page (Notes reopened from Chat) gets the filters showing.
 */
export default function useTodoFilters(
  entryKey: string,
  navType: JimNavType
): [TodoFilters, (next: TodoFilters) => void] {
  const [filters, setFilters] = useState<TodoFilters>(readFilters);
  // Back or Forward to a Todos entry: its address has the filters.
  const [shownFor, setShownFor] = useState(entryKey);
  if (shownFor !== entryKey) {
    setShownFor(entryKey);
    if (navType === "pop" && onTodosPath()) setFilters(readFilters());
  }

  // Picked again from the navigation: start over (the view stays).
  useEffect(() => {
    const reset = () =>
      setFilters((now) => ({ ...DEFAULT_FILTERS, view: now.view }));
    window.addEventListener(RESET_EVENT, reset);
    return () => window.removeEventListener(RESET_EVENT, reset);
  }, []);

  // The address follows the filters (and a fresh entry gets them). The
  // search waits for a pause in typing; everything else goes at once.
  const written = useRef<TodoFilters | null>(null);
  useEffect(() => {
    const before = written.current;
    const typing =
      before !== null &&
      before.q !== filters.q &&
      formatFilters({ ...before, q: "" }) ===
        formatFilters({ ...filters, q: "" });
    const write = () => {
      written.current = filters;
      writeFilters(filters);
    };
    if (!typing) {
      write();
      return;
    }
    const timer = setTimeout(write, SEARCH_WRITE_MS);
    return () => clearTimeout(timer);
  }, [filters, entryKey]);

  return [filters, setFilters];
}
