"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import { spokenText, storyClipId } from "@/lib/ever-onward/narration/lines";
import { getClip } from "@/lib/ever-onward/narration/manifest";
import {
  playNarration,
  queueNarration,
  stopNarration,
  unlockNarrationOnGesture,
} from "./player";
import { useNarrationSettings } from "./settings";

export const TOAST_MS = 8000;
const PREVIEW_WORDS = 5;

export interface NarrationToastState {
  clipId: string;
  /** The first few words, so the player knows which message it is. */
  preview: string;
}

interface UseNarrationOptions {
  def: UniverseDef;
  run: RunState;
  /** True while a full-screen moment is up; messages then stay silent. */
  isSuppressed?: boolean;
}

export interface NarrationApi {
  toast: NarrationToastState | null;
  playToast(): void;
  dismissToast(): void;
}

function previewOf(text: string): string {
  const words = spokenText(text).split(/\s+/);
  return words.length > PREVIEW_WORDS
    ? `${words.slice(0, PREVIEW_WORDS).join(" ")}…`
    : words.join(" ");
}

/**
 * Watches the run's story for lines that just fired and offers to read them
 * (or reads them, with auto-play). A story that is already there on load, or
 * that shrinks on restart, never counts as new.
 */
export function useNarration({
  def,
  run,
  isSuppressed = false,
}: UseNarrationOptions): NarrationApi {
  const { isEnabled, isAutoPlay } = useNarrationSettings();
  const [toast, setToast] = useState<NarrationToastState | null>(null);
  const seen = useRef({ universe: def.id, count: run.story.length });
  const story = run.story;

  useEffect(() => {
    if (isEnabled) unlockNarrationOnGesture();
  }, [isEnabled]);

  useEffect(() => {
    const before = seen.current;
    seen.current = { universe: def.id, count: story.length };
    if (before.universe !== def.id || story.length <= before.count) return;
    if (!isEnabled || isSuppressed) return;
    const fresh = story.slice(before.count).flatMap((id) => {
      const clipId = storyClipId(def.id, id);
      const message = def.story.find((m) => m.id === id);
      return message && getClip(clipId) ? [{ clipId, message }] : [];
    });
    if (fresh.length === 0) return;
    if (isAutoPlay) {
      fresh.forEach(({ clipId }) => queueNarration(clipId));
      return;
    }
    const newest = fresh[fresh.length - 1];
    setToast({
      clipId: newest.clipId,
      preview: previewOf(newest.message.text),
    });
  }, [story, def, isEnabled, isAutoPlay, isSuppressed]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Turning narration off silences it at once.
  useEffect(() => {
    if (!isEnabled) stopNarration();
  }, [isEnabled]);

  useEffect(() => () => stopNarration(), []);

  const playToast = useCallback(() => {
    if (toast) playNarration(toast.clipId);
    setToast(null);
  }, [toast]);
  const dismissToast = useCallback(() => setToast(null), []);

  return { toast: isEnabled ? toast : null, playToast, dismissToast };
}
