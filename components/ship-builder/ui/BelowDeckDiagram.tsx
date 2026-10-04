import { CELLS_PER_SEGMENT } from "@/lib/ship-builder/model/grid";
import type { Hull } from "@/lib/ship-builder/model/types";
import { compartmentSpecsOf } from "@/lib/ship-builder/sim/compartments";

/**
 * PLACEHOLDER: Task 1 builds the real cut-away diagram (walls, slots, labels).
 * This one only draws each compartment as a rect with its water level so the
 * trial's inset has something to show. The merge keeps Task 1's version.
 */
interface BelowDeckDiagramProps {
  hull: Hull;
  /** Water per compartment id (0..1), for the trial inset. */
  water?: Record<string, number>;
  /** Opened compartment ids, drawn with a gash mark. */
  opened?: readonly string[];
  /** Given: wall slots are buttons that call this with the boundary. */
  onCycle?: (at: number) => void;
  className?: string;
}

export default function BelowDeckDiagram({
  hull,
  water = {},
  opened = [],
  className,
}: BelowDeckDiagramProps) {
  const length = hull.lengthSegments * CELLS_PER_SEGMENT;
  const specs = compartmentSpecsOf(hull);
  const HEIGHT = length / 4;
  return (
    <svg
      viewBox={`0 0 ${length} ${HEIGHT}`}
      role="img"
      aria-label="Below deck"
      className={className}
    >
      {specs.map((spec) => {
        const level = Math.min(Math.max(water[spec.id] ?? 0, 0), 1);
        const isOpened = opened.includes(spec.id);
        return (
          <g key={spec.id}>
            <rect
              x={spec.fromX}
              y={0}
              width={spec.toX - spec.fromX}
              height={HEIGHT}
              className="fill-slate-100 stroke-slate-500 dark:fill-slate-800 dark:stroke-slate-400"
              strokeDasharray={isOpened ? "2 2" : undefined}
            />
            <rect
              x={spec.fromX}
              y={HEIGHT * (1 - level)}
              width={spec.toX - spec.fromX}
              height={HEIGHT * level}
              className="fill-sky-400 dark:fill-sky-500"
            />
          </g>
        );
      })}
    </svg>
  );
}
