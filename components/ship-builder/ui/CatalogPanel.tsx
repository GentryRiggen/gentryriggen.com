"use client";

import { ChevronDown, Hammer, Paintbrush, Search, X } from "lucide-react";
import {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import {
  ATTACH_NEEDS_LABELS,
  CATEGORIES,
  visibleParts,
} from "@/lib/ship-builder/model/catalog";
import type { PaintColor } from "@/lib/ship-builder/model/paint";
import { fuzzyFilter, type SearchField } from "@/lib/ship-builder/search/fuzzy";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  BOW_SHAPES,
  STERN_SHAPES,
  type HullEndDef,
} from "@/lib/ship-builder/model/hullEnds";
import {
  BOW_IDS,
  STERN_IDS,
  type BowShape,
  type PartDef,
  type SternShape,
} from "@/lib/ship-builder/model/types";
import useHullSectionOpen from "../hooks/useHullSectionOpen";
import useShowAllParts from "../hooks/useShowAllParts";
import HullEndIcon, { type HullEndKind } from "./icons/HullEndIcon";
import PartIcon from "./icons/PartIcon";
import { DrawerHeaderSlot } from "./Drawer";
import BelowDeck from "./BelowDeck";
import HullSizeControls from "./HullSizeControls";
import PaintPanel from "./PaintPanel";
import { inputClass } from "./styles";

interface CatalogPanelProps {
  /** Called after a part is picked (or unpicked). */
  onPick?: () => void;
}

const HEADING_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const DEFAULT_PAINT_COLOR: PaintColor = "red";

interface HullEndTilesProps {
  label: string;
  tiles: { kind: HullEndKind; def: HullEndDef<string> }[];
  selected: string;
  onSelect: (shape: string) => void;
}

/** One row of picture tiles; picking one never changes the active tool. */
function HullEndTiles({ label, tiles, selected, onSelect }: HullEndTilesProps) {
  return (
    <div role="group" aria-label={label} className="mt-2">
      <h3 className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </h3>
      <ul className="mt-1 grid grid-cols-4 gap-1.5">
        {tiles.map(({ kind, def }) => {
          const isSelected = def.id === selected;
          return (
            <li key={def.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                title={def.description}
                onClick={() => onSelect(def.id)}
                className={`flex min-h-16 w-full touch-manipulation flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 transition-colors ${
                  isSelected
                    ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950"
                    : "border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                }`}
              >
                <HullEndIcon kind={kind} className="h-9 w-9 shrink-0" />
                <span className="text-[11px] font-medium leading-tight">
                  {def.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type HullTile = HullEndTilesProps["tiles"][number];

const bowTiles: HullTile[] = BOW_IDS.map((shape) => ({
  kind: { end: "bow", shape },
  def: BOW_SHAPES[shape],
}));
const sternTiles: HullTile[] = STERN_IDS.map((shape) => ({
  kind: { end: "stern", shape },
  def: STERN_SHAPES[shape],
}));

function hullTileFields(label: string, { def }: HullTile): SearchField[] {
  return [
    { text: def.name, weight: 1, allowSubsequence: true },
    { text: `Hull ${label}`, weight: 0.7, allowSubsequence: true },
    { text: def.description, weight: 0.4 },
  ];
}

interface ModeSwitchProps {
  isPaint: boolean;
  onChange: (isPaint: boolean) => void;
}

/** Build | Paint, a segmented control. The mode itself lives in the store. */
function ModeSwitch({ isPaint, onChange }: ModeSwitchProps) {
  const options = [
    { paint: false, label: "Build", Icon: Hammer },
    { paint: true, label: "Paint", Icon: Paintbrush },
  ];
  return (
    <div
      role="group"
      aria-label="Mode"
      className="mx-2 mb-2 flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      {options.map(({ paint, label, Icon }) => {
        const isOn = paint === isPaint;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isOn}
            onClick={() => onChange(paint)}
            className={`flex h-11 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
              isOn
                ? "bg-white text-sky-800 shadow dark:bg-slate-600 dark:text-sky-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface CategoryChipsProps {
  chips: { id: string; name: string }[];
  onChip: (id: string) => void;
}

function CategoryChips({ chips, onChip }: CategoryChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div
      role="group"
      aria-label="Categories"
      className="flex gap-1.5 overflow-x-auto px-2"
    >
      {chips.map(({ id, name }) => (
        // The button pads the touch area to 44px while the pill stays slim.
        <button
          key={id}
          type="button"
          aria-label={`Jump to ${name}`}
          onClick={() => onChip(id)}
          className="flex h-11 shrink-0 touch-manipulation items-center"
        >
          <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            {name}
          </span>
        </button>
      ))}
    </div>
  );
}

interface PartTileProps {
  def: PartDef;
  isActive: boolean;
  isBlocked: boolean;
  onSelect: (def: PartDef) => void;
}

/** A picture tile. Blocked tiles are dimmed but stay clickable. */
function PartTile({ def, isActive, isBlocked, onSelect }: PartTileProps) {
  const blockedBy = isBlocked && def.placement === "attach" ? def : null;
  return (
    <button
      type="button"
      aria-pressed={isActive}
      title={
        blockedBy
          ? `${def.description}. ${blockedBy.emptyHint}`
          : def.description
      }
      onClick={() => onSelect(def)}
      className={`flex min-h-24 w-full touch-manipulation flex-col items-center justify-start gap-0.5 rounded-md border px-1 py-1.5 text-center transition-colors ${
        isActive
          ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950"
          : "border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      }`}
    >
      <PartIcon
        type={def.type}
        className={`h-12 w-12 shrink-0 ${blockedBy ? "opacity-40" : ""}`}
      />
      <span
        className={`text-[11px] font-medium leading-tight ${
          blockedBy ? "text-slate-500 dark:text-slate-400" : ""
        }`}
      >
        {def.name}
      </span>
      {blockedBy && (
        <span className="text-[10px] leading-tight text-amber-700 dark:text-amber-300">
          {ATTACH_NEEDS_LABELS[blockedBy.attachTo]}
        </span>
      )}
    </button>
  );
}

interface SearchBoxProps {
  query: string;
  onQueryChange: (query: string) => void;
}

function SearchBox({ query, onQueryChange }: SearchBoxProps) {
  const inputId = useId();

  // Escape clears first; once empty, the next Escape leaves the box.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (query) onQueryChange("");
    else event.currentTarget.blur();
  }

  return (
    <div className="px-2 pb-1">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search parts
        </label>
        <Search
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search parts"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`${inputClass} h-11 w-full py-0 pl-8 pr-10 text-base [&::-webkit-search-cancel-button]:appearance-none`}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-0 flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <X aria-hidden="true" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

interface ShowAllSwitchProps {
  isOn: boolean;
  onChange: (next: boolean) => void;
}

function ShowAllSwitch({ isOn, onChange }: ShowAllSwitchProps) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-800">
      <span id={labelId} className="text-xs text-slate-600 dark:text-slate-300">
        Show all parts
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-labelledby={labelId}
        onClick={() => onChange(!isOn)}
        className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:focus-visible:outline-sky-400"
      >
        <span
          aria-hidden="true"
          className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
            isOn
              ? "bg-sky-600 dark:bg-sky-500"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
              isOn ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </button>
    </div>
  );
}

export default function CatalogPanel({ onPick }: CatalogPanelProps) {
  const [query, setQuery] = useState("");
  const [isHullOpen, setHullOpen] = useHullSectionOpen();
  const idPrefix = useId();
  const lastColour = useRef<PaintColor>(DEFAULT_PAINT_COLOR);
  const headerSlot = useContext(DrawerHeaderSlot);
  const tool = useShipBuilderStore((s) => s.tool);
  const selectTool = useShipBuilderStore((s) => s.selectTool);
  const selectPaint = useShipBuilderStore((s) => s.selectPaint);
  const cancel = useShipBuilderStore((s) => s.cancel);
  const ship = useShipBuilderStore((s) => s.ship);
  const { showAll, setShowAll } = useShowAllParts();
  const setBow = useShipBuilderStore((s) => s.setBow);
  const setStern = useShipBuilderStore((s) => s.setStern);

  const { kind } = ship;
  const { bow, stern } = ship.hull;
  const isPaint = tool.kind === "paint";
  const paintColour = tool.kind === "paint" ? tool.color : null;
  useEffect(() => {
    if (paintColour) lastColour.current = paintColour;
  }, [paintColour]);

  const visibleBow = useMemo(
    () => fuzzyFilter(query, bowTiles, (t) => hullTileFields("Bow", t)),
    [query]
  );
  const visibleStern = useMemo(
    () => fuzzyFilter(query, sternTiles, (t) => hullTileFields("Stern", t)),
    [query]
  );
  const visibleCategories = useMemo(() => {
    const listed = visibleParts(kind, showAll);
    return CATEGORIES.map((category) => ({
      category,
      parts: fuzzyFilter(
        query,
        listed.filter((def) => def.category === category.id),
        (def) => [
          { text: def.name, weight: 1, allowSubsequence: true },
          { text: category.name, weight: 0.7, allowSubsequence: true },
          { text: def.description, weight: 0.4 },
        ]
      ),
    })).filter(({ parts }) => parts.length > 0);
  }, [query, kind, showAll]);
  // Attach parts with nowhere to go; recomputed only when the ship changes.
  const blockedTypes = useMemo(() => {
    const blocked = new Set<string>();
    const analysis = analyzeShip(ship);
    for (const def of visibleParts(kind, showAll)) {
      if (
        def.placement === "attach" &&
        analysis.openAttachPoints(def).length === 0
      ) {
        blocked.add(def.type);
      }
    }
    return blocked;
  }, [ship, kind, showAll]);
  const hasHull = visibleBow.length > 0 || visibleStern.length > 0;
  const hasResults = hasHull || visibleCategories.length > 0;
  // A search always reveals matching hull shapes, even if the section is shut.
  const isSearching = query.trim() !== "";
  const showHullTiles = isHullOpen || isSearching;

  const sectionId = (id: string) => `${idPrefix}-section-${id}`;
  const chips = [
    ...(hasHull ? [{ id: "hull", name: "Hull" }] : []),
    ...visibleCategories.map(({ category }) => ({
      id: category.id,
      name: category.name,
    })),
  ];

  function handleChip(id: string) {
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    document.getElementById(sectionId(id))?.scrollIntoView?.({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  function handleMode(wantsPaint: boolean) {
    if (wantsPaint) selectPaint(lastColour.current);
    else cancel();
  }

  function handleSelectPart(def: PartDef) {
    selectTool(def.type);
    onPick?.();
  }

  const header = (
    <>
      <ModeSwitch isPaint={isPaint} onChange={handleMode} />
      {!isPaint && (
        <>
          <SearchBox query={query} onQueryChange={setQuery} />
          <CategoryChips chips={chips} onChip={handleChip} />
        </>
      )}
    </>
  );

  return (
    <>
      {/* In a drawer the controls live in its sticky header; alone, on top. */}
      {headerSlot === undefined && header}
      {headerSlot && createPortal(header, headerSlot)}
      {isPaint ? (
        <PaintPanel onPick={onPick} />
      ) : (
        <div className="space-y-5 p-4">
          {!hasResults && (
            <p
              role="status"
              className="text-sm text-slate-500 dark:text-slate-400"
            >
              No parts match
            </p>
          )}
          {hasHull && (
            <section id={sectionId("hull")}>
              <h2 className={HEADING_CLASS}>
                <button
                  type="button"
                  aria-expanded={showHullTiles}
                  aria-controls={`${idPrefix}-hull`}
                  onClick={() => setHullOpen(!isHullOpen)}
                  className="-my-2 flex min-h-11 w-full touch-manipulation items-center justify-between uppercase"
                >
                  Hull
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 transition-transform ${
                      showHullTiles ? "" : "-rotate-90"
                    }`}
                  />
                </button>
              </h2>
              <div id={`${idPrefix}-hull`} hidden={!showHullTiles}>
                {visibleBow.length > 0 && (
                  <HullEndTiles
                    label="Bow"
                    selected={bow}
                    onSelect={(shape) => setBow(shape as BowShape)}
                    tiles={visibleBow}
                  />
                )}
                {visibleStern.length > 0 && (
                  <HullEndTiles
                    label="Stern"
                    selected={stern}
                    onSelect={(shape) => setStern(shape as SternShape)}
                    tiles={visibleStern}
                  />
                )}
                <HullSizeControls />
                <BelowDeck />
              </div>
            </section>
          )}
          {visibleCategories.map(({ category, parts }) => {
            const activeDef = parts.find(
              (def) => tool.kind === "place" && tool.type === def.type
            );
            return (
              <section key={category.id} id={sectionId(category.id)}>
                <h2 className={HEADING_CLASS}>{category.name}</h2>
                <ul className="mt-2 grid grid-cols-3 gap-1.5">
                  {parts.map((def) => (
                    <li key={def.type}>
                      <PartTile
                        def={def}
                        isActive={def === activeDef}
                        isBlocked={blockedTypes.has(def.type)}
                        onSelect={handleSelectPart}
                      />
                    </li>
                  ))}
                </ul>
                {activeDef && (
                  <p
                    data-testid="part-detail"
                    className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-slate-700 dark:bg-sky-950 dark:text-slate-200"
                  >
                    <span className="font-medium">{activeDef.name}</span>
                    {" · "}
                    {activeDef.description}
                  </p>
                )}
              </section>
            );
          })}
          <ShowAllSwitch isOn={showAll} onChange={setShowAll} />
        </div>
      )}
    </>
  );
}
