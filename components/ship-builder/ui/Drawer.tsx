"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  createContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  /**
   * Replaces the visible label in the small-screen toggle (for a live
   * summary). The button keeps the drawer label as its accessible name.
   */
  toggleContent?: ReactNode;
  children: ReactNode;
}

/**
 * Lets a panel render controls (such as a search box) into the drawer's
 * sticky header. `undefined` outside a drawer; `null` until the slot mounts.
 */
export const DrawerHeaderSlot = createContext<HTMLElement | null | undefined>(
  undefined
);

/** A 44px square icon button, the minimum comfortable touch target. */
const ICON_BUTTON_CLASS =
  "h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:outline-sky-400";
const ICON_SIZE = 24;

export default function Drawer({
  side,
  label,
  open,
  onOpenChange,
  collapsed = false,
  onCollapsedChange,
  toggleContent,
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
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Things scrolled into view (keyboard focus, find-in-page, tests) must
  // land below the sticky header, whose height changes with its contents.
  useEffect(() => {
    const aside = asideRef.current;
    const header = headerRef.current;
    if (!aside || !header || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      aside.style.scrollPaddingTop = `${header.offsetHeight}px`;
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

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
        aria-label={toggleContent ? label : undefined}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
        className={`absolute top-3 z-20 inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 ${
          left ? "left-3" : "right-3"
        }`}
      >
        {toggleContent ?? label}
      </button>
      <aside
        ref={asideRef}
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
          {/*
            Sticky so the close / collapse buttons never scroll away. The
            opaque background hides the panel content that scrolls beneath it.
          */}
          <div
            ref={headerRef}
            data-testid={`drawer-header-${label}`}
            className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 p-2">
              <span className="min-w-0 flex-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
              </span>
              <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={handleClose}
                className={`inline-flex lg:hidden ${ICON_BUTTON_CLASS}`}
              >
                <X aria-hidden="true" size={ICON_SIZE} />
              </button>
              {onCollapsedChange && (
                <button
                  ref={collapseRef}
                  type="button"
                  aria-label={`Collapse ${label}`}
                  aria-expanded={true}
                  aria-controls={id}
                  onClick={onCollapsedChange}
                  className={`hidden lg:inline-flex ${ICON_BUTTON_CLASS}`}
                >
                  {left ? (
                    <ChevronLeft aria-hidden="true" size={ICON_SIZE} />
                  ) : (
                    <ChevronRight aria-hidden="true" size={ICON_SIZE} />
                  )}
                </button>
              )}
            </div>
            <div ref={setHeaderSlot} />
          </div>
          <DrawerHeaderSlot.Provider value={headerSlot}>
            {children}
          </DrawerHeaderSlot.Provider>
        </div>
      </aside>
    </>
  );
}
