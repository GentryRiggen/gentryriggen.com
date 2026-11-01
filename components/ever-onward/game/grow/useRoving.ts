import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Roving tabindex for a radio group of buttons: one tab stop, arrow keys,
 * Home and End move focus, and the tab stop follows focus. Moving focus
 * never picks anything; Enter or Space (a click) does.
 */
export default function useRoving(count: number, checkedIndex: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const stop = Math.min(count - 1, Math.max(0, focus ?? checkedIndex));

  const move = (to: number) => {
    const next = (to + count) % count;
    setFocus(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(i + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(count - 1);
    }
  };

  return {
    /** Props for the radio at index `i` (spread onto the button). */
    radioProps: (i: number) => ({
      ref: (el: HTMLButtonElement | null) => {
        refs.current[i] = el;
      },
      tabIndex: i === stop ? 0 : -1,
      onFocus: () => setFocus(i),
      onKeyDown: (e: KeyboardEvent) => onKeyDown(e, i),
    }),
  };
}
