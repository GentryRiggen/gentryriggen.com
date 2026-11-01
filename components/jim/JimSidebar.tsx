"use client";

import type { Ref } from "react";
import {
  Briefcase,
  Dumbbell,
  Flag,
  HeartPulse,
  House,
  LogOut,
  MessageCircle,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import JimMark from "@/components/jim/JimMark";
import { SearchField } from "@/components/jim/notes/NotesSearch";
import { onPlainClick } from "@/components/jim/notes/NotesUi";
import {
  CHAT_ROUTE,
  formatJimPath,
  NOTES_PAGES,
  PAGE_LABELS,
  type JimRoute,
  type NotesPage,
} from "@/lib/jim/routes";

export interface SidebarAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

interface JimSidebarProps {
  /** The entry lit up: Chat, or the Notes page showing (or opened over). */
  active: "chat" | NotesPage | null;
  onNavigate: (route: JimRoute) => void;
  /** Jim is working on a reply: the mark breathes. */
  busy: boolean;
  search: string;
  onSearch: (value: string) => void;
  searchRef: Ref<HTMLInputElement>;
  /** "⌘K" on a Mac, "Ctrl K" elsewhere. */
  shortcut: string;
  /** Who Jim speaks as; opens the persona sheet. */
  persona: { name: string | null; onOpen: () => void };
  /** What the ⋯ menu holds on a phone, Sign out aside. */
  actions: SidebarAction[];
  onSignOut: () => void;
}

const PAGE_ICONS: Record<NotesPage, LucideIcon> = {
  home: House,
  work: Briefcase,
  money: Wallet,
  people: Users,
  health: HeartPulse,
  training: Dumbbell,
  golf: Flag,
};

const ITEM =
  "group flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition-colors duration-150";

function NavItem({
  route,
  label,
  icon: Icon,
  selected,
  onNavigate,
}: {
  route: JimRoute;
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onNavigate: (route: JimRoute) => void;
}) {
  return (
    <li>
      <a
        href={formatJimPath(route)}
        aria-current={selected ? "page" : undefined}
        onClick={onPlainClick(() => onNavigate(route))}
        className={`${ITEM} ${
          selected
            ? "bg-ayu-accent/12 text-ayu-accent ring-1 ring-ayu-accent/25 ring-inset"
            : "text-ayu-subtle hover:bg-white/[0.05] hover:text-ayu-text"
        }`}
      >
        <Icon
          aria-hidden="true"
          className="size-[1.125rem] shrink-0"
          strokeWidth={selected ? 2.25 : 2}
        />
        {label}
      </a>
    </li>
  );
}

/**
 * The desktop sidebar: Jim, the search, every page, and the settings the
 * phone keeps in its ⋯ menu.
 */
export default function JimSidebar({
  active,
  onNavigate,
  busy,
  search,
  onSearch,
  searchRef,
  shortcut,
  persona,
  actions,
  onSignOut,
}: JimSidebarProps) {
  return (
    <div className="jim-glass flex h-full w-60 shrink-0 flex-col border-r border-white/[0.06]">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <JimMark busy={busy} />
        <p className="text-lg font-semibold tracking-tight text-ayu-text">
          Jim
        </p>
      </div>
      <div className="shrink-0 px-3 pb-3">
        <SearchField
          value={search}
          onChange={onSearch}
          inputRef={searchRef}
          shortcut={shortcut}
        />
      </div>
      <nav
        aria-label="Jim"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
      >
        <ul className="space-y-0.5">
          <NavItem
            route={CHAT_ROUTE}
            label="Chat"
            icon={MessageCircle}
            selected={active === "chat"}
            onNavigate={onNavigate}
          />
        </ul>
        <p className="mt-5 mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-ayu-subtle uppercase">
          Notes
        </p>
        <ul className="space-y-0.5">
          {NOTES_PAGES.map((page) => (
            <NavItem
              key={page}
              route={{ kind: "page", page }}
              label={PAGE_LABELS[page]}
              icon={PAGE_ICONS[page]}
              selected={active === page}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>
      <div className="shrink-0 space-y-0.5 border-t border-white/[0.06] px-3 pt-3 pb-4">
        <button
          type="button"
          onClick={persona.onOpen}
          className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition-colors duration-150 hover:border-ayu-accent/30 hover:bg-white/[0.05]"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ayu-accent/12 text-ayu-accent ring-1 ring-ayu-accent/25 ring-inset"
          >
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-ayu-subtle">Persona</span>
            <span className="block truncate font-medium text-ayu-text">
              {persona.name ?? "Choose a voice"}
            </span>
          </span>
        </button>
        {actions.map(({ label, icon: Icon, onSelect }) => (
          <button
            key={label}
            type="button"
            onClick={onSelect}
            className={`${ITEM} text-left text-sm text-ayu-subtle hover:bg-white/[0.05] hover:text-ayu-text`}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onSignOut}
          className={`${ITEM} text-left text-sm text-ayu-subtle hover:bg-ayu-red/10 hover:text-ayu-red`}
        >
          <LogOut aria-hidden="true" className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}
