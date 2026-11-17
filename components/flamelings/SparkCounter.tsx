import { forwardRef, useEffect, useRef, useState } from "react";
import FlIcon from "./FlIcon";
import { SPARK_PILL } from "./styles";

const COUNT_MS = 420;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface SparkCounterProps {
  /** What to show. It counts up (or down) to a new value and pops. */
  value: number;
  className?: string;
}

/**
 * The spark counter: always visible in the pet view's top bar. It counts to
 * its new value, and pops when it grows (as sparks fly in and land).
 */
const SparkCounter = forwardRef<HTMLDivElement, SparkCounterProps>(
  function SparkCounter({ value, className = "" }, ref) {
    const [shown, setShown] = useState(value);
    const [pops, setPops] = useState(0);
    const [seen, setSeen] = useState(value);
    const shownRef = useRef(value);
    const reduced = prefersReducedMotion();

    // A growing value pops the icon (adjusted during render, not in an effect).
    if (value !== seen) {
      setSeen(value);
      if (value > seen) setPops((n) => n + 1);
    }

    useEffect(() => {
      const from = shownRef.current;
      if (from === value || reduced) return;
      const start = performance.now();
      let frame = 0;
      const step = (nowMs: number) => {
        const t = Math.min(1, (nowMs - start) / COUNT_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        const next = Math.round(from + (value - from) * eased);
        shownRef.current = next;
        setShown(next);
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      return () => cancelAnimationFrame(frame);
    }, [value, reduced]);

    const display = reduced ? value : shown;

    return (
      <div
        ref={ref}
        role="status"
        aria-label={`${value} sparks`}
        data-testid="sparks"
        data-value={value}
        className={`${SPARK_PILL} ${className}`}
      >
        <span key={pops} className={pops > 0 ? "fl-spark-pop" : undefined}>
          <FlIcon name="spark" className="size-6 sm:size-8" />
        </span>
        <span
          aria-hidden="true"
          className="min-w-[2ch] text-right tabular-nums"
        >
          {display}
        </span>
      </div>
    );
  }
);

export default SparkCounter;
