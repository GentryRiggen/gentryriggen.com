"use client";

import { useState } from "react";
import {
  pickNextUpgrade,
  type NextUpgrade,
} from "@/lib/ever-onward/engine/pull";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";

/** The upgrade to chase, kept stable so it can glow once it is affordable. */
export function useNextUpgrade(
  def: UniverseDef,
  run: RunState
): NextUpgrade | null {
  const [stickyId, setStickyId] = useState<string | undefined>();
  const next = pickNextUpgrade(def, run, stickyId);
  if (next?.upgrade.id !== stickyId) setStickyId(next?.upgrade.id);
  return next;
}
