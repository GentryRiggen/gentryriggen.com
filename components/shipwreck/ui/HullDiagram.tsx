"use client";

import { useId } from "react";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import type {
  Compartment,
  Opening,
  ShipSpec,
} from "@/lib/shipwreck/ships/types";
import { VENTS_SPOT, shoalSpot } from "@/lib/shipwreck/sim/run";
import { spotAria } from "@/lib/shipwreck/whatIf";
import { cargoLayer } from "@/lib/shipwreck/xray";

/**
 * The ship's side profile from her own data: hull, decks, superstructure,
 * funnels and the watertight compartments (bow to the right). Optionally
 * the water in each compartment, the holes and the sea level tilted with
 * the trim; in the editor each compartment is a tap target. A ship with
 * side bunkers (cells split by longitudinal bulkheads) also gets a plan
 * from above under the profile, port at the top, so the water in each
 * side's bunkers shows.
 */

/** viewBox units per metre. */
const S = 2;
const PAD = 4;
const TOP_Z = 56;
/** Room between the profile and the plan, and for the side labels. */
const PLAN_GAP = 6;

/** A storm ship's hatch coaming from above (11 ft 7 in × 54 ft), half sizes (m). */
const HATCH_HX = 1.77;
const HATCH_HW = 8.23;
/** A shoal scrape's tap target on the plan (m). */
const SHOAL_R = 4.5;

/** The least width of a wave spot's marker on the profile (m). */
const WAVE_SPOT_MIN_W = 16;

/**
 * Where a wave ship's spot is on her port side (ship frame, m): the box
 * round its openings, at least WAVE_SPOT_MIN_W wide so a finger finds it.
 */
export function waveSpotRect(
  spot: NonNullable<ShipSpec["wave"]>["spots"][number]
): { x0: number; x1: number; z0: number; z1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const o of spot.openings) {
    const h = Math.max(1, o.zHigh - o.zLow);
    const w = Math.max(WAVE_SPOT_MIN_W, o.areaM2 / h);
    x0 = Math.min(x0, o.x - w / 2);
    x1 = Math.max(x1, o.x + w / 2);
    z0 = Math.min(z0, o.zLow);
    z1 = Math.max(z1, o.zHigh);
  }
  return { x0, x1, z0, z1 };
}

/** The sea line is left out when the profile is this edge-on to it. */
const SEA_LINE_MIN_COS = 0.05;
/** And kept inside this many metres of the keel, up or down. */
const SEA_LINE_LIMIT_M = 400;

/** A cell the side profile draws: the full-breadth or centre ones. */
function inProfile(c: Compartment): boolean {
  return !c.span || c.span.side === "centre";
}

interface HullDiagramProps {
  spec: ShipSpec;
  /** 0..1 fill per compartment (as spec.compartments), live. */
  water?: readonly number[];
  /**
   * 0..1 fill per superstructure box (as spec.superstructure; her named
   * boxes', `SimFrame.boxWater`), live: drawn in each box from its floor.
   */
  boxWater?: readonly number[];
  openings?: readonly Opening[];
  /** The whole ship's pose, for the sea line (omit after the break). */
  pose?: BodyPose | null;
  selected?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  /** A storm ship: the hatches (numbers) whose covers have given way. */
  failedHatches?: ReadonlySet<number>;
  /** Her funnels' paint (her livery's); default `spec.funnelPaint`. */
  funnelPaint?: { funnel: number; top: number };
  className?: string;
  title: string;
}

export default function HullDiagram({
  spec,
  water,
  boxWater,
  openings = [],
  pose,
  selected,
  onToggle,
  failedHatches,
  funnelPaint,
  className = "",
  title,
}: HullDiagramProps) {
  const uid = useId().replace(/:/g, "");
  const x0 = spec.stations[0].x;
  const x1 = spec.stations[spec.stations.length - 1].x;
  const W = (x1 - x0) * S + PAD * 2;
  // A low laker gets a profile only as tall as her funnel (a liner's is
  // the 1.0 height).
  // A ship with her own torpedoes (the Carpathia, one funnel) likewise:
  // the editor then keeps Go on screen.
  const topZ =
    spec.cause === "storm" || spec.cause === "wave" || spec.torpedo
      ? Math.ceil(
          Math.max(
            ...spec.funnels.map((f) => f.topZ),
            ...spec.superstructure.map((b) => b.topZ)
          ) + 2
        )
      : TOP_Z;
  const profileH = topZ * S + PAD * 2;
  // A wave ship's spots are on her port side in the profile: no plan.
  const waveSpots = spec.cause === "wave" ? (spec.wave?.spots ?? []) : [];
  const hasPlan =
    spec.cause !== "wave" && spec.compartments.some((c) => c.span);
  // The plan's half-width: the widest section, a metre to spare.
  const halfB = Math.ceil(
    Math.max(...spec.stations.flatMap((st) => st.offsets.map((o) => o[1])))
  );
  const planTop = profileH + PLAN_GAP;
  const H = hasPlan ? planTop + halfB * 2 * S + PAD : profileH;
  const PY = (y: number) => planTop + (halfB - y) * S;
  const profile = spec.compartments
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => inProfile(c));
  const X = (x: number) => PAD + (x - x0) * S;
  const Z = (z: number) => PAD + (topZ - z) * S;

  // A storm ship: her What-if spots are on her deck and her bottom (the
  // hatch covers, the broken vents and rail split, the shoal scrapes), not
  // her compartments; her holds carry cargo.
  const storm = spec.cause === "storm";
  // A ship with her own torpedoes: the side they strike.
  const struck = spec.torpedo?.side ?? null;
  const deckOps = storm ? (spec.deckOpenings ?? []) : [];
  const hatches = deckOps.filter((d) => d.kind === "hatch");
  const topside = deckOps.filter(
    (d) => d.kind === "vent" || d.kind === "split"
  );
  const ventX =
    topside.length > 0
      ? [
          Math.min(...topside.map((d) => d.x)) - 2,
          Math.max(...topside.map((d) => d.x)) + 2,
        ]
      : null;
  const shoal = storm ? (spec.shoalOpenings ?? []) : [];
  const on = (id: string) => selected?.has(id) ?? false;
  const hatchFill = (id: string, n: number) =>
    failedHatches?.has(n) ? "#f87171" : on(id) ? "#ef4444" : "#64748b";

  const keel = spec.stations.map((st) => [st.x, st.offsets[0][0]] as const);
  const sheer = spec.stations.map((st) => [st.x, spec.sheerZ(st.x)] as const);
  const hullPath =
    `M${sheer.map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`).join("L")}` +
    `L${[...keel]
      .reverse()
      .map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`)
      .join("L")}Z`;

  // The plan: the widest breadth at each station, port above, starboard below.
  const widest = spec.stations.map(
    (st) => [st.x, Math.max(...st.offsets.map((o) => o[1]))] as const
  );
  const planPath = hasPlan
    ? `M${widest.map(([x, b]) => `${X(x).toFixed(1)},${PY(b).toFixed(1)}`).join("L")}` +
      `L${[...widest]
        .reverse()
        .map(([x, b]) => `${X(x).toFixed(1)},${PY(-b).toFixed(1)}`)
        .join("L")}Z`
    : "";

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
    // On her side (a wave ship rolls through it) the sea is edge-on to
    // this profile: no line there, never a division by nothing.
    if (Math.abs(cp) > SEA_LINE_MIN_COS) {
      const lo = zAt(x0 - 4);
      const hi = zAt(x1 + 4);
      if (Number.isFinite(lo) && Number.isFinite(hi))
        sea = [
          X(x0 - 4),
          Z(Math.max(-SEA_LINE_LIMIT_M, Math.min(SEA_LINE_LIMIT_M, lo))),
          X(x1 + 4),
          Z(Math.max(-SEA_LINE_LIMIT_M, Math.min(SEA_LINE_LIMIT_M, hi))),
        ];
    }
  }

  // Keel up (a wave ship's roll past her side): draw her upside down, her
  // keel at the top, so the picture says what the chip does.
  const flipped =
    !hasPlan &&
    pose?.part === "whole" &&
    Math.cos(pose.roll) < 0 &&
    Number.isFinite(pose.roll);

  return (
    <svg
      viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`}
      className={className}
      role={onToggle ? "group" : "img"}
      aria-label={title}
    >
      <defs>
        <clipPath id={`${uid}-hull`}>
          <path d={hullPath} />
        </clipPath>
        {hasPlan && (
          <clipPath id={`${uid}-plan`}>
            <path d={planPath} />
          </clipPath>
        )}
      </defs>
      <g
        data-testid="shipwreck-diagram-body"
        data-flipped={flipped}
        transform={
          flipped ? `translate(0 ${H.toFixed(0)}) scale(1 -1)` : undefined
        }
      >
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
        {/* Water in her named boxes (the Poseidon's tiers and ballroom). */}
        {boxWater &&
          spec.superstructure.map((b, i) => {
            const fill = Math.max(0, Math.min(1, boxWater[i] ?? 0));
            if (!b.id || !(fill > 0.001)) return null;
            const base = b.baseZ ?? spec.sheerZ((b.fromX + b.toX) / 2);
            const h = (b.topZ - base) * fill;
            return (
              <rect
                key={`bw${i}`}
                data-box-water={b.id}
                x={X(b.fromX)}
                y={Z(base + h)}
                width={(b.toX - b.fromX) * S}
                height={h * S}
                fill="#38bdf8"
                opacity={0.7}
              />
            );
          })}
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
        {spec.funnels.map((f, i) => {
          const paint = funnelPaint ?? spec.funnelPaint;
          const h = (f.topZ - (house?.topZ ?? f.baseZ)) * S;
          const shape = {
            x: X(f.x - 3.5),
            width: 7 * S,
            transform: "skewX(8)",
            style: { transformOrigin: `${X(f.x)}px ${Z(f.baseZ)}px` },
          };
          if (!paint)
            return (
              <rect
                key={`f${i}`}
                {...shape}
                y={Z(f.topZ)}
                height={h}
                fill={f.dummy ? "#c9a06a" : "#d9a35a"}
                stroke="#111827"
                strokeWidth={0.8}
              />
            );
          // Her own paint, edged light so a dark funnel reads on the panel.
          return (
            <g key={`f${i}`} data-funnel={i}>
              <rect
                {...shape}
                y={Z(f.topZ)}
                height={h}
                fill={hex(paint.funnel)}
                stroke="#94a3b8"
                strokeWidth={0.8}
              />
              <rect
                {...shape}
                y={Z(f.topZ)}
                height={h / 6}
                fill={hex(paint.top)}
              />
            </g>
          );
        })}
        {/* The hull. */}
        <path d={hullPath} fill="#111827" stroke="#cbd5e1" strokeWidth={1.2} />
        <g clipPath={`url(#${uid}-hull)`}>
          {profile.map(({ c }) => {
            const cargo = cargoLayer(spec, c);
            if (!cargo) return null;
            return (
              <rect
                key={`cargo-${c.id}`}
                data-cargo={c.id}
                x={X(c.fromX)}
                y={Z(cargo.topZ)}
                width={(c.toX - c.fromX) * S}
                height={(cargo.topZ - cargo.bottomZ) * S}
                fill="#7c4a32"
                opacity={0.9}
              />
            );
          })}
          {profile.map(({ c, i }) => {
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
        {profile.slice(1).map(({ c }) => (
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
        {/* A storm ship's hatch coamings and broken vents on her deck. */}
        {hatches.map((h, k) => (
          <rect
            key={`hc${h.id}`}
            data-hatch={h.id}
            x={X(h.x - HATCH_HX)}
            y={Z(h.z + 0.5)}
            width={HATCH_HX * 2 * S}
            height={1.6}
            fill={hatchFill(h.id, k + 1)}
          />
        ))}
        {ventX && (
          <line
            x1={X(ventX[0] + 2)}
            x2={X(ventX[1] - 2)}
            y1={Z(spec.sheerZ((ventX[0] + ventX[1]) / 2) + 0.4)}
            y2={Z(spec.sheerZ((ventX[0] + ventX[1]) / 2) + 0.4)}
            stroke={on(VENTS_SPOT) ? "#f87171" : "#94a3b8"}
            strokeWidth={1.6}
            strokeDasharray="2 2"
          />
        )}
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
        {hasPlan && (
          <g data-testid="shipwreck-plan">
            <path
              d={planPath}
              fill="#111827"
              stroke="#cbd5e1"
              strokeWidth={1.2}
            />
            <g clipPath={`url(#${uid}-plan)`}>
              {spec.compartments.map((c, i) => {
                const [lo, hi] = planSpan(c, halfB);
                const fill = Math.max(0, Math.min(1, water?.[i] ?? 0));
                const on = selected?.has(c.id) ?? false;
                const box = {
                  x: X(c.fromX),
                  y: PY(hi),
                  width: (c.toX - c.fromX) * S,
                  height: (hi - lo) * S,
                };
                return (
                  <g key={c.id}>
                    {on && <rect {...box} fill="#ef4444" opacity={0.28} />}
                    {fill > 0.001 && (
                      <rect
                        data-plan-water={c.id}
                        {...box}
                        fill="#38bdf8"
                        opacity={0.9 * fill}
                      />
                    )}
                  </g>
                );
              })}
              {/* The longitudinal bulkheads beside the side bunkers. */}
              {spec.compartments
                .filter((c) => c.span && c.span.side !== "centre")
                .map((c) => {
                  const y = c.span!.side === "port" ? c.span!.y : -c.span!.y;
                  return (
                    <line
                      key={`l${c.id}`}
                      x1={X(c.fromX)}
                      x2={X(c.toX)}
                      y1={PY(y)}
                      y2={PY(y)}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                  );
                })}
              {profile.slice(1).map(({ c }) => (
                <line
                  key={`pb${c.id}`}
                  x1={X(c.fromX)}
                  x2={X(c.fromX)}
                  y1={PY(halfB)}
                  y2={PY(-halfB)}
                  stroke="#e2e8f0"
                  strokeWidth={1.2}
                />
              ))}
            </g>
            {openings.map((o, i) => {
              const len = Math.max(4, Math.min(14, Math.sqrt(o.areaM2) * 20));
              const edge =
                o.side === "starboard" ? PY(-halfB) + 1.5 : PY(halfB) - 1.5;
              const pts: string[] = [];
              for (let k = 0; k <= 6; k += 1) {
                const x = o.x - len / 2 + (len * k) / 6;
                const y = edge + (k % 2 === 0 ? 1.6 : -1.6);
                pts.push(`${X(x).toFixed(1)},${y.toFixed(1)}`);
              }
              return (
                <polyline
                  key={`po${i}`}
                  points={pts.join(" ")}
                  fill="none"
                  stroke="#f87171"
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                />
              );
            })}
            {hatches.map((h, k) => (
              <rect
                key={`ph${h.id}`}
                x={X(h.x - HATCH_HX)}
                y={PY(HATCH_HW)}
                width={HATCH_HX * 2 * S}
                height={HATCH_HW * 2 * S}
                rx={0.8}
                fill={hatchFill(h.id, k + 1)}
                opacity={0.85}
              />
            ))}
            {topside.map((d) => (
              <circle
                key={`pv${d.id}`}
                cx={X(d.x)}
                cy={PY(d.y) - 0.6}
                r={d.kind === "vent" ? 1.6 : 0.9}
                fill={on(VENTS_SPOT) ? "#f87171" : "#94a3b8"}
              />
            ))}
            {/* The side her torpedoes come from (a ship with her own,
              the Carpathia's port side) is edged red and named so. */}
            {struck && (
              <line
                data-testid="shipwreck-struck-side"
                data-side={struck}
                x1={X(x0)}
                x2={X(x1)}
                y1={struck === "port" ? PY(halfB) - 0.5 : PY(-halfB) + 0.5}
                y2={struck === "port" ? PY(halfB) - 0.5 : PY(-halfB) + 0.5}
                stroke="#f87171"
                strokeWidth={1.4}
                strokeDasharray="4 3"
                opacity={0.8}
              />
            )}
            {/* Clear of the struck edge and the holes' zigzag on it, on a
              halo of the plan's fill so its lines pass behind the words. */}
            <text
              x={X(x0) + 2}
              y={PY(halfB) + 11.5}
              fontSize={9}
              fill={struck === "port" ? "#fca5a5" : "#94a3b8"}
              stroke="#111827"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {struck === "port" ? "Port: torpedoes hit here" : "Port"}
            </text>
            <text
              x={X(x0) + 2}
              y={PY(-halfB) - 3}
              fontSize={9}
              fill={struck === "starboard" ? "#fca5a5" : "#94a3b8"}
              stroke="#111827"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {struck === "starboard"
                ? "Starboard: torpedoes hit here"
                : "Starboard"}
            </text>
          </g>
        )}
        {/* A storm ship's tap targets: each hatch on the plan, her vents on
          her deck edge in the profile, each shoal scrape on its side. */}
        {onToggle && storm && (
          <g>
            {hatches.map((h) => (
              <SpotTarget
                key={`t${h.id}`}
                id={h.id}
                label={spotAria(spec, h.id, on(h.id))}
                on={on(h.id)}
                onToggle={onToggle}
                x={X(h.x - 3.6)}
                y={hasPlan ? PY(HATCH_HW + 0.4) : Z(h.z + 4)}
                width={7.2 * S}
                height={(HATCH_HW + 0.4) * 2 * S}
              />
            ))}
            {ventX && (
              <SpotTarget
                id={VENTS_SPOT}
                label={spotAria(spec, VENTS_SPOT, on(VENTS_SPOT))}
                on={on(VENTS_SPOT)}
                onToggle={onToggle}
                x={X(ventX[0])}
                y={Z(spec.sheerZ(ventX[0]) + 5)}
                width={(ventX[1] - ventX[0]) * S}
                height={8 * S}
              />
            )}
            {shoal.map((o, k) => {
              const id = shoalSpot(k + 1);
              // Its side's band, outboard of the hatches' targets.
              const inner = HATCH_HW + 0.4;
              const top = o.side === "starboard" ? -inner : halfB;
              return (
                <SpotTarget
                  key={`t${id}`}
                  id={id}
                  label={spotAria(spec, id, on(id))}
                  on={on(id)}
                  onToggle={onToggle}
                  x={X(o.x - SHOAL_R)}
                  y={hasPlan ? PY(top) : Z(4)}
                  width={SHOAL_R * 2 * S}
                  height={(halfB - inner) * S}
                  ring
                />
              );
            })}
          </g>
        )}
        {/* A wave ship's spots on her port side: each a marked box, red when
          the wave smashes it, and a tap target. */}
        {waveSpots.map((sp) => {
          const r = waveSpotRect(sp);
          const lit = on(sp.id);
          const box = {
            x: X(r.x0),
            y: Z(r.z1),
            width: (r.x1 - r.x0) * S,
            height: (r.z1 - r.z0) * S,
          };
          return (
            <g key={`w${sp.id}`}>
              <rect
                {...box}
                rx={2}
                fill={lit ? "#ef4444" : "none"}
                fillOpacity={0.55}
                stroke={lit ? "#fca5a5" : "#94a3b8"}
                strokeWidth={1}
                strokeDasharray={lit ? undefined : "2 2"}
              />
              {onToggle && (
                <rect
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={lit}
                  aria-label={spotAria(spec, sp.id, lit)}
                  data-testid={`shipwreck-spot-${sp.id}`}
                  {...box}
                  fill="transparent"
                  className="cursor-pointer outline-none focus-visible:fill-sky-300/20"
                  onClick={() => onToggle(sp.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle(sp.id);
                    }
                  }}
                />
              )}
            </g>
          );
        })}
        {/* Tap targets: each compartment's full height (and the plan's). */}
        {onToggle &&
          !storm &&
          spec.cause !== "wave" &&
          profile.map(({ c }) => {
            const on = selected?.has(c.id) ?? false;
            return (
              <rect
                key={`t${c.id}`}
                role="checkbox"
                tabIndex={0}
                aria-checked={on}
                aria-label={spotAria(spec, c.id, on)}
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
      </g>
    </svg>
  );
}

interface SpotTargetProps {
  id: string;
  label: string;
  on: boolean;
  onToggle: (id: string) => void;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Draw a ring round it (a shoal scrape, which has no shape of its own). */
  ring?: boolean;
}

/** A What-if spot's tap target on the diagram (a storm ship's). */
function SpotTarget({
  id,
  label,
  on,
  onToggle,
  x,
  y,
  width,
  height,
  ring = false,
}: SpotTargetProps) {
  return (
    <g>
      {ring && (
        <rect
          x={x + 1}
          y={y + 1}
          width={width - 2}
          height={height - 2}
          rx={height / 2}
          fill={on ? "#ef4444" : "none"}
          fillOpacity={0.55}
          stroke={on ? "#fca5a5" : "#94a3b8"}
          strokeWidth={1}
          strokeDasharray={on ? undefined : "2 2"}
        />
      )}
      <rect
        role="checkbox"
        tabIndex={0}
        aria-checked={on}
        aria-label={label}
        data-testid={`shipwreck-spot-${id}`}
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        className="cursor-pointer outline-none focus-visible:fill-sky-300/20"
        onClick={() => onToggle(id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(id);
          }
        }}
      />
    </g>
  );
}

/** "#2e2f32" for 0x2e2f32. */
function hex(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

/** A cell's y range in the plan (y to port), out to `halfB`. */
function planSpan(c: Compartment, halfB: number): [number, number] {
  const sp = c.span;
  if (!sp) return [-halfB, halfB];
  if (sp.side === "centre") return [-sp.y, sp.y];
  if (sp.side === "port") return [sp.y, halfB];
  return [-halfB, -sp.y];
}
