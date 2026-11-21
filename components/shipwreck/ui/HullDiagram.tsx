"use client";

import type { BodyPose } from "@/lib/shipwreck/sim/track";
import type { Opening, ShipSpec } from "@/lib/shipwreck/ships/types";

/**
 * The ship's side profile from her own data: hull, decks, superstructure,
 * funnels and the watertight compartments (bow to the right). Optionally
 * the water in each compartment, the holes and the sea level tilted with
 * the trim; in the editor each compartment is a tap target.
 */

/** viewBox units per metre. */
const S = 2;
const PAD = 4;
const TOP_Z = 56;

interface HullDiagramProps {
  spec: ShipSpec;
  /** 0..1 fill per compartment (as spec.compartments), live. */
  water?: readonly number[];
  openings?: readonly Opening[];
  /** The whole ship's pose, for the sea line (omit after the break). */
  pose?: BodyPose | null;
  selected?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  className?: string;
  title: string;
}

export default function HullDiagram({
  spec,
  water,
  openings = [],
  pose,
  selected,
  onToggle,
  className = "",
  title,
}: HullDiagramProps) {
  const x0 = spec.stations[0].x;
  const x1 = spec.stations[spec.stations.length - 1].x;
  const W = (x1 - x0) * S + PAD * 2;
  const H = TOP_Z * S + PAD * 2;
  const X = (x: number) => PAD + (x - x0) * S;
  const Z = (z: number) => PAD + (TOP_Z - z) * S;

  const keel = spec.stations.map((st) => [st.x, st.offsets[0][0]] as const);
  const sheer = spec.stations.map((st) => [st.x, spec.sheerZ(st.x)] as const);
  const hullPath =
    `M${sheer.map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`).join("L")}` +
    `L${[...keel]
      .reverse()
      .map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`)
      .join("L")}Z`;

  // The deckhouses up to the boat deck, over the longest superstructure box
  // (the bridge deck), where the funnels stand.
  const longest = [...spec.superstructure].sort(
    (a, b) => b.toX - b.fromX - (a.toX - a.fromX)
  )[0];
  const boatZ = spec.decks.find((d) => d.name === "Boat")?.z;
  const house =
    longest && boatZ !== undefined && boatZ > longest.topZ
      ? {
          fromX: longest.fromX,
          toX: longest.toX,
          baseZ: longest.topZ,
          topZ: boatZ,
        }
      : null;

  // Sea level in the ship frame: earth z = 0 at ship point (x, 0, z).
  let sea: [number, number, number, number] | null = null;
  if (pose && pose.part === "whole") {
    const sp = Math.sin(pose.pitch);
    const cp = Math.cos(pose.pitch) * Math.cos(pose.roll);
    const zAt = (x: number) => (sp * x - pose.z) / cp;
    sea = [X(x0 - 4), Z(zAt(x0 - 4)), X(x1 + 4), Z(zAt(x1 + 4))];
  }

  return (
    <svg
      viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`}
      className={className}
      role={onToggle ? "group" : "img"}
      aria-label={title}
    >
      <defs>
        <clipPath id="sw-hull-clip">
          <path d={hullPath} />
        </clipPath>
      </defs>
      {/* Superstructure and funnels. */}
      {spec.superstructure.map((b, i) => (
        <rect
          key={`s${i}`}
          x={X(b.fromX)}
          y={Z(b.topZ)}
          width={(b.toX - b.fromX) * S}
          height={(b.topZ - spec.sheerZ((b.fromX + b.toX) / 2)) * S + 1}
          fill="#e7e2d4"
          opacity={0.75}
        />
      ))}
      {house && (
        <rect
          x={X(house.fromX)}
          y={Z(house.topZ)}
          width={(house.toX - house.fromX) * S}
          height={(house.topZ - house.baseZ) * S + 1}
          fill="#e7e2d4"
          opacity={0.6}
        />
      )}
      {spec.funnels.map((f, i) => (
        <rect
          key={`f${i}`}
          x={X(f.x - 3.5)}
          y={Z(f.topZ)}
          width={7 * S}
          height={(f.topZ - (house?.topZ ?? f.baseZ)) * S}
          fill={f.dummy ? "#c9a06a" : "#d9a35a"}
          stroke="#111827"
          strokeWidth={0.8}
          transform="skewX(8)"
          style={{ transformOrigin: `${X(f.x)}px ${Z(f.baseZ)}px` }}
        />
      ))}
      {/* The hull. */}
      <path d={hullPath} fill="#111827" stroke="#cbd5e1" strokeWidth={1.2} />
      <g clipPath="url(#sw-hull-clip)">
        {spec.compartments.map((c, i) => {
          const top = Math.max(c.aftBulkheadTopZ, c.fwdBulkheadTopZ);
          const fill = Math.max(0, Math.min(1, water?.[i] ?? 0));
          const on = selected?.has(c.id) ?? false;
          return (
            <g key={c.id}>
              {on && (
                <rect
                  x={X(c.fromX)}
                  y={Z(top)}
                  width={(c.toX - c.fromX) * S}
                  height={top * S}
                  fill="#ef4444"
                  opacity={0.28}
                />
              )}
              {fill > 0.001 && (
                <rect
                  data-water={c.id}
                  x={X(c.fromX)}
                  y={Z(top * fill)}
                  width={(c.toX - c.fromX) * S}
                  height={top * fill * S}
                  fill="#38bdf8"
                  opacity={0.85}
                />
              )}
            </g>
          );
        })}
        {spec.decks.map((d) => (
          <line
            key={d.name}
            x1={X(x0)}
            x2={X(x1)}
            y1={Z(d.z)}
            y2={Z(d.z)}
            stroke="#64748b"
            strokeWidth={0.5}
            opacity={0.6}
          />
        ))}
      </g>
      {/* Bulkheads, to their own tops. */}
      {spec.compartments.slice(1).map((c) => (
        <line
          key={`b${c.id}`}
          x1={X(c.fromX)}
          x2={X(c.fromX)}
          y1={Z(0.6)}
          y2={Z(c.aftBulkheadTopZ)}
          stroke="#e2e8f0"
          strokeWidth={1.4}
        />
      ))}
      {/* Holes: red jagged marks. */}
      {openings.map((o, i) => {
        const zMid = (o.zLow + o.zHigh) / 2;
        const len = Math.max(4, Math.min(14, Math.sqrt(o.areaM2) * 20));
        const pts: string[] = [];
        for (let k = 0; k <= 6; k += 1) {
          const x = o.x - len / 2 + (len * k) / 6;
          const z = zMid + (k % 2 === 0 ? 1.2 : -1.2);
          pts.push(`${X(x).toFixed(1)},${Z(z).toFixed(1)}`);
        }
        return (
          <polyline
            key={`o${i}`}
            data-hole={o.compartmentId}
            points={pts.join(" ")}
            fill="none"
            stroke="#f87171"
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
        );
      })}
      {sea && (
        <line
          data-testid="shipwreck-sea-line"
          x1={sea[0]}
          y1={sea[1]}
          x2={sea[2]}
          y2={sea[3]}
          stroke="#7dd3fc"
          strokeWidth={1.4}
          strokeDasharray="6 4"
        />
      )}
      {/* Tap targets: each compartment's full height. */}
      {onToggle &&
        spec.compartments.map((c) => {
          const on = selected?.has(c.id) ?? false;
          return (
            <rect
              key={`t${c.id}`}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${c.label}: ${on ? "open, tap to close" : "tap to open"}`}
              data-testid={`shipwreck-comp-${c.id}`}
              x={X(c.fromX)}
              y={PAD}
              width={(c.toX - c.fromX) * S}
              height={H - PAD * 2}
              fill="transparent"
              className="cursor-pointer outline-none focus-visible:fill-sky-300/20"
              onClick={() => onToggle(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(c.id);
                }
              }}
            />
          );
        })}
    </svg>
  );
}
