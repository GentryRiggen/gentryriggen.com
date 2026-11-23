"use client";

import { useId, useMemo, useState } from "react";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import {
  WHAT_IF_STORMS,
  type ShipWhatIf,
  type WhatIfStorm,
} from "@/lib/shipwreck/save";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import {
  type Opening,
  type ShipSpec,
  isDeckOpening,
} from "@/lib/shipwreck/ships/types";
import {
  FINISHER_SPOT,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "@/lib/shipwreck/sim/run";
import {
  FINISHER_LABEL,
  MINE_TOGGLES,
  STORM_LABEL,
  finisherClock,
  type MineToggle,
  spotAria,
  spotLabel,
  stormChoiceText,
  stormSpotGroups,
} from "@/lib/shipwreck/whatIf";
import HullDiagram from "./HullDiagram";
import Icon from "./Icon";
import { FOCUS, PANEL, PRIMARY, ROUND, SECONDARY } from "./styles";

/**
 * The What if? ids that give a ship's real damage (`whatIfRealIds`): for
 * an iceberg ship the compartments it opened, for a torpedo ship the one
 * spot where the real hit lands, for a storm ship every hatch, her vents
 * and her graze on the shoal.
 */
export function realWhatIfIds(spec: ShipSpec): string[] {
  return whatIfRealIds(spec);
}

/** The compartments the iceberg opened on the real night. */
export const REAL_NIGHT_IDS: readonly string[] = realWhatIfIds(titanic);

export interface WhatIfChoice {
  ids: string[];
  /** Torpedo and mine ships only. */
  portholesOpen?: boolean;
  /** Storm ships only. */
  storm?: WhatIfStorm;
  /** Mine ships only: every watertight door shut. */
  doorsClosed?: boolean;
  /** Mine ships only: engines stopped at once, no run for the shore. */
  enginesStopped?: boolean;
}

interface WhatIfEditorProps {
  spec: ShipSpec;
  /** The ship's last What if?, remembered in the save. */
  initial: ShipWhatIf;
  onBack: () => void;
  onGo: (choice: WhatIfChoice) => void;
}

/** The words that differ by what sank her. */
function wordsOf(spec: ShipSpec) {
  switch (spec.cause) {
    case "storm":
      return {
        lead: "Tap what lets the lake in, and choose the storm. Will she make it?",
        group: "What lets the lake in",
        diagram: `${spec.name}'s side, bow to the right, and her deck from above. Tap a hatch cover, her broken vents or a shoal scrape to switch it on or off.`,
        note: "Stern ← · → Bow. Red: hatch covers that leak (the rest are sealed tight), her two broken vents and the split by her railing (one spot), and scrapes on Six Fathom Shoal. Experts still argue which of them sank her: switch each one off and see.",
        real: "Like the real storm",
        realAria:
          "Like the real storm: every hatch cover leaking, the broken vents and the shoal scrapes",
        clear: "Clear: no damage, every hatch sealed tight",
        icon: "storm" as const,
        go: "Go: start the storm with these choices",
      };
    case "mine":
      return {
        lead: "Tap where mines hit, and what was open. Will she float?",
        group: "Where mines hit",
        diagram: `${spec.name}'s side, bow to the right, and her plan from above. Tap where mines hit.`,
        note: "Stern ← · → Bow. Mines hit her starboard side (the bottom). White lines: watertight walls and her double skin.",
        real: "Like the real morning",
        realAria:
          "Like the real morning: the mine by holds 2 and 3, portholes open, a door stuck open, running for Kea",
        clear: "Clear: no mines",
        icon: "mine" as const,
        go: "Go: start the morning with these choices",
      };
    case "torpedo":
      if (spec.torpedo) {
        // A ship with her own torpedoes (the Carpathia): her side, her
        // morning, and the U-boat's return as its own toggle.
        const side = spec.torpedo.side;
        const plan = side === "port" ? "the top" : "the bottom";
        return {
          lead: `Tap where torpedoes hit her ${side} side. Will she float?`,
          group: "Where torpedoes hit",
          diagram: `${spec.name}'s side, bow to the right, and her plan from above. Tap where torpedoes hit her ${side} side.`,
          note: `Stern ← · → Bow. Torpedoes come from ${side} (${plan} of the plan). White lines: watertight walls and her side coal bunkers.`,
          real: "Like the real morning",
          realAria:
            "Like the real morning: torpedoes by the boiler room and into the engine room, and the U-boat comes back",
          clear: "Clear: no torpedoes, and the U-boat stays away",
          icon: "torpedo" as const,
          go: "Go: start the morning with these torpedoes",
        };
      }
      return {
        lead: "Tap where torpedoes hit. Will she float?",
        group: "Where torpedoes hit",
        diagram: `${spec.name}'s side, bow to the right, and her plan from above. Tap where torpedoes hit.`,
        note: "Stern ← · → Bow. Torpedoes come from starboard (the bottom of the plan). White lines: watertight walls and her side coal bunkers.",
        real: "Like the real afternoon",
        realAria:
          "Like the real afternoon: the torpedo beside the front boiler room, portholes open",
        clear: "Clear: no torpedoes",
        icon: "torpedo" as const,
        go: "Go: start the afternoon with these torpedoes",
      };
    default:
      return {
        lead: "Tap the hull to make holes. Will she float?",
        group: "Compartments",
        diagram: `${spec.name}'s side, bow to the right. Tap a compartment to open or close it.`,
        note: "Stern ← · → Bow. The white lines are the watertight walls.",
        real: "Like the real night",
        realAria: "Like the real night: six compartments open",
        clear: "Clear: no holes",
        icon: "iceberg" as const,
        go: "Go: start the night with these holes",
      };
  }
}

/**
 * Tap any number of spots, then Go. The same picker for every ship: an
 * iceberg ship's compartments, a torpedo ship's hits along her starboard
 * side (with her portholes open or shut), a storm ship's hatch covers,
 * broken vents and shoal scrapes (with the storm as it was, calmer or
 * worse).
 */
export default function WhatIfEditor({
  spec,
  initial,
  onBack,
  onGo,
}: WhatIfEditorProps) {
  const torpedo = spec.cause === "torpedo";
  const mine = spec.cause === "mine";
  // Hits along her starboard side, with a plan from above.
  const side = torpedo || mine;
  const storm = spec.cause === "storm";
  // Portholes to open or shut: only a torpedo ship that has them (the
  // Lusitania; a mine ship's are among her toggles).
  const hasPortholes = torpedo && (spec.portholes?.length ?? 0) > 0;
  const helpId = useId();
  const words = wordsOf(spec);
  const spots = useMemo(() => whatIfSpots(spec), [spec]);
  const real = useMemo(() => realWhatIfIds(spec), [spec]);
  const [ids, setIds] = useState<string[]>(() => {
    const known = initial.ids.filter((id) => spots.includes(id));
    // A storm ship's saved What if may be no damage at all.
    const saved = known.length > 0 || (storm && initial.storm !== undefined);
    return saved ? known : real;
  });
  const [portholesOpen, setPortholesOpen] = useState(
    initial.portholesOpen ?? true
  );
  const [sea, setSea] = useState<WhatIfStorm>(initial.storm ?? "real");
  // A mine ship's toggles, on for the real morning (R14).
  const [doorsStuck, setDoorsStuck] = useState(initial.doorsClosed !== true);
  const [runForKea, setRunForKea] = useState(initial.enginesStopped !== true);
  const toggleOn: Record<MineToggle["id"], boolean> = {
    portholes: portholesOpen,
    doors: doorsStuck,
    engines: runForKea,
  };
  const flip: Record<MineToggle["id"], () => void> = {
    portholes: () => setPortholesOpen((v) => !v),
    doors: () => setDoorsStuck((v) => !v),
    engines: () => setRunForKea((v) => !v),
  };
  const selected = useMemo(() => new Set(ids), [ids]);
  // The U-boat's return (`FINISHER_SPOT`): its own big toggle, not a chip.
  const hasFinisher = spots.includes(FINISHER_SPOT);
  const finisherOn = selected.has(FINISHER_SPOT);
  const hitIds = ids.filter((id) => id !== FINISHER_SPOT);
  const openings = useMemo(() => whatIfOpenings(spec, ids), [spec, ids]);
  const toggle = (id: string) => {
    if (!spots.includes(id)) return;
    setIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  };
  // Bow first: the order a player reads the ship from the hit side.
  const chips = storm
    ? spots
    : [...spots].reverse().filter((id) => id !== FINISHER_SPOT);
  const groups = storm ? stormSpotGroups(spec) : null;
  const isReal =
    ids.length === real.length &&
    ids.every((id) => real.includes(id)) &&
    (!(hasPortholes || mine) || portholesOpen) &&
    (!mine || (doorsStuck && runForKea)) &&
    (!storm || sea === "real");
  // No damage at all is a storm ship's question too (every cover tight).
  const canGo = storm || ids.length > 0;

  const chip = (id: string, short?: string) => {
    const on = selected.has(id);
    return (
      <button
        key={id}
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={spotAria(spec, id, on)}
        data-testid={`shipwreck-chip-${id}`}
        onClick={() => toggle(id)}
        className={`min-h-11 touch-manipulation rounded-full border px-3 text-sm font-semibold ${
          short ? "min-w-11 px-2" : ""
        } ${
          on
            ? "border-red-300 bg-red-500/80 text-white"
            : "border-white/15 bg-slate-900/80 text-slate-200"
        } ${FOCUS}`}
      >
        {short ?? spotLabel(spec, id)}
      </button>
    );
  };

  let count: string;
  if (storm) count = stormChoiceText(spec, ids);
  else if (torpedo) {
    count =
      hitIds.length === 0
        ? finisherOn
          ? `Only the ${finisherClock(spec)} torpedo`
          : "Choose where they hit"
        : hitIds.length === 1
          ? `Hits: ${spotLabel(spec, hitIds[0])}`
          : `${hitIds.length} torpedoes`;
    if (finisherOn && hitIds.length > 0)
      count += ` · then ${finisherClock(spec)}`;
  } else if (mine)
    count =
      ids.length === 0
        ? "Choose where they hit"
        : ids.length === 1
          ? `Mine: ${spotLabel(spec, ids[0])}`
          : `${ids.length} mines`;
  else
    count =
      ids.length === 0
        ? "No holes yet"
        : `${ids.length} ${ids.length === 1 ? "hole" : "holes"}`;

  return (
    <div
      data-testid="shipwreck-editor"
      data-ship={spec.id}
      className={`absolute inset-0 flex flex-col overflow-y-auto bg-slate-950/55 ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back to the title"
          onClick={onBack}
          className={ROUND}
        >
          <Icon name="back" className="size-8" />
        </button>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            What if?
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">{words.lead}</p>
        </div>
      </div>

      <div
        className={`mx-auto flex w-full flex-1 flex-col justify-center gap-3 py-3 sm:gap-4 sm:py-4 ${
          side ? "max-w-3xl" : "max-w-4xl"
        }`}
      >
        <div className={`${PANEL} p-2 sm:p-4`}>
          <HullDiagram
            spec={spec}
            openings={openings.filter((o): o is Opening => !isDeckOpening(o))}
            selected={selected}
            onToggle={toggle}
            title={words.diagram}
            // A mine ship's three toggles need the room: a shorter plan.
            className={
              mine
                ? "block h-auto max-h-[28vh] w-full"
                : // On a short landscape screen (an iPad mini's 744 px) the
                  // plan gives way so Go keeps its full size on screen.
                  "block h-auto w-full [@media(max-height:800px)]:max-h-[32vh]"
            }
          />
          <p className="px-1 pt-1 text-xs text-slate-400 sm:text-sm">
            {words.note}
          </p>
        </div>

        <div
          className={
            storm
              ? "flex flex-col items-center gap-2"
              : "flex flex-wrap justify-center gap-1.5"
          }
          role="group"
          aria-label={words.group}
        >
          {groups ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span className="mr-1 text-sm font-semibold text-slate-300">
                  Hatch covers that leak
                </span>
                {groups.hatches.map((id) => chip(id, id.slice(6)))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {groups.vents.map((id) => chip(id))}
                {groups.shoal.map((id) => chip(id))}
              </div>
            </>
          ) : (
            <>
              {chips.map((id) => chip(id))}
              {/* The U-boat's return: its own big toggle, not a hull spot. */}
              {hasFinisher && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={finisherOn}
                  data-testid="shipwreck-finisher"
                  aria-label={spotAria(spec, FINISHER_SPOT, finisherOn)}
                  onClick={() => toggle(FINISHER_SPOT)}
                  className={`${finisherOn ? PRIMARY : SECONDARY} min-h-16 px-5 text-base sm:text-lg`}
                >
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <Icon name="torpedo" className="size-7" />
                    <Icon name="clock" className="size-7" />
                  </span>
                  <span className="flex flex-col items-start leading-tight">
                    <span>{FINISHER_LABEL}</span>
                    <span className="text-sm font-normal opacity-80">
                      {finisherOn
                        ? `A last torpedo at ${finisherClock(spec)}`
                        : "It stays away"}
                    </span>
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {mine && (
          <div
            role="group"
            aria-label="What was open, and her run for Kea"
            className="flex flex-wrap items-start justify-center gap-3"
          >
            {MINE_TOGGLES.map((t) => {
              const on = toggleOn[t.id];
              return (
                <div
                  key={t.id}
                  className="flex w-56 flex-col items-center gap-1"
                >
                  <button
                    type="button"
                    data-testid={`whatif-${t.id}`}
                    aria-pressed={on}
                    aria-label={t.aria(on)}
                    aria-describedby={`${helpId}-${t.id}`}
                    onClick={flip[t.id]}
                    className={`${on ? PRIMARY : SECONDARY} min-h-14 w-full whitespace-nowrap px-4 text-base sm:text-lg`}
                  >
                    <Icon name={t.icon} className="size-7 shrink-0" />
                    {t.label(on)}
                  </button>
                  <p
                    id={`${helpId}-${t.id}`}
                    className="text-center text-xs leading-snug text-slate-300"
                  >
                    {t.help}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* The choices and Go share one row where the plan is taller. */}
        <div
          className={
            side
              ? "flex flex-wrap items-center justify-center gap-3"
              : "contents"
          }
        >
          <div
            className={
              side
                ? "contents"
                : "flex flex-wrap items-center justify-center gap-3"
            }
          >
            {storm && (
              <div
                role="radiogroup"
                aria-label="The storm"
                data-testid="shipwreck-storm"
                className="flex items-center gap-1.5"
              >
                <Icon name="storm" className="size-6 text-slate-300" />
                {WHAT_IF_STORMS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={sea === v}
                    data-testid={`shipwreck-storm-${v}`}
                    onClick={() => setSea(v)}
                    className={`min-h-14 touch-manipulation rounded-full border px-4 text-base font-semibold ${
                      sea === v
                        ? "border-sky-300 bg-sky-500 text-white"
                        : "border-white/15 bg-slate-900/80 text-slate-200"
                    } ${FOCUS}`}
                  >
                    {STORM_LABEL[v]}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              data-testid="shipwreck-preset-real"
              aria-label={words.realAria}
              aria-pressed={isReal}
              onClick={() => {
                setIds([...real]);
                setPortholesOpen(true);
                setSea("real");
                setDoorsStuck(true);
                setRunForKea(true);
              }}
              className={`${SECONDARY} min-h-14 px-5 text-base sm:text-lg`}
            >
              <Icon name={words.icon} className="size-6" />
              {words.real}
            </button>
            {hasPortholes && (
              <button
                type="button"
                data-testid="shipwreck-portholes"
                aria-pressed={portholesOpen}
                aria-label={
                  portholesOpen
                    ? "Portholes open: tap to shut them"
                    : "Portholes shut: tap to open them"
                }
                onClick={() => setPortholesOpen(!portholesOpen)}
                className={`${portholesOpen ? PRIMARY : SECONDARY} min-h-14 px-5 text-base sm:text-lg`}
              >
                <Icon name="porthole" className="size-6" />
                {portholesOpen ? "Portholes open" : "Portholes shut"}
              </button>
            )}
            <button
              type="button"
              data-testid="shipwreck-preset-clear"
              aria-label={words.clear}
              onClick={() => setIds([])}
              className={`${SECONDARY} min-h-14 px-5 text-base sm:text-lg`}
            >
              <Icon name="close" className="size-6" />
              Clear
            </button>
          </div>

          <div className="flex items-center justify-center gap-4">
            <p
              data-testid="shipwreck-hole-count"
              className="text-xl font-semibold text-white"
            >
              {count}
            </p>
            <button
              type="button"
              data-testid="shipwreck-go"
              aria-label={words.go}
              disabled={!canGo}
              onClick={() =>
                onGo(
                  mine
                    ? {
                        ids,
                        portholesOpen,
                        doorsClosed: !doorsStuck,
                        enginesStopped: !runForKea,
                      }
                    : hasPortholes
                      ? { ids, portholesOpen }
                      : storm
                        ? { ids, storm: sea }
                        : { ids }
                )
              }
              className={`${PRIMARY} min-w-36 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Go
              <Icon name="go" className="size-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
