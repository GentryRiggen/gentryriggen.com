"use client";

import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import NarrationToast from "./NarrationToast";
import { useNarration } from "./useNarration";

interface NarrationLayerProps {
  def: UniverseDef;
  run: RunState;
  isSuppressed: boolean;
}

/** Mounts narration for a running game: watches the story, shows the toast. */
export default function NarrationLayer({
  def,
  run,
  isSuppressed,
}: NarrationLayerProps) {
  const { toast, playToast, dismissToast } = useNarration({
    def,
    run,
    isSuppressed,
  });
  return (
    <NarrationToast
      toast={toast}
      playToast={playToast}
      dismissToast={dismissToast}
    />
  );
}
