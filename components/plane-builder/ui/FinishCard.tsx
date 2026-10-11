"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";
import usePrefersReducedMotion from "@/components/ship-builder/hooks/usePrefersReducedMotion";
import { LEVELS } from "@/lib/plane-builder/levels";
import type { LevelId } from "@/lib/plane-builder/levels/types";

interface FinishCardProps {
  unlocked: LevelId | null;
}

export default function FinishCard({ unlocked }: FinishCardProps) {
  const isReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isReducedMotion) return;
    void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }, [isReducedMotion]);

  return (
    <div className="rounded-xl bg-amber-100 p-3 text-center text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
      <p className="text-2xl font-extrabold">Level complete!</p>
      {unlocked ? (
        <p className="font-semibold">{LEVELS[unlocked].name} unlocked!</p>
      ) : null}
    </div>
  );
}
