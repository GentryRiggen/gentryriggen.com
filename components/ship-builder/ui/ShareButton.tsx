"use client";

import { useState } from "react";
import { buildShareUrl } from "@/lib/ship-builder/persist/share";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, inputClass, panelClass } from "./styles";

export default function ShareButton() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = buildShareUrl(
      useShipBuilderStore.getState().ship,
      window.location.origin
    );
    setLink(url);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleShare} className={buttonClass}>
        Share
      </button>
      {link && (
        <div
          role="dialog"
          aria-label="Share link"
          className={`absolute bottom-full right-0 z-40 mb-2 w-80 space-y-2 rounded-lg border p-3 shadow-lg ${panelClass}`}
        >
          <input
            readOnly
            aria-label="Share link URL"
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className={`w-full font-mono text-xs ${inputClass}`}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {copied
                ? "Link copied to clipboard"
                : "Copy this link to share your ship"}
            </p>
            <button
              type="button"
              onClick={() => setLink(null)}
              className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
