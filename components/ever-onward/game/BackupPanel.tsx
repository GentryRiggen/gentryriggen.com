"use client";

import { useEffect, useRef, useState } from "react";
import {
  decodeBackup,
  encodeBackup,
} from "@/lib/ever-onward/engine/backupCode";
import type { SaveData } from "@/lib/ever-onward/engine/types";
import {
  dangerButtonClass,
  focusRingClass,
  secondaryButtonClass,
} from "../styles";

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
      <h2 id="lm-backup-title" className="text-sm font-bold">
        Backup code
      </h2>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Copy a code and keep it somewhere safe. Paste it later, or on another
        device, to get your game back.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleCopy}
          className={secondaryButtonClass}
        >
          Copy my code
        </button>
        <span role="status" className="text-sm font-semibold">
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
          className={`w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${focusRingClass}`}
        />
      )}

      <div className="space-y-2">
        <label
          htmlFor="lm-backup-input"
          className="block text-sm font-semibold"
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
          className={`w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${focusRingClass}`}
        />
        {error && (
          <p
            id="lm-backup-error"
            role="alert"
            className="text-sm font-semibold text-red-700 dark:text-red-300"
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
            <p className="text-sm font-semibold">
              This replaces the game on this device. Continue?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isDisabled}
                onClick={handleConfirm}
                className={dangerButtonClass}
              >
                Yes, replace my game
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className={secondaryButtonClass}
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
            className={secondaryButtonClass}
          >
            Load
          </button>
        )}
      </div>
    </section>
  );
}
