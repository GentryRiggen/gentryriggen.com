"use client";

import Link from "next/link";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { SHIP_IDS, getShip } from "@/lib/shipwreck/ships";
import type { ShipId } from "@/lib/shipwreck/ships/types";
import { storyOf } from "@/lib/shipwreck/story";
import { SHIPWRECK_VERSION } from "@/lib/shipwreck/version";
import { PARENT_LINES } from "../parentLine";
import Icon from "./Icon";
import { FOCUS, PANEL, PRIMARY, SECONDARY } from "./styles";

interface TitleScreenProps {
  /** The chosen ship. */
  ship: ShipId;
  onShip: (ship: ShipId) => void;
  onRealNight: () => void;
  onWhatIf: () => void;
}

const COMING = ["Britannic", "Edmund Fitzgerald"];

/** The title over the slowly circling, lit ship, and the ship picker. */
export default function TitleScreen({
  ship,
  onShip,
  onRealNight,
  onWhatIf,
}: TitleScreenProps) {
  const spec = getShip(ship);
  const story = storyOf(spec);
  const torpedo = spec.cause === "torpedo";

  return (
    <main
      data-testid="shipwreck-screen"
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-between overflow-y-auto ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-2 pt-4 text-center">
        <h1
          data-testid="shipwreck-title"
          className="text-5xl font-semibold tracking-wide text-slate-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:text-7xl"
        >
          Shipwreck
        </h1>
        <p
          data-testid="shipwreck-parent-line"
          className="max-w-md rounded-xl bg-slate-950/50 px-3 py-1 text-sm text-slate-300 backdrop-blur-sm"
        >
          {PARENT_LINES[ship]}
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-col items-center gap-4 pb-2">
        <div
          role="radiogroup"
          aria-label="Choose a ship"
          className="flex w-full justify-center gap-2 overflow-x-auto px-1 pb-1"
        >
          {SHIP_IDS.map((id) => {
            const s = getShip(id);
            const on = id === ship;
            const length = Math.round(s.loa);
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`Ship: ${s.name}, ${s.year}, ${length} metres long`}
                data-testid={`shipwreck-ship-${id}`}
                onClick={() => onShip(id)}
                className={`${PANEL} pointer-events-auto flex min-h-16 shrink-0 touch-manipulation flex-col items-start px-4 py-2 text-left active:scale-95 ${
                  on
                    ? "border-sky-300/70 ring-2 ring-sky-400/60"
                    : "opacity-80 hover:opacity-100"
                } ${FOCUS}`}
              >
                <span
                  className={`text-xl font-semibold ${on ? "text-white" : "text-slate-200"}`}
                >
                  {s.name}
                </span>
                <span className="text-sm text-slate-300">
                  {s.year} · {length} m long
                </span>
              </button>
            );
          })}
          {COMING.map((name) => (
            <div
              key={name}
              className={`${PANEL} hidden shrink-0 flex-col items-start px-4 py-2 opacity-50 sm:flex`}
              aria-label={`${name}: coming soon`}
            >
              <span className="text-base font-semibold text-slate-300">
                {name}
              </span>
              <span className="text-xs text-slate-400">Coming soon</span>
            </div>
          ))}
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            data-testid="shipwreck-real-night"
            aria-label={`${story.realLabel}: watch what happened`}
            onClick={onRealNight}
            className={PRIMARY}
          >
            <Icon name="clock" className="size-8" />
            {story.realLabel}
          </button>
          <button
            type="button"
            data-testid="shipwreck-what-if"
            aria-label={
              torpedo
                ? "What if? Choose where the torpedo hits"
                : "What if? Choose where the iceberg opens the hull"
            }
            onClick={onWhatIf}
            className={SECONDARY}
          >
            <Icon name={torpedo ? "torpedo" : "iceberg"} className="size-8" />
            What if?
          </button>
        </div>
        <Link
          href="/shipwreck/versions"
          className={`pointer-events-auto inline-flex min-h-11 items-center rounded-full bg-slate-950/50 px-4 text-sm font-semibold text-sky-300 underline underline-offset-4 hover:text-sky-200 ${FOCUS}`}
        >
          What&apos;s new · v{SHIPWRECK_VERSION}
        </Link>
      </div>
    </main>
  );
}
