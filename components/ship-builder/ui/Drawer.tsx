"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { panelClass } from "./styles";

interface DrawerProps {
  side: "left" | "right";
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** At lg and up, shrink the aside to a rail. Ignored below lg. */
  collapsed?: boolean;
  /** Present when the aside can collapse at lg; called to flip the state. */
  onCollapsedChange?: () => void;
  children: ReactNode;
}

const COLLAPSE_BUTTON_CLASS =
  "hidden rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 lg:inline-flex dark:text-slate-400 dark:hover:bg-slate-800";

export default function Drawer({
  side,
  label,
  open,
  onOpenChange,
  collapsed = false,
  onCollapsedChange,
  children,
}: DrawerProps) {
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const left = side === "left";
  const closed = left ? "-translate-x-full" : "translate-x-full";
  const isRail = collapsed && onCollapsedChange !== undefined;
  const collapseRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const hasMounted = useRef(false);

  // Collapsing hides the focused button and expanding unmounts the rail
  // button, so hand focus to the button that replaces it. Skipped on mount so
  // a page load doesn't pull focus.
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    (isRail ? expandRef : collapseRef).current?.focus();
  }, [isRail]);

  function handleClose() {
    onOpenChange(false);
    toggleRef.current?.focus();
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
        className={`absolute top-3 z-20 rounded-md border border-slate-300 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 ${
          left ? "left-3" : "right-20"
        }`}
      >
        {label}
      </button>
      <aside
        id={id}
        aria-label={label}
        className={`absolute inset-y-0 z-30 w-72 overflow-y-auto transition-[transform,visibility] lg:static lg:z-auto lg:translate-x-0 ${panelClass} ${
          left ? "left-0 border-r" : "right-0 border-l"
        } ${open ? "visible translate-x-0" : `invisible lg:visible ${closed}`} ${
          isRail ? "lg:w-10 lg:shrink-0 lg:overflow-hidden" : ""
        }`}
      >
        {isRail && (
          <button
            ref={expandRef}
            type="button"
            aria-label={`Expand ${label}`}
            aria-expanded={false}
            aria-controls={id}
            onClick={onCollapsedChange}
            className="hidden h-full w-full flex-col items-center gap-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 lg:flex dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span aria-hidden="true">{left ? "›" : "‹"}</span>
            <span aria-hidden="true" className="[writing-mode:vertical-rl]">
              {label}
            </span>
          </button>
        )}
        <div
          data-testid={`drawer-content-${label}`}
          className={isRail ? "lg:hidden" : undefined}
        >
          {/* On the right, keep ✕ clear of the fixed ThemeToggle. */}
          <div
            className={`flex justify-end p-2 lg:hidden ${left ? "" : "pr-20"}`}
          >
            <button
              type="button"
              aria-label={`Close ${label}`}
              onClick={handleClose}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
          {onCollapsedChange && (
            <div
              className={`hidden p-2 lg:flex ${left ? "justify-end" : "justify-start"}`}
            >
              <button
                ref={collapseRef}
                type="button"
                aria-label={`Collapse ${label}`}
                aria-expanded={true}
                aria-controls={id}
                onClick={onCollapsedChange}
                className={COLLAPSE_BUTTON_CLASS}
              >
                <span aria-hidden="true">{left ? "‹" : "›"}</span>
              </button>
            </div>
          )}
          {children}
        </div>
      </aside>
    </>
  );
}
