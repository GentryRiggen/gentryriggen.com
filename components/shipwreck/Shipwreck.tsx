"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import GameShell from "@/components/game-kit/GameShell";
import { useGameServiceWorker } from "@/components/game-kit/useGameServiceWorker";
import { useGameUpdate } from "@/components/game-kit/useGameUpdate";
import useVisibilityPause from "@/components/game-kit/useVisibilityPause";
import UpdatePill from "@/components/update/UpdatePill";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { installTestHooks } from "@/lib/shipwreck/testHooks";
import { useShipwreckSave } from "@/lib/shipwreck/useSave";
import { PARENT_LINE } from "./parentLine";

export default function Shipwreck() {
  const { persist } = useShipwreckSave();

  useEffect(() => installTestHooks(() => "title"), []);

  useVisibilityPause({ onPersist: persist });

  useGameServiceWorker("shipwreck");
  const { isUpdateReady, update } = useGameUpdate("shipwreck", {
    saveNow: persist,
    serviceWorker: true,
  });

  return (
    <GameShell className="bg-[#05080f] text-slate-100" testId="shipwreck-root">
      <main
        data-testid="shipwreck-screen"
        className={`flex h-full flex-col items-center justify-between overflow-y-auto ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
      >
        <div />
        <div className="max-w-xl space-y-5 py-6 text-center">
          <h1
            data-testid="shipwreck-title"
            className="text-5xl font-semibold tracking-wide text-slate-50 sm:text-6xl"
          >
            Shipwreck
          </h1>
          <Image
            src="/shipwreck-icons/icon-512-v1.png"
            alt="The Titanic sinking at night"
            width={512}
            height={512}
            priority
            className="mx-auto h-48 w-48 rounded-[2.5rem] shadow-2xl shadow-sky-950 sm:h-64 sm:w-64"
          />
          <p
            data-testid="shipwreck-coming-soon"
            className="text-2xl font-semibold text-amber-200"
          >
            The Titanic is being built. Check back soon!
          </p>
          <p className="text-base text-slate-400">{PARENT_LINE}</p>
        </div>
        <Link
          href="/shipwreck/versions"
          className="mb-2 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-sky-300 underline underline-offset-4 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          What&apos;s new
        </Link>
      </main>
      {isUpdateReady && (
        <UpdatePill
          onUpdate={update}
          testId="shipwreck-update"
          className={`pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4`}
          buttonClassName="pointer-events-auto min-h-16 touch-manipulation rounded-full border border-sky-400 bg-slate-900 px-6 py-3 text-lg font-semibold text-sky-200 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />
      )}
    </GameShell>
  );
}
