"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  BANK_ACTION_ID,
  PACES,
  isPlayroomOpen,
  isRebuilding,
  isSettling,
  paceActionId,
  paceStep,
  playroomResultLine,
  potPays,
  streakOf,
  toddlerSeconds,
  toddlerStage,
  tumbleChance,
} from "@/lib/ever-onward/universes/higher/playroom";
import { tendingValue } from "@/lib/ever-onward/universes/higher/tick";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "../grow/useRoving";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** What each pace does to the lean, in plain words. */
const LEAN_WORDS: readonly string[] = [
  "Hardly leans",
  "Leans a little",
  "Leans some",
  "Leans a lot",
];

/** Width classes for the tumble gauge, in tenths. */
const FILL: readonly string[] = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
];

/**
 * The Playroom's two dials. Build pace: from careful to rush (each card shows
 * what it pays, how fast it stacks and how much it leans, and none says which
 * is better). The streak: blocks in a row without a wobble raise a pot you can
 * bank, but every block might be the one where the top tumbles.
 */
export default function PlayroomPanel({ def, run, onAct }: PanelProps) {
  const active = paceStep(run);
  const { radioProps } = useRoving(PACES.length, active);
  if (!isPlayroomOpen(run)) return null;

  const streak = streakOf(run);
  const chance = tumbleChance(run);
  const canBank = canPerformAction(def, run, BANK_ACTION_ID);
  const pays = potPays(run, tendingValue(run));
  const stage = toddlerStage(run);
  const fill = FILL[Math.min(10, Math.round(chance * 10))];
  const risky = chance >= 0.3;

  return (
    <PanelFrame
      label="The playroom dials"
      title="Build pace and streak"
      icon="/"
      tone="orange"
      status={
        stage === "stomping"
          ? "toddler stomping!"
          : stage === "coming"
            ? "toddler coming!"
            : `streak ${streak}`
      }
      statusActive={stage !== "away"}
      testId="bh-playroom"
      data={{
        "data-pace": active,
        "data-streak": streak,
        "data-toddler": stage,
      }}
      result={playroomResultLine(run) ?? ""}
      resultTestId="bh-playroom-result"
      resultTone="amber"
    >
      <div
        role="radiogroup"
        aria-label="How fast to build"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {PACES.map((pace, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, paceActionId(i));
          return (
            <button
              key={pace.name}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={`${pace.name} pace`}
              aria-describedby={`bh-pace-${i}-note`}
              data-testid={`bh-pace-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(paceActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{pace.name}</span>
              <span
                id={`bh-pace-${i}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums"
              >
                <span className="block">
                  {pace.pay >= 1 ? "+" : "-"}
                  {pct(Math.abs(pace.pay - 1))} pay
                </span>
                <span className="block">A block every {pace.stack} sec</span>
                <span className="block">{LEAN_WORDS[i]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-xs text-slate-300">
        {isSettling(run)
          ? "Changing pace… the crew takes a moment to settle."
          : "Changing pace takes a moment to settle."}
        {isRebuilding(run) && " The crew is picking up blocks."}
      </p>
      <div
        data-testid="bh-streak"
        className="space-y-2 border-2 border-orange-700 bg-orange-950/40 p-2"
      >
        <p className="font-mono text-sm text-orange-100 tabular-nums">
          <span className={`${pixelClass} text-[10px] text-orange-300`}>
            Streak {streak}
          </span>{" "}
          blocks in a row. Banking pays{" "}
          <span className="font-bold">+{formatNumber(Math.floor(pays))}</span>{" "}
          blocks.
        </p>
        <div
          role="meter"
          aria-label="Chance the next block tumbles"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(chance * 100)}
          className="h-3 w-full bg-black/50"
        >
          <span
            className={`block h-3 ${risky ? "bg-rose-400" : "bg-emerald-400"} ${fill}`}
          />
        </div>
        <p
          data-testid="bh-streak-chance"
          className="font-mono text-xs text-slate-200 tabular-nums"
        >
          The next block tumbles the top {pct(chance)} of the time. A tumble
          loses the streak.
          {stage === "coming" &&
            ` The toddler stomps in ${toddlerSeconds(run)} sec and tumbles come ${TUNING.playroom.toddlerMult} times as often.`}
          {stage === "stomping" &&
            ` The toddler is stomping for ${toddlerSeconds(run)} more sec.`}
        </p>
        <button
          type="button"
          aria-disabled={!canBank}
          data-testid="bh-bank"
          onClick={() => {
            if (canBank) onAct(BANK_ACTION_ID);
          }}
          className={`${pixelClass} min-h-11 w-full touch-manipulation border-4 px-3 py-2 text-[10px] ${retroFocusClass} ${
            canBank
              ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
              : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
          }`}
        >
          {canBank
            ? `Bank ${streak} in a row`
            : `Stack ${TUNING.playroom.bankMin} in a row to bank`}
        </button>
      </div>
      <p className="font-mono text-xs text-slate-300">
        Tap to stack. Blocks only go up while you tap, so a tower left alone
        never tumbles.
      </p>
    </PanelFrame>
  );
}
