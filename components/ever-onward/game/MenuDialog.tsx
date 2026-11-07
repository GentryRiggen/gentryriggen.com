"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type {
  RunState,
  SaveData,
  UniverseDef,
} from "@/lib/ever-onward/engine/types";
import { AudioWaveform, Music2 } from "lucide-react";
import PlayOnSilentToggle from "../audio/PlayOnSilentToggle";
import { everOnwardChannels } from "../audio/soundSettings";
import NarrationSettings from "../narration/NarrationSettings";
import BackupPanel from "./BackupPanel";
import Logbook from "./Logbook";
import RetroDrawer from "./retro/RetroDrawer";
import TestModePanel from "./TestModePanel";
import type { JumpPoint } from "@/lib/ever-onward/test/jump";
import type { MapPreset } from "@/lib/ever-onward/test/mapJump";
import type { TestSpeed } from "@/lib/ever-onward/test/tester";
import {
  pixelClass,
  retroFocusClass,
  retroPrimaryButtonClass,
  retroSecondaryButtonClass,
} from "./retro/retroStyles";

export interface MenuTestMode {
  speed: TestSpeed | null;
  isJumping: boolean;
  onJump: (universeId: string, phase: number, point: JumpPoint) => void;
  onJumpMap?: (universeId: string, preset: MapPreset) => void;
  onSpeed: (speed: TestSpeed) => void;
  onExit: () => void;
}

interface MenuDialogProps {
  def: UniverseDef;
  run: RunState;
  currentSave: SaveData;
  isBackupDisabled: boolean;
  onLeave: () => void;
  onReplaceSave: (save: SaveData) => void;
  /** Starts this universe again from its first part. */
  onStartOver: () => void;
  onClose: () => void;
  /** Present for the owner only (Test mode). */
  testMode?: MenuTestMode;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className={`${pixelClass} text-xs text-cyan-200`}>{title}</h3>
      {children}
    </div>
  );
}

interface StartOverProps {
  title: string;
  /** The universe prestiges on a map (no embers to keep). */
  hasMap: boolean;
  onConfirm: () => void;
}

/** Start the universe over, behind a second, plainly worded tap. */
function StartOver({ title, hasMap, onConfirm }: StartOverProps) {
  const [isAsking, setIsAsking] = useState(false);
  if (!isAsking)
    return (
      <button
        type="button"
        data-testid="lm-start-over"
        onClick={() => setIsAsking(true)}
        className={`${retroSecondaryButtonClass} w-full`}
      >
        Start over
      </button>
    );
  return (
    <div
      role="group"
      aria-label="Start over?"
      data-testid="lm-start-over-confirm"
      className="space-y-2 border-2 border-amber-500 bg-amber-950/40 p-3"
    >
      <p className="font-mono text-sm text-amber-100">
        Start {title} again from the very beginning? This run&apos;s progress
        goes.{" "}
        {hasMap
          ? "You stay on the same square of the map, and everything you found stays."
          : "Your embers, permanent upgrades and finished runs stay."}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="lm-start-over-yes"
          onClick={onConfirm}
          className={`${retroPrimaryButtonClass} flex-1`}
        >
          Yes, start over
        </button>
        <button
          type="button"
          onClick={() => setIsAsking(false)}
          className={`${retroSecondaryButtonClass} flex-1`}
        >
          Keep playing
        </button>
      </div>
    </div>
  );
}

interface SoundSwitchProps {
  label: string;
  isOn: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function SoundSwitch({ label, isOn, onToggle, children }: SoundSwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={isOn}
      onClick={onToggle}
      className={`inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center gap-2 border-2 px-3 font-mono text-sm ${retroFocusClass} ${
        isOn
          ? "border-amber-400 bg-amber-900/50 text-amber-100"
          : "border-slate-600 bg-slate-900 text-slate-300"
      }`}
    >
      <span aria-hidden="true" className={isOn ? "" : "opacity-50"}>
        {children}
      </span>
      {label}: {isOn ? "on" : "off"}
    </button>
  );
}

/** Menu, leaving, sound, the logbook and saving, in a drawer. */
export default function MenuDialog({
  def,
  run,
  currentSave,
  isBackupDisabled,
  onLeave,
  onReplaceSave,
  onStartOver,
  onClose,
  testMode,
}: MenuDialogProps) {
  const isMusicOn = everOnwardChannels.music.useValue();
  const isEffectsOn = everOnwardChannels.effects.useValue();
  return (
    <RetroDrawer title="Menu" testId="lm-menu" onClose={onClose}>
      {testMode && (
        <Section title="Test mode">
          <TestModePanel
            currentId={def.id}
            speed={testMode.speed}
            isJumping={testMode.isJumping}
            onJump={(id, phase, point) => {
              testMode.onJump(id, phase, point);
              onClose();
            }}
            onJumpMap={(id, preset) => {
              testMode.onJumpMap?.(id, preset);
              onClose();
            }}
            onSpeed={testMode.onSpeed}
            onExit={() => {
              testMode.onExit();
              onClose();
            }}
          />
        </Section>
      )}
      <Section title="Play">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onLeave}
            className={`${retroPrimaryButtonClass} w-full`}
          >
            Back to all universes
          </button>
          <Link
            href="/ever-onward/versions"
            className={`${retroSecondaryButtonClass} w-full`}
          >
            What&apos;s new
          </Link>
          <StartOver
            title={def.title}
            hasMap={!!def.map}
            onConfirm={() => {
              onStartOver();
              onClose();
            }}
          />
        </div>
      </Section>
      <Section title="Sound">
        <div className="flex flex-wrap gap-2">
          <SoundSwitch
            label="Music"
            isOn={isMusicOn}
            onToggle={() => everOnwardChannels.music.set(!isMusicOn)}
          >
            <Music2 className="size-4" />
          </SoundSwitch>
          <SoundSwitch
            label="Effects"
            isOn={isEffectsOn}
            onToggle={() => everOnwardChannels.effects.set(!isEffectsOn)}
          >
            <AudioWaveform className="size-4" />
          </SoundSwitch>
        </div>
        <PlayOnSilentToggle />
        <NarrationSettings />
      </Section>
      {def.visitors && def.visitors.length > 0 && (
        <Logbook def={def} run={run} />
      )}
      <Section title="Save">
        <p className="font-mono text-xs text-slate-300">
          Your game saves on this device and pauses when you leave.
        </p>
        <BackupPanel
          save={currentSave}
          isDisabled={isBackupDisabled}
          onReplaceSave={onReplaceSave}
        />
      </Section>
    </RetroDrawer>
  );
}
