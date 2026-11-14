"use client";

import { useEffect, useRef, useState } from "react";
import {
  decodeBackup,
  encodeBackup,
} from "@/lib/ever-onward/engine/backupCode";
import type { SaveData } from "@/lib/ever-onward/engine/types";
import {
  pixelClass,
  retroDangerButtonClass,
  retroFieldClass,
  retroSecondaryButtonClass,
} from "./retro/retroStyles";

interface BackupPanelProps {
  save: SaveData;
  /** Overlays pause the game; backup actions wait until they're closed. */
  isDisabled: boolean;
  onReplaceSave: (save: SaveData) => void;
}

const COPIED_MS = 2500;

/** Copies with the clipboard API, or a selected hidden textarea if blocked. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the textarea trick.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.className = "fixed -top-96 left-0 opacity-0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

export default function BackupPanel({
  save,
  isDisabled,
  onReplaceSave,
}: BackupPanelProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [shownCode, setShownCode] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [pending, setPending] = useState<SaveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async () => {
    const code = encodeBackup(save);
    const isCopied = await copyText(code);
    setCopyState(isCopied ? "copied" : "failed");
    // If copying is blocked, show the code so it can be copied by hand.
    setShownCode(isCopied ? null : code);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopyState("idle"), COPIED_MS);
  };

  const handleLoad = () => {
    const decoded = decodeBackup(pasted);
    if (!decoded) {
      setPending(null);
      setError(
        "That code didn't work. Check that you copied all of it, then try again."
      );
      return;
    }
    setError(null);
    setPending(decoded);
  };

  const handleConfirm = () => {
    if (!pending) return;
    onReplaceSave(pending);
  };

  return (
    <section aria-labelledby="lm-backup-title" className="space-y-3">
      <h2
        id="lm-backup-title"
        className={`${pixelClass} text-[10px] text-cyan-200`}
      >
        Backup code
      </h2>
      <p className="font-mono text-xs text-slate-300">
        Copy a code and keep it somewhere safe. Paste it later, or on another
        device, to get your game back.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleCopy}
          className={retroSecondaryButtonClass}
        >
          Copy my code
        </button>
        <span
          role="status"
          className="font-mono text-sm font-bold text-emerald-300"
        >
          {copyState === "copied" && "Copied!"}
          {copyState === "failed" && "Couldn't copy. Copy it from the box."}
        </span>
      </div>
      {shownCode && (
        <textarea
          readOnly
          aria-label="Your backup code"
          value={shownCode}
          rows={3}
          onFocus={(event) => event.currentTarget.select()}
          className={retroFieldClass}
        />
      )}

      <div className="space-y-2">
        <label
          htmlFor="lm-backup-input"
          className={`${pixelClass} block text-[10px] text-cyan-200`}
        >
          Load a code
        </label>
        <textarea
          id="lm-backup-input"
          value={pasted}
          rows={3}
          disabled={isDisabled}
          placeholder="Paste your code here"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? "lm-backup-error" : undefined}
          onChange={(event) => {
            setPasted(event.target.value);
            setError(null);
            setPending(null);
          }}
          className={retroFieldClass}
        />
        {error && (
          <p
            id="lm-backup-error"
            role="alert"
            className="font-mono text-sm font-bold text-red-300"
          >
            {error}
          </p>
        )}
        {pending ? (
          <div
            role="group"
            aria-label="Confirm loading the code"
            className="space-y-2"
          >
            <p className="font-mono text-sm font-bold text-amber-100">
              This replaces the game on this device. Continue?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isDisabled}
                onClick={handleConfirm}
                className={retroDangerButtonClass}
              >
                Yes, replace my game
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className={retroSecondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isDisabled || pasted.trim() === ""}
            onClick={handleLoad}
            className={retroSecondaryButtonClass}
          >
            Load
          </button>
        )}
      </div>
    </section>
  );
}
