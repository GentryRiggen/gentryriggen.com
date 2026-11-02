"use client";

import { useEffect, useState } from "react";
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

/**
 * Puts the filters in the address in place (no new history entry), keeping
 * the entry's own state. Next's fields are left out so its router takes the
 * new address and doesn't write the old one back.
 */
function writeFilters(f: TodoFilters) {
  if (!onTodosPath()) return;
  const search = formatFilters(f);
  if (search === window.location.search) return;
  const kept = { ...(window.history.state as Record<string, unknown> | null) };
  delete kept.__NA;
  delete kept.__PRIVATE_NEXTJS_INTERNALS_TREE;
  window.history.replaceState(
    kept,
    "",
    `${window.location.pathname}${search}${window.location.hash}`
  );
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

  // The address follows the filters (and a fresh entry gets them).
  useEffect(() => {
    writeFilters(filters);
  }, [filters, entryKey]);

  return [filters, setFilters];
}
