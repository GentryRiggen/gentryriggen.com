"use client";

import { Share2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { buildShareUrl } from "@/lib/ship-builder/persist/share";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, inputClass, panelClass } from "./styles";

type CopyStatus = "pending" | "copied" | "failed";

export default function ShareButton() {
  const [link, setLink] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("pending");
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isOpen = link !== null;

  // A link for an old ship is misleading, so drop it as soon as the ship changes.
  useEffect(
    () =>
      useShipBuilderStore.subscribe((state, previous) => {
        if (state.ship !== previous.ship) setLink(null);
      }),
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setLink(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  // Without clipboard access, hand the user a selected link to copy by hand.
  useEffect(() => {
    if (copyStatus !== "failed" || !link) return;
    linkInputRef.current?.focus();
    linkInputRef.current?.select();
  }, [copyStatus, link]);

  async function handleShare() {
    const url = buildShareUrl(
      useShipBuilderStore.getState().ship,
      window.location.origin
    );
    setLink(url);
    setCopyStatus("pending");
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function handleClose() {
    setLink(null);
    shareButtonRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !link) return;
    // Keep the global Escape shortcut from also clearing the current tool.
    event.stopPropagation();
    handleClose();
  }

  return (
    <div ref={wrapperRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={shareButtonRef}
        type="button"
        onClick={handleShare}
        className={buttonClass}
      >
        <Share2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="sr-only sm:not-sr-only">Share</span>
      </button>
      {link && (
        <div
          role="dialog"
          aria-label="Share link"
          className={`absolute bottom-full right-0 z-40 mb-2 w-[min(20rem,calc(100vw-2rem))] space-y-2 rounded-lg border p-3 shadow-lg ${panelClass}`}
        >
          <input
            ref={linkInputRef}
            readOnly
            aria-label="Share link URL"
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className={`w-full font-mono text-xs ${inputClass}`}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {copyStatus === "copied"
                ? "Link copied to clipboard"
                : "Copy this link to share your ship"}
            </p>
            <button
              type="button"
              onClick={handleClose}
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
