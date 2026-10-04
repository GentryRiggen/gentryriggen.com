"use client";

import { Search, X } from "lucide-react";
import {
  useContext,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CATEGORIES, visibleParts } from "@/lib/ship-builder/model/catalog";
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
  type SternShape,
} from "@/lib/ship-builder/model/types";
import useShowAllParts from "../hooks/useShowAllParts";
import HullEndIcon, { type HullEndKind } from "./icons/HullEndIcon";
import PartIcon from "./icons/PartIcon";
import { DrawerHeaderSlot } from "./Drawer";
import { inputClass } from "./styles";

interface CatalogPanelProps {
  /** Called after a part is picked (or unpicked). */
  onPick?: () => void;
}

const HEADING_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

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
    <div className="px-2 pb-2">
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
    <div className="flex items-center justify-between gap-3 px-3 pb-2">
      <span id={labelId} className="text-xs text-slate-600 dark:text-slate-300">
        Show all parts
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-labelledby={labelId}
        onClick={() => onChange(!isOn)}
        className="-my-2 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:focus-visible:outline-sky-400"
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
  const headerSlot = useContext(DrawerHeaderSlot);
  const tool = useShipBuilderStore((s) => s.tool);
  const selectTool = useShipBuilderStore((s) => s.selectTool);
  const bow = useShipBuilderStore((s) => s.ship.hull.bow);
  const stern = useShipBuilderStore((s) => s.ship.hull.stern);
  const kind = useShipBuilderStore((s) => s.ship.kind);
  const { showAll, setShowAll } = useShowAllParts();
  const setBow = useShipBuilderStore((s) => s.setBow);
  const setStern = useShipBuilderStore((s) => s.setStern);

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
  const hasHull = visibleBow.length > 0 || visibleStern.length > 0;
  const hasResults = hasHull || visibleCategories.length > 0;

  const search = (
    <>
      <SearchBox query={query} onQueryChange={setQuery} />
      <ShowAllSwitch isOn={showAll} onChange={setShowAll} />
    </>
  );

  return (
    <>
      {/* In a drawer the box lives in its sticky header; alone, it sits on top. */}
      {headerSlot === undefined && search}
      {headerSlot && createPortal(search, headerSlot)}
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
          <section>
            <h2 className={HEADING_CLASS}>Hull</h2>
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
          </section>
        )}
        {visibleCategories.map(({ category, parts }) => (
          <section key={category.id}>
            <h2 className={HEADING_CLASS}>{category.name}</h2>
            <ul className="mt-2 space-y-1">
              {parts.map((def) => {
                const active = tool.kind === "place" && tool.type === def.type;
                return (
                  <li key={def.type}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        selectTool(def.type);
                        onPick?.();
                      }}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950"
                          : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <PartIcon
                        type={def.type}
                        className="h-10 w-10 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {def.name}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {def.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
