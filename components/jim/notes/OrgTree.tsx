"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Empty, OpenLink } from "@/components/jim/notes/NotesUi";
import type { DirectoryPerson, WorkDirectory } from "@/lib/jim/view";

/**
 * The directory as a collapsible, indented tree: each manager above their
 * reports. Narrow by design (no wide chart), so it fits a phone.
 */

export interface OrgNode {
  person: DirectoryPerson;
  reports: OrgNode[];
  /** Everyone under them, at any depth. */
  total: number;
}

/** Deeper than this stops (a guard; real orgs are far shallower). */
const MAX_DEPTH = 12;

/**
 * The org as trees, biggest first. A person whose manager isn't in the
 * directory (or who has none) is a root; a cycle is cut where it closes.
 */
export function buildOrg(directory: WorkDirectory): OrgNode[] {
  const byId = new Map(directory.people.map((p) => [p.id, p]));
  const reportsOf = new Map<number, DirectoryPerson[]>();
  for (const p of directory.people) {
    if (p.managerId === null || p.managerId === p.id) continue;
    if (!byId.has(p.managerId)) continue;
    const list = reportsOf.get(p.managerId) ?? [];
    list.push(p);
    reportsOf.set(p.managerId, list);
  }
  const placed = new Set<number>();
  const grow = (p: DirectoryPerson, depth: number): OrgNode => {
    placed.add(p.id);
    const reports =
      depth >= MAX_DEPTH
        ? []
        : (reportsOf.get(p.id) ?? [])
            .filter((r) => !placed.has(r.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((r) => grow(r, depth + 1));
    const total = reports.reduce((n, r) => n + 1 + r.total, 0);
    return { person: p, reports, total };
  };
  const isRoot = (p: DirectoryPerson) =>
    p.managerId === null || p.managerId === p.id || !byId.has(p.managerId);
  const roots = directory.people.filter(isRoot).map((p) => grow(p, 0));
  // Anyone left sits in a manager loop: start a tree at each.
  for (const p of directory.people) {
    if (!placed.has(p.id)) roots.push(grow(p, 0));
  }
  return roots.sort(
    (a, b) => b.total - a.total || a.person.name.localeCompare(b.person.name)
  );
}

interface OrgTreeProps {
  directory: WorkDirectory;
  onOpen: (id: number) => void;
  hrefFor?: (id: number) => string;
}

interface BranchProps extends Omit<OrgTreeProps, "directory"> {
  node: OrgNode;
  open: ReadonlySet<number>;
  onToggle: (id: number) => void;
}

function Branch({ node, open, onToggle, onOpen, hrefFor }: BranchProps) {
  const { person, reports, total } = node;
  const isOpen = open.has(person.id);
  const groupId = `jim-org-${person.id}`;
  return (
    <li>
      <div className="flex items-center">
        {reports.length ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={groupId}
            aria-label={`${isOpen ? "Hide" : "Show"} ${person.name}'s team`}
            onClick={() => onToggle(person.id)}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
          >
            <ChevronRight
              aria-hidden="true"
              className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="w-11 shrink-0" />
        )}
        <OpenLink
          href={hrefFor?.(person.id)}
          onOpen={() => onOpen(person.id)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-2 text-left hover:bg-white/[0.04]"
        >
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate ${person.path ? "text-ayu-accent" : "text-ayu-text"}`}
            >
              {person.name}
            </span>
            {person.title && (
              <span className="block truncate text-sm text-ayu-subtle">
                {person.title}
              </span>
            )}
          </span>
          {total > 0 && (
            <span className="shrink-0 rounded-full bg-white/[0.06] px-2 text-xs text-ayu-subtle tabular-nums">
              {total}
              <span className="sr-only"> under them</span>
            </span>
          )}
        </OpenLink>
      </div>
      {reports.length > 0 && isOpen && (
        <ul id={groupId} className="ml-5 border-l border-white/[0.08] pl-1">
          {reports.map((r) => (
            <Branch
              key={r.person.id}
              node={r}
              open={open}
              onToggle={onToggle}
              onOpen={onOpen}
              hrefFor={hrefFor}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The org chart: roots open, everything below folded until tapped. */
export default function OrgTree({ directory, onOpen, hrefFor }: OrgTreeProps) {
  const roots = useMemo(() => buildOrg(directory), [directory]);
  const [open, setOpen] = useState<ReadonlySet<number>>(
    () => new Set(roots.map((r) => r.person.id))
  );
  if (!roots.length) return <Empty>No directory yet.</Empty>;
  const toggle = (id: number) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };
  return (
    <ul aria-label="Org chart" className="jim-card overflow-hidden px-1 py-1">
      {roots.map((r) => (
        <Branch
          key={r.person.id}
          node={r}
          open={open}
          onToggle={toggle}
          onOpen={onOpen}
          hrefFor={hrefFor}
        />
      ))}
    </ul>
  );
}
