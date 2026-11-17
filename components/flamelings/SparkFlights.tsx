import { useEffect, useRef, type RefObject } from "react";
import SparkIcon from "./SparkIcon";

export interface Burst {
  id: number;
  amount: number;
  /** Where the sparks start, in viewport pixels. */
  x: number;
  y: number;
}

const MAX_PARTICLES = 8;
const FLIGHT_MS = 650;
const STAGGER_MS = 55;

/** How many particles carry `amount` sparks, and how many sparks each lands. */
export function sharesOf(amount: number): number[] {
  const count = Math.max(1, Math.min(MAX_PARTICLES, amount));
  const base = Math.floor(amount / count);
  const shares = Array.from({ length: count }, () => base);
  shares[count - 1] += amount - base * count;
  return shares;
}

interface FlightProps {
  burst: Burst;
  target: RefObject<HTMLElement | null>;
  onLand: (sparks: number) => void;
  onDone: (id: number) => void;
}

function Flight({ burst, target, onLand, onDone }: FlightProps) {
  const shares = sharesOf(burst.amount);
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const rect = target.current?.getBoundingClientRect();
    const toX = rect ? rect.left + 30 : burst.x;
    const toY = rect ? rect.top + rect.height / 2 : burst.y - 200;
    let left = shares.length;
    const finish = (share: number) => {
      onLand(share);
      left -= 1;
      if (left === 0) onDone(burst.id);
    };
    shares.forEach((share, i) => {
      const node = nodes.current[i];
      if (!node || typeof node.animate !== "function") {
        window.setTimeout(() => finish(share), 0);
        return;
      }
      const spread = (i - (shares.length - 1) / 2) * 16;
      const dx = toX - burst.x;
      const dy = toY - burst.y;
      const animation = node.animate(
        [
          { transform: "translate(0px, 0px) scale(0.4)", opacity: 0 },
          {
            transform: `translate(${spread}px, -50px) scale(1.15)`,
            opacity: 1,
            offset: 0.25,
          },
          {
            transform: `translate(${dx}px, ${dy}px) scale(0.7)`,
            opacity: 1,
          },
        ],
        {
          duration: FLIGHT_MS,
          delay: i * STAGGER_MS,
          easing: "cubic-bezier(0.5, 0, 0.7, 0.9)",
          fill: "both",
        }
      );
      animation.onfinish = () => {
        node.style.visibility = "hidden";
        finish(share);
      };
    });
    // The flight runs once for this burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {shares.map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          aria-hidden="true"
          data-testid="spark-particle"
          className="pointer-events-none fixed z-[60] opacity-0"
          style={{ left: burst.x - 14, top: burst.y - 14 }}
        >
          <SparkIcon className="size-7 drop-shadow-[0_0_6px_rgba(255,201,40,0.9)]" />
        </span>
      ))}
    </>
  );
}

interface SparkFlightsProps {
  bursts: readonly Burst[];
  target: RefObject<HTMLElement | null>;
  onLand: (sparks: number) => void;
  onDone: (id: number) => void;
}

/** Little sparks that fly from where they were earned to the counter. */
export default function SparkFlights({
  bursts,
  target,
  onLand,
  onDone,
}: SparkFlightsProps) {
  return (
    <>
      {bursts.map((burst) => (
        <Flight
          key={burst.id}
          burst={burst}
          target={target}
          onLand={onLand}
          onDone={onDone}
        />
      ))}
    </>
  );
}
