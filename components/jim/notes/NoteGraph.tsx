"use client";

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Maximize2, Minus, Plus, Search } from "lucide-react";
import { OpenLink, Rows } from "@/components/jim/notes/NotesUi";
import type { GraphData } from "@/lib/jim/explore";
import {
  bounds,
  layoutGraph,
  zoomAt,
  type Point,
  type View,
} from "@/lib/jim/graphLayout";

/**
 * The note graph: every note a dot, every link between notes a line, laid
 * out by the small force sim in graphLayout. Drag to pan, pinch or the
 * buttons to zoom, tap a dot to open its note. A find field lists notes as
 * real links for anyone who can't use the picture.
 */

interface NoteGraphProps {
  graph: GraphData;
  onOpen: (path: string) => void;
  hrefFor?: (path: string) => string | null;
}

const FOLDER_FILLS = [
  "fill-ayu-accent",
  "fill-ayu-blue",
  "fill-ayu-green",
  "fill-ayu-purple",
  "fill-ayu-cyan",
  "fill-ayu-orange",
  "fill-ayu-red",
];
const FOLDER_DOTS = [
  "bg-ayu-accent",
  "bg-ayu-blue",
  "bg-ayu-green",
  "bg-ayu-purple",
  "bg-ayu-cyan",
  "bg-ayu-orange",
  "bg-ayu-red",
];
const OTHER_FILL = "fill-ayu-muted";
const OTHER_DOT = "bg-ayu-muted";

/** Labels show for this many best-linked notes until zoomed in. */
const TOP_LABELS = 25;
/** Zoomed in this far, every note is labelled (up to MAX_LABELS). */
const LABEL_ZOOM = 2.5;
const MAX_LABELS = 400;
/** A press that moves less than this (screen px) is a tap. */
const TAP_SLOP = 8;
const MAX_FOUND = 8;
/** The drawing is 4 wide by 5 tall, like its box. */
const ASPECT = 5 / 4;
const MIN_WIDTH = 360;

const START: View = { k: 1, tx: 0, ty: 0 };

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

interface Gesture {
  /** Where each pointer is, in screen px. */
  pointers: Map<number, { x: number; y: number }>;
  /** Screen px travelled since the press. */
  travel: number;
  /** The view and finger spread when a pinch began. */
  pinch: { view: View; dist: number } | null;
  /** The note pressed, when the press began on one. */
  node: string | null;
}

export default function NoteGraph({ graph, onOpen, hrefFor }: NoteGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(START);
  const [query, setQuery] = useState("");
  const gesture = useRef<Gesture>({
    pointers: new Map(),
    travel: 0,
    pinch: null,
    node: null,
  });

  const { pos, box, degree, folders, labelled } = useMemo(() => {
    const ids = graph.nodes.map((n) => n.id);
    const pos = layoutGraph(ids, graph.links);
    const raw = bounds(pos.values(), 30);
    // Widen the shorter side so the box is 4:5 and nothing is stretched.
    // A small graph isn't blown up: the drawing is never narrower than
    // MIN_WIDTH units, so dots and labels keep a sensible size.
    const width = Math.max(MIN_WIDTH, raw.width, raw.height / ASPECT);
    const height = width * ASPECT;
    const box = {
      x: raw.x - (width - raw.width) / 2,
      y: raw.y - (height - raw.height) / 2,
      width,
      height,
    };
    const degree = new Map<string, number>();
    for (const l of graph.links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }
    const counts = new Map<string, number>();
    for (const n of graph.nodes) {
      counts.set(n.folder, (counts.get(n.folder) ?? 0) + 1);
    }
    const folders = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([folder, n]) => ({ folder, n }));
    const labelled = new Set(
      [...graph.nodes]
        .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
        .slice(0, TOP_LABELS)
        .map((n) => n.id)
    );
    return { pos, box, degree, folders, labelled };
  }, [graph]);

  const folderIndex = useMemo(
    () => new Map(folders.map((f, i) => [f.folder, i])),
    [folders]
  );
  const fillOf = (folder: string) => {
    const i = folderIndex.get(folder) ?? -1;
    return i >= 0 && i < FOLDER_FILLS.length ? FOLDER_FILLS[i] : OTHER_FILL;
  };
  const dotOf = (folder: string) => {
    const i = folderIndex.get(folder) ?? -1;
    return i >= 0 && i < FOLDER_DOTS.length ? FOLDER_DOTS[i] : OTHER_DOT;
  };

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = words.length
    ? graph.nodes.filter((n) =>
        words.every((w) => `${n.title} ${n.id}`.toLowerCase().includes(w))
      )
    : [];
  const foundIds = new Set(found.map((n) => n.id));

  /** Screen px → drawing units (the box keeps the svg's aspect). */
  function toDrawing(clientX: number, clientY: number): Point {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: box.x + ((clientX - rect.left) / rect.width) * box.width,
      y: box.y + ((clientY - rect.top) / rect.height) * box.height,
    };
  }

  function unitsPerPx(): number {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect && rect.width ? box.width / rect.width : 1;
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 1) {
      g.travel = 0;
      const target = (e.target as Element).closest?.("[data-id]");
      g.node = target?.getAttribute("data-id") ?? null;
    }
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinch = { view, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      g.node = null;
    }
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    const before = g.pointers.get(e.pointerId);
    if (!before) return;
    const now = { x: e.clientX, y: e.clientY };
    g.pointers.set(e.pointerId, now);
    if (g.pointers.size >= 2 && g.pinch) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = toDrawing((a.x + b.x) / 2, (a.y + b.y) / 2);
      setView(zoomAt(g.pinch.view, dist / g.pinch.dist, mid.x, mid.y));
      g.travel += TAP_SLOP;
      return;
    }
    const dx = now.x - before.x;
    const dy = now.y - before.y;
    g.travel += Math.hypot(dx, dy);
    const u = unitsPerPx();
    setView((v) => ({ ...v, tx: v.tx + dx * u, ty: v.ty + dy * u }));
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    const wasTap =
      g.pointers.size === 1 && g.travel < TAP_SLOP && g.node !== null;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size < 2) g.pinch = null;
    if (wasTap && g.node) onOpen(g.node);
    if (g.pointers.size === 0) g.node = null;
  }

  function zoomBy(factor: number) {
    setView((v) =>
      zoomAt(v, factor, box.x + box.width / 2, box.y + box.height / 2)
    );
  }

  const showAll = view.k >= LABEL_ZOOM && graph.nodes.length <= MAX_LABELS;
  const label = `Note graph: ${plural(graph.nodes.length, "note")} and ${plural(
    graph.links.length,
    "link"
  )}${folders.length ? `, most in ${folders[0].folder}` : ""}. Drag to pan, pinch to zoom, tap a dot to open it.`;

  return (
    <div className="space-y-3">
      <div className="jim-card relative overflow-hidden">
        <svg
          ref={svgRef}
          role="img"
          aria-label={label}
          viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
          preserveAspectRatio="none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="mx-auto block aspect-[4/5] w-full max-w-xl cursor-grab touch-none select-none active:cursor-grabbing"
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            <g className="stroke-white/15">
              {graph.links.map((l) => {
                const a = pos.get(l.source);
                const b = pos.get(l.target);
                if (!a || !b) return null;
                return (
                  <line
                    key={`${l.source}|${l.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    strokeWidth={1 / view.k}
                  />
                );
              })}
            </g>
            {graph.nodes.map((n) => {
              const p = pos.get(n.id);
              if (!p) return null;
              const r = 3 + Math.sqrt(degree.get(n.id) ?? 0) * 1.4;
              const hit = foundIds.has(n.id);
              return (
                <g key={n.id} data-id={n.id} className="cursor-pointer">
                  <title>{n.title}</title>
                  {/* A wider, invisible target for a fingertip. */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={Math.max(r, 12 / view.k)}
                    className="fill-transparent"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    className={`${fillOf(n.folder)} ${
                      words.length && !hit ? "opacity-25" : ""
                    }`}
                  />
                  {hit && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r + 3}
                      strokeWidth={1.5 / view.k}
                      className="fill-none stroke-ayu-text"
                    />
                  )}
                  {(showAll || labelled.has(n.id) || hit) && (
                    <text
                      x={p.x + r + 2}
                      y={p.y + 3 / view.k}
                      fontSize={10 / view.k}
                      className="pointer-events-none fill-ayu-text"
                    >
                      {n.title}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="absolute right-2 bottom-2 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(1.4)}
            className="jim-glass flex size-11 items-center justify-center rounded-xl text-ayu-text hover:text-ayu-accent"
          >
            <Plus aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(1 / 1.4)}
            className="jim-glass flex size-11 items-center justify-center rounded-xl text-ayu-text hover:text-ayu-accent"
          >
            <Minus aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Fit the whole graph"
            onClick={() => setView(START)}
            className="jim-glass flex size-11 items-center justify-center rounded-xl text-ayu-text hover:text-ayu-accent"
          >
            <Maximize2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {folders.length > 0 && (
        <ul
          aria-label="Folders"
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ayu-subtle"
        >
          {folders.map((f) => (
            <li key={f.folder} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2.5 rounded-full ${dotOf(f.folder)}`}
              />
              {f.folder || "other"} <span className="tabular-nums">{f.n}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <label htmlFor="jim-graph-find" className="sr-only">
          Find a note in the graph
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ayu-subtle"
        />
        <input
          id="jim-graph-find"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a note"
          maxLength={100}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-11 w-full rounded-2xl border border-white/[0.08] bg-ayu-panel/70 py-2 pr-4 pl-10 text-base text-ayu-text shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] backdrop-blur placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none"
        />
      </div>
      {words.length > 0 &&
        (found.length ? (
          <Rows>
            {found.slice(0, MAX_FOUND).map((n) => (
              <li key={n.id}>
                <OpenLink
                  href={hrefFor?.(n.id)}
                  onOpen={() => onOpen(n.id)}
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.04]"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${dotOf(n.folder)}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-ayu-text">
                    {n.title}
                  </span>
                  <span className="shrink-0 text-sm text-ayu-subtle tabular-nums">
                    {plural(degree.get(n.id) ?? 0, "link")}
                  </span>
                </OpenLink>
              </li>
            ))}
          </Rows>
        ) : (
          <p className="text-sm text-ayu-subtle">No note matches.</p>
        ))}
      {found.length > MAX_FOUND && (
        <p className="text-sm text-ayu-subtle">
          {found.length - MAX_FOUND} more. Keep typing to narrow it.
        </p>
      )}
    </div>
  );
}
