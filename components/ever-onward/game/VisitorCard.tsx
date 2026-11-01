"use client";

import type { VisitorDef } from "@/lib/ever-onward/engine/types";
import { storyClipId } from "@/lib/ever-onward/narration/lines";
import ListenButton from "../narration/ListenButton";
import {
  pixelClass,
  retroLabelClass,
  retroPanelClass,
  retroPrimaryButtonClass,
} from "./retro/retroStyles";

interface VisitorCardProps {
  universeId: string;
  visitor: VisitorDef;
  /** The line the visitor arrived with (the story message). */
  text: string;
  /** What the gift is right now, in words. */
  giftText: string;
  onGreet: (id: string) => void;
}

/**
 * A visitor who has arrived and is waiting. It stays until the player says
 * hello, however long that takes: nothing here can be missed or runs out.
 */
export default function VisitorCard({
  universeId,
  visitor,
  text,
  giftText,
  onGreet,
}: VisitorCardProps) {
  return (
    <section
      aria-label={`Visitor: ${visitor.name}`}
      data-testid="lm-visitor"
      className={`${retroPanelClass} lm-pop space-y-3 p-3`}
    >
      <p className={`${retroLabelClass} leading-normal`}>
        <span aria-hidden="true" className="mr-2 text-amber-300">
          ✦
        </span>
        A visitor!
      </p>
      <p className={`${pixelClass} text-[10px] leading-relaxed text-amber-300`}>
        {visitor.name}
      </p>
      <p className="font-mono text-sm text-amber-50">
        {text}
        <ListenButton
          clipId={storyClipId(universeId, visitor.id)}
          accessibleLabel="Listen to this visitor"
          className="ml-2 size-8 border-2 border-slate-500 align-middle text-xs text-amber-300 hover:bg-slate-800"
        />
      </p>
      <p className="font-mono text-sm font-bold text-emerald-300">
        A gift for you: {giftText}
      </p>
      <button
        type="button"
        onClick={() => onGreet(visitor.id)}
        className={retroPrimaryButtonClass}
      >
        Say hello
      </button>
    </section>
  );
}
