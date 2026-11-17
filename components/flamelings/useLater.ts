import { useCallback, useEffect, useRef } from "react";

/** `window.setTimeout` that is cleared when the component goes away. */
export function useLater(): (fn: () => void, ms: number) => void {
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);
  return useCallback((fn, ms) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
}
