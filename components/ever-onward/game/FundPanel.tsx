"use client";

import { memo, useState } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  DEPOSIT_SHARES,
  WITHDRAW_ACTION,
  depositActionId,
  extraPerMinute,
  fundBalance,
  fundFee,
  fundKind,
  fundPayout,
  fundYieldPerSecond,
  isFundOpen,
} from "@/lib/ever-onward/universes/light/fund";
import { fundIncome } from "@/lib/ever-onward/universes/light/tick";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import type { PanelProps } from "../universes/types";
import PanelFrame, { type PanelTone } from "./retro/PanelFrame";
import {
  pixelClass,
  retroPrimaryButtonClass,
  retroSecondaryButtonClass,
} from "./retro/retroStyles";

/** One tone for each part of the story, matching its other side panels. */
const TONES: readonly PanelTone[] = ["amber", "sky", "violet", "emerald"];

const whole = (n: number): string => formatNumber(Math.floor(n));

const shareLabel = (share: number): string =>
  share >= 1 ? "Put it all in" : `Put in ${Math.round(share * 100)}%`;

/**
 * The fund: spend now, or invest. Coins put in grow, a little faster the
 * less there is in the jar, and come out any time for a fee that falls the
 * longer they stay. A coin in the jar is a coin not buying an upgrade now.
 */
function FundPanel({ def, run, onAct }: PanelProps) {
  const [note, setNote] = useState("");
  if (!isFundOpen(run) || run.complete) return null;

  const kind = fundKind(run);
  const money = run.resources[kind.currency] ?? 0;
  const balance = fundBalance(run);
  const income = fundIncome(run);
  const perMinute = 60 * fundYieldPerSecond(balance, income);
  const canTakeOut = canPerformAction(def, run, WITHDRAW_ACTION);
  const fee = Math.round(fundFee(run) * 100);

  const act = (id: string, text: string) => {
    setNote(text);
    onAct(id);
  };

  return (
    <PanelFrame
      label={kind.name}
      title={kind.name}
      icon="◎"
      tone={TONES[Math.min(TONES.length - 1, run.phase)]}
      status={`${whole(balance)} in`}
      statusActive={balance > 0}
      testId="lm-fund"
      data={{ "data-balance": Math.floor(balance) }}
      result={note}
      resultTestId="lm-fund-result"
    >
      <p
        data-testid="lm-fund-balance"
        className="flex items-baseline justify-between gap-3 border-2 border-slate-600 bg-slate-950 px-3 py-2"
      >
        <span className={`${pixelClass} text-xs text-cyan-200`}>In it now</span>
        <span
          className={`${pixelClass} text-xl leading-none tabular-nums text-amber-100`}
        >
          {whole(balance)}
        </span>
      </p>
      <p className="font-mono text-sm text-slate-200">{kind.verb}</p>
      <p className="font-mono text-sm font-bold text-emerald-200 tabular-nums">
        {balance > 0
          ? `Growing by ${whole(perMinute)} a minute.`
          : `Put ${kind.currency} in and it grows while you save up for something bigger.`}
      </p>
      <p className="font-mono text-xs text-amber-200">
        The catch: every {kind.currency === "coins" ? "coin" : "bit"} in here is
        not buying an upgrade now. Taking it out costs {fee}% today, and only{" "}
        {Math.round(TUNING.fund.lateFee * 100)}% once it has sat for a couple of
        minutes. When this part ends the {kind.name.toLowerCase()} closes, so
        take it out and spend it before then.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DEPOSIT_SHARES.map((share) => {
          const id = depositActionId(share);
          const amount = money * share;
          const doable = canPerformAction(def, run, id);
          return (
            <button
              key={id}
              type="button"
              aria-disabled={!doable}
              data-testid={`lm-${id}`}
              onClick={() => {
                if (doable)
                  act(id, `Put ${whole(amount)} ${kind.currency} in the jar.`);
              }}
              className={`${retroSecondaryButtonClass} flex-col aria-disabled:opacity-40`}
            >
              <span>{shareLabel(share)}</span>
              <span className="font-mono text-xs font-bold normal-case tabular-nums">
                +{whole(extraPerMinute(balance, amount, income))} a minute
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-disabled={!canTakeOut}
          data-testid="lm-fund-out"
          onClick={() => {
            if (canTakeOut)
              act(
                WITHDRAW_ACTION,
                `${whole(fundPayout(run))} ${kind.currency} comes out, after the ${fee}% fee.`
              );
          }}
          className={`${retroPrimaryButtonClass} flex-col aria-disabled:opacity-40`}
        >
          <span>Take it out</span>
          <span className="font-mono text-xs font-bold normal-case tabular-nums">
            {whole(fundPayout(run))} after {fee}%
          </span>
        </button>
      </div>
    </PanelFrame>
  );
}

export default memo(FundPanel);
