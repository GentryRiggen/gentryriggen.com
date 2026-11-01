"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  PUMPKIN_COUNT,
  expectedSeconds,
  enterActionId,
  fairResultLine,
  fairStage,
  fairsSoFar,
  hasFairHand,
  handPaysOn,
  isFairOpen,
  likeliestPumpkin,
  placeChances,
  pumpkinsOnOffer,
  secondsToFair,
} from "@/lib/ever-onward/universes/grow/fair";
import { incomePerSecond } from "@/lib/ever-onward/universes/grow/tick";
import type { PanelProps } from "../../universes/types";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "./useRoving";

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** The three ribbon chances in whole percents that always total 100. */
function oddsOf(chances: readonly number[]): [number, number, number] {
  const a = Math.round(chances[0] * 100);
  const b = Math.round(chances[1] * 100);
  return [a, b, 100 - a - b];
}

const sizeWord = (size: number): string =>
  size < 0.4 ? "small" : size < 0.7 ? "medium" : "big";
const shineWord = (shine: number): string =>
  shine < 0.4 ? "plain" : shine < 0.7 ? "glossy" : "gleaming";

/** A pumpkin, drawn bigger when it is bigger and brighter when it shines. */
function PumpkinPicture({ size, shine }: { size: number; shine: number }) {
  const scale = 0.7 + size * 0.6;
  const body = shine < 0.4 ? "#c2410c" : shine < 0.7 ? "#ea580c" : "#fb923c";
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-14 w-14 shrink-0"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <g transform={`translate(20 22) scale(${scale}) translate(-20 -22)`}>
        <rect x="8" y="14" width="24" height="18" fill={body} />
        <rect x="5" y="18" width="30" height="10" fill={body} />
        <rect x="19" y="10" width="3" height="5" fill="#365314" />
        <rect x="16" y="14" width="2" height="18" fill="#9a3412" />
        <rect x="23" y="14" width="2" height="18" fill="#9a3412" />
        {shine >= 0.4 && (
          <rect x="10" y="17" width="4" height="4" fill="#fed7aa" />
        )}
        {shine >= 0.7 && (
          <rect x="27" y="22" width="3" height="3" fill="#fff7ed" />
        )}
      </g>
    </svg>
  );
}

/**
 * The County Fair: three pumpkins stand ready. Each shows its size and shine
 * and the honest chance of every ribbon, before you choose. Every pumpkin
 * wins a ribbon and every ribbon pays, so there is nothing to lose. A fair
 * waits as long as it takes.
 */
export default function CountyFair({ def, run, onAct }: PanelProps) {
  const stage = fairStage(run);
  const { radioProps } = useRoving(
    PUMPKIN_COUNT,
    stage === "judging" ? Number(run.resources.frPicked ?? 0) : 0
  );
  if (!isFairOpen(run) || run.complete) return null;

  const on = stage === "open";
  const judging = stage === "judging";
  const income = incomePerSecond(run);
  const best = likeliestPumpkin(run);
  const pumpkins = pumpkinsOnOffer(run);
  const resultLine = fairResultLine(run);
  const fairs = fairsSoFar(run);
  const earned = run.resources.frEarned ?? 0;
  const shown = run.resources.frShown ?? 0;

  const headline = on
    ? "The county fair is open! Pick a pumpkin to enter."
    : judging
      ? "The judges are walking along the row..."
      : shown === 0
        ? "The farm is getting ready for the county fair."
        : `The next fair is in about ${clock(secondsToFair(run))}.`;

  return (
    <section
      aria-label="County fair"
      data-testid="lm-fair"
      data-stage={stage}
      className="relative isolate space-y-3 overflow-hidden border-4 border-orange-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#7c2d12]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-orange-200`}>
          <span aria-hidden="true" className="mr-2 text-orange-300">
            ★
          </span>
          County fair
        </h2>
        <p
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            on
              ? "border-orange-300 bg-orange-950 text-orange-100"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {on ? "Pumpkins ready!" : judging ? "Judging" : "Getting ready"}
        </p>
      </header>

      <p
        data-testid="lm-fair-headline"
        className={`${pixelClass} text-xs leading-relaxed sm:text-sm ${
          on ? "text-orange-300" : "text-lime-50"
        }`}
      >
        {headline}
      </p>

      <p className="bee-reveal-2 font-mono text-xs text-slate-300">
        Every pumpkin wins a ribbon, and every ribbon pays. Better pumpkins have
        better chances of the bigger ones.
      </p>
      <div
        role="radiogroup"
        aria-label="Pumpkins to enter"
        className="bee-reveal-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {Array.from({ length: PUMPKIN_COUNT }, (_, i) => {
          const id = enterActionId(i);
          const doable = on && canPerformAction(def, run, id);
          const picked = judging && run.resources.frPicked === i;
          const [blue, red, garden] = oddsOf(placeChances(run, i));
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={picked}
              aria-disabled={!doable}
              aria-label={`Pumpkin ${i + 1}`}
              aria-describedby={`lm-fair-${i}-info`}
              data-testid={`lm-fair-enter-${i}`}
              {...radioProps(i)}
              onClick={() => {
                if (doable) onAct(id);
              }}
              className={`${pixelClass} flex min-h-14 w-full touch-manipulation items-center gap-2 border-4 px-2 py-2 text-left text-[9px] transition-transform aria-disabled:cursor-not-allowed sm:flex-col sm:text-center sm:text-[10px] ${retroFocusClass} ${
                on
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12] hover:bg-orange-300 active:translate-y-0.5 active:shadow-none"
                  : picked
                    ? "border-orange-200 bg-orange-900 text-orange-100"
                    : "border-slate-600 bg-slate-800 text-slate-400 shadow-[4px_4px_0_#0f172a]"
              }`}
            >
              {on || judging ? (
                <PumpkinPicture
                  size={pumpkins[i].size}
                  shine={pumpkins[i].shine}
                />
              ) : (
                <span aria-hidden="true" className="h-14 w-14 shrink-0" />
              )}
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block">
                  Pumpkin {i + 1}
                  {on && best === i ? " (best chances)" : ""}
                </span>
                <span id={`lm-fair-${i}-info`} className="block space-y-1">
                  {on || judging ? (
                    <>
                      <span className="block font-mono text-[11px] font-bold normal-case">
                        {sizeWord(pumpkins[i].size)},{" "}
                        {shineWord(pumpkins[i].shine)}
                      </span>
                      <span
                        data-testid={`lm-fair-odds-${i}`}
                        className="block font-mono text-[11px] font-bold normal-case"
                      >
                        Blue {blue}%, red {red}%, garden {garden}%
                      </span>
                      <span className="block font-mono text-[11px] normal-case">
                        About +
                        {formatNumber(
                          Math.floor(
                            expectedSeconds(run, i) * Math.max(1, income)
                          )
                        )}{" "}
                        harvest
                      </span>
                    </>
                  ) : (
                    <span className="block font-mono text-[11px] normal-case">
                      Not ready yet
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="lm-fair-result"
        className={
          resultLine
            ? "border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
            : "sr-only"
        }
      >
        {resultLine ?? ""}
      </p>

      {hasFairHand(run) && (
        <p className="font-mono text-xs text-orange-100">
          The fair helper enters the likeliest pumpkin if a fair waits a while:
          about +{formatNumber(Math.floor(handPaysOn(run, income)))} harvest, on
          top of what you win by hand.
        </p>
      )}

      {fairs > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Fairs judged so far: {fairs} (+{formatNumber(Math.floor(earned))}{" "}
          harvest).
        </p>
      )}
    </section>
  );
}
