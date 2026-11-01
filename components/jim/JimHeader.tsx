"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis } from "lucide-react";
import JimMark from "@/components/jim/JimMark";

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
  /** Jim is working on a reply: the mark breathes. */
  busy?: boolean;
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
  busy = false,
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
    <header className="jim-glass relative z-10 shrink-0 border-b border-white/[0.06] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="mx-auto flex h-12 w-full max-w-[45rem] items-center gap-2 px-4">
        <div className="flex flex-1 items-center gap-2.5">
          <JimMark busy={busy} />
          <h1 className="text-[1.0625rem] font-semibold tracking-tight text-ayu-text">
            Jim
          </h1>
        </div>

        {tab && onTab && (
          // A 36px track behind 44px-tall tabs; the lit thumb slides under
          // the selected one (both tabs are the same width).
          <div
            role="tablist"
            aria-label="Jim"
            className="relative flex h-11 items-center before:absolute before:inset-x-0 before:top-1/2 before:h-9 before:-translate-y-1/2 before:rounded-full before:border before:border-white/[0.06] before:bg-ayu-line/70"
          >
            <span
              aria-hidden="true"
              className={`absolute top-1/2 left-0.5 h-8 w-[4.5rem] -translate-y-1/2 rounded-full bg-ayu-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_4px_12px_-4px_rgb(0_0_0/0.6)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
                tab === "notes" ? "translate-x-[4.75rem]" : ""
              }`}
            />
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
                    className={`flex h-8 w-[4.5rem] items-center justify-center rounded-full text-sm font-medium transition-colors duration-200 ${
                      selected
                        ? "text-ayu-accent"
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
            className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text aria-expanded:bg-white/[0.06] aria-expanded:text-ayu-text"
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
              className="jim-rise absolute top-full right-0 z-20 mt-1.5 min-w-56 origin-top-right overflow-hidden rounded-2xl border border-white/[0.08] bg-ayu-panel/90 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
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
                  className="flex min-h-12 w-full items-center rounded-xl px-3.5 text-left text-base whitespace-nowrap text-ayu-text hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none active:scale-100!"
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
