"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis } from "lucide-react";

export type JimTab = "chat" | "notes";

export interface JimMenuItem {
  label: string;
  onSelect: () => void;
}

interface JimHeaderProps {
  onSignOut: () => void;
  /** The tab showing; with `onTab`, the header carries the Chat | Notes switch. */
  tab?: JimTab;
  onTab?: (tab: JimTab) => void;
  /** Extra menu entries, shown above Sign out (always last). */
  menuItems?: JimMenuItem[];
}

const TABS: { id: JimTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "notes", label: "Notes" },
];

/**
 * The one bar on the signed-in screens: Jim, the Chat | Notes switch and a
 * menu, in a single 48px row that clears the notch. Each control is 44px to
 * tap even where it looks smaller.
 */
export default function JimHeader({
  onSignOut,
  tab,
  onTab,
  menuItems = [],
}: JimHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const items = [...menuItems, { label: "Sign out", onSelect: onSignOut }];

  // Open on the first item; a tap anywhere else closes it.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      // Back on the button first, so Tab moves on from there.
      setMenuOpen(false);
      buttonRef.current?.focus();
      return;
    }
    const all = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ??
        []),
    ];
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = all.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const at = all.indexOf(document.activeElement as HTMLElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      next = (at + step + all.length) % all.length;
    } else return;
    event.preventDefault();
    all[next]?.focus();
  }

  return (
    <header className="shrink-0 border-b border-ayu-line bg-ayu-bg pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="mx-auto flex h-12 w-full max-w-[45rem] items-center gap-2 px-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-ayu-accent">Jim</h1>
        </div>

        {tab && onTab && (
          // A 36px pill track behind 44px-tall tabs whose own pill is 32px.
          <div
            role="tablist"
            aria-label="Jim"
            className="relative flex h-11 items-center before:absolute before:inset-x-0 before:top-1/2 before:h-9 before:-translate-y-1/2 before:rounded-full before:bg-ayu-panel"
          >
            {TABS.map(({ id, label }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`jim-tab-${id}`}
                  aria-selected={selected}
                  aria-controls={`jim-${id}`}
                  onClick={() => onTab(id)}
                  className="group relative flex h-11 items-center px-0.5"
                >
                  <span
                    className={`flex h-8 items-center rounded-full px-4 text-sm font-medium ${
                      selected
                        ? "bg-ayu-line text-ayu-accent"
                        : "text-ayu-subtle group-hover:text-ayu-text"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="relative flex flex-1 justify-end">
          <button
            ref={buttonRef}
            type="button"
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "jim-menu" : undefined}
            onClick={() => setMenuOpen((open) => !open)}
            className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:bg-ayu-panel hover:text-ayu-text"
          >
            <Ellipsis aria-hidden="true" className="size-5" />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              id="jim-menu"
              role="menu"
              aria-label="Menu"
              onKeyDown={onMenuKeyDown}
              className="absolute top-full right-0 z-20 mt-1 min-w-44 overflow-hidden rounded-xl border border-ayu-raised bg-ayu-panel shadow-xl shadow-black/50"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setMenuOpen(false);
                    // Before onSelect, which may move focus on purpose.
                    buttonRef.current?.focus();
                    item.onSelect();
                  }}
                  className="flex min-h-11 w-full items-center px-4 text-left text-base text-ayu-text hover:bg-ayu-raised focus:bg-ayu-raised focus:outline-none"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
