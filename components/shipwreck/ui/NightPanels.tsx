"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import {
  bowDownText,
  helpFor,
  leanText,
  powerText,
  waterText,
  type HelpTopic,
} from "@/lib/shipwreck/help";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { funnelPaintOf, type ShipSpec } from "@/lib/shipwreck/ships/types";
import { sampleTrack, type SimFrame } from "@/lib/shipwreck/sim/track";
import HelpCard from "./HelpCard";
import HullDiagram from "./HullDiagram";
import Icon, { type IconName } from "./Icon";
import { FOCUS, PANEL, ROUND, ROUND_ON } from "./styles";

/** How often the panel reads the frame (wall ms): calm, not per frame. */
const READ_MS = 250;

const CHIP_ICON: Record<Exclude<HelpTopic, "controls">, IconName> = {
  water: "underwater",
  bow: "sinks",
  lean: "stern",
  power: "lights",
};

/**
 * The player's own choice this session (null until they tap the button):
 * the panel starts closed at every size, so it never covers the opening
 * shot, and a choice carries over to the next run.
 */
let chosenOpen: boolean | null = null;

function startsOpen(): boolean {
  return chosenOpen ?? false;
}

/** Tests only: forget the session's choice. */
export function resetPanelChoice() {
  chosenOpen = null;
}

interface NightPanelsProps {
  store: PlaybackStore;
  spec: ShipSpec;
}

/**
 * The collapsible panel at the bottom left: stat chips (each explains itself)
 * and the side profile with the water filling each compartment live.
 */
export default function NightPanels({ store, spec }: NightPanelsProps) {
  const [open, setOpen] = useState(startsOpen);
  const [frame, setFrame] = useState<SimFrame | null>(null);
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  // A storm ship's hatch covers that have given way by now, as a key
  // ("3,4,5") so the panel re-renders only when one more goes.
  const [failedKey, setFailedKey] = useState("");
  const all = useStore(store, (s) => s.openings);
  // Her funnels in the diagram wear her livery's paint.
  const livery = useStore(store, (s) => s.livery);
  const waveRun = useStore(store, (s) => s.waveRun);
  // Only the holes open by now (a later torpedo's shows when it hits), as
  // a count so the diagram re-renders only when one more opens.
  const [openCount, setOpenCount] = useState(0);
  const openings = useMemo(() => {
    const byTime = [...all].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    return byTime.slice(0, openCount);
  }, [all, openCount]);
  const failed = useMemo(
    () =>
      new Set(
        failedKey === "" ? [] : failedKey.split(",").map((n) => Number(n))
      ),
    [failedKey]
  );

  useEffect(() => {
    const read = () => {
      const s = store.getState();
      if (s.track && s.track.frames.length > 0)
        setFrame(sampleTrack(s.track, s.t));
      const gone: number[] = [];
      for (const e of s.track?.events ?? [])
        if (e.kind === "hatch-fails" && e.t <= s.t && e.index !== undefined)
          gone.push(e.index);
      setFailedKey(gone.sort((a, b) => a - b).join(","));
      setOpenCount(s.openings.filter((o) => (o.t ?? 0) <= s.t).length);
    };
    read();
    const id = setInterval(read, READ_MS);
    return () => clearInterval(id);
  }, [store]);

  const chips: { topic: Exclude<HelpTopic, "controls">; text: string }[] = frame
    ? [
        { topic: "water", text: waterText(frame) },
        { topic: "bow", text: `Bow down ${bowDownText(frame)}` },
        { topic: "lean", text: `Lean ${leanText(frame)}` },
        { topic: "power", text: powerText(frame, spec) },
      ]
    : [];
  const whole = frame?.bodies.find((b) => b.part === "whole") ?? null;

  return (
    <>
      {open && (
        <div
          data-testid="shipwreck-panel"
          className={`${PANEL} pointer-events-auto flex w-[min(26rem,calc(100vw-7rem))] flex-col gap-2 p-2`}
        >
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.topic}
                type="button"
                data-testid={`shipwreck-stat-${c.topic}`}
                aria-label={`${c.text}. What is this?`}
                onClick={() => setTopic(c.topic)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-semibold text-slate-50 hover:bg-white/15 ${FOCUS}`}
              >
                <Icon
                  name={CHIP_ICON[c.topic]}
                  className="size-5 text-sky-200"
                />
                {c.text}
              </button>
            ))}
          </div>
          <HullDiagram
            spec={spec}
            water={frame?.water}
            boxWater={frame?.boxWater}
            openings={openings}
            failedHatches={failed}
            pose={whole}
            funnelPaint={funnelPaintOf(spec, livery)}
            title="The water inside each compartment"
            className="block h-auto w-full"
          />
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "Hide the water panel" : "Show the water inside"}
        aria-expanded={open}
        data-testid="shipwreck-panel-button"
        onClick={() => {
          chosenOpen = !open;
          setOpen(!open);
        }}
        className={open ? ROUND_ON : ROUND}
      >
        <Icon name="hull" className="size-8" />
      </button>
      {topic && (
        <HelpCard
          help={helpFor(topic, frame, spec, waveRun?.variant)}
          icon={CHIP_ICON[topic as Exclude<HelpTopic, "controls">]}
          onClose={() => setTopic(null)}
        />
      )}
    </>
  );
}
