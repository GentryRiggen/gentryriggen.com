"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
import {
  pixelClass,
  retroFocusClass,
  retroPrimaryButtonClass,
  retroSecondaryButtonClass,
} from "./retro/retroStyles";

interface MenuDialogProps {
  def: UniverseDef;
  run: RunState;
  currentSave: SaveData;
  isBackupDisabled: boolean;
  onLeave: () => void;
  onReplaceSave: (save: SaveData) => void;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className={`${pixelClass} text-xs text-cyan-200`}>{title}</h3>
      {children}
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
  onClose,
}: MenuDialogProps) {
  const isMusicOn = everOnwardChannels.music.useValue();
  const isEffectsOn = everOnwardChannels.effects.useValue();
  return (
    <RetroDrawer title="Menu" testId="lm-menu" onClose={onClose}>
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
