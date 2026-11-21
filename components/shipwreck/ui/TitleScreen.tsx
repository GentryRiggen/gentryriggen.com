"use client";

import Link from "next/link";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { SHIPWRECK_VERSION } from "@/lib/shipwreck/version";
import { PARENT_LINE } from "../parentLine";
import Icon from "./Icon";
import { FOCUS, PANEL, PRIMARY, SECONDARY } from "./styles";

interface TitleScreenProps {
  onRealNight: () => void;
  onWhatIf: () => void;
}

const COMING = ["Britannic", "Lusitania", "Edmund Fitzgerald"];

/** The title over the slowly circling, lit ship. */
export default function TitleScreen({
  onRealNight,
  onWhatIf,
}: TitleScreenProps) {
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
        <p className="max-w-md rounded-xl bg-slate-950/50 px-3 py-1 text-sm text-slate-300 backdrop-blur-sm">
          {PARENT_LINE}
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-col items-center gap-4 pb-2">
        <div className="flex w-full justify-center gap-2 overflow-x-auto px-1 pb-1">
          <div
            className={`${PANEL} flex shrink-0 flex-col items-start border-sky-300/70 px-4 py-2 ring-2 ring-sky-400/60`}
            aria-label="Ship: Titanic, 1912, 269 metres long"
          >
            <span className="text-xl font-semibold text-white">Titanic</span>
            <span className="text-sm text-slate-300">1912 · 269 m long</span>
          </div>
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
            aria-label="The real night: watch what happened"
            onClick={onRealNight}
            className={PRIMARY}
          >
            <Icon name="clock" className="size-8" />
            The real night
          </button>
          <button
            type="button"
            data-testid="shipwreck-what-if"
            aria-label="What if? Choose where the iceberg opens the hull"
            onClick={onWhatIf}
            className={SECONDARY}
          >
            <Icon name="iceberg" className="size-8" />
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
