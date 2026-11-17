"use client";

import type { ReactNode } from "react";
import useBlockPinchZoom from "./useBlockPinchZoom";

interface GameShellProps {
  children: ReactNode;
  /** Extra classes for the frame (background, colour). */
  className?: string;
  /** Lets text be selected (a story or reader); default off for a game. */
  allowSelection?: boolean;
  /** Lets pinch-zoom through (a 3D viewer); default blocked. */
  allowZoom?: boolean;
  testId?: string;
}

/**
 * The frame of an iOS home-screen game: it fills the dynamic viewport
 * (`100dvh`, so the Safari toolbar never leaves a gap), cannot be
 * overscrolled or rubber-banded, does not select text or show the iOS
 * long-press callout, keeps taps fast (no double-tap zoom) and blocks
 * pinch-zoom. It does NOT pad for the notch: pad each pinned bar or overlay
 * itself with SAFE_INSETS / SAFE_TOP / SAFE_BOTTOM from lib/game-kit/safeArea,
 * so a full-bleed scene can still run under the status bar.
 */
export default function GameShell({
  children,
  className = "",
  allowSelection = false,
  allowZoom = false,
  testId,
}: GameShellProps) {
  return (
    <ZoomGuard enabled={!allowZoom}>
      <div
        data-testid={testId}
        className={`fixed inset-0 h-[100dvh] w-full touch-manipulation overflow-hidden overscroll-none ${
          allowSelection
            ? ""
            : "select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]"
        } ${className}`}
      >
        {children}
      </div>
    </ZoomGuard>
  );
}

function ZoomGuard({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return enabled ? <BlockZoom>{children}</BlockZoom> : <>{children}</>;
}

function BlockZoom({ children }: { children: ReactNode }) {
  useBlockPinchZoom();
  return <>{children}</>;
}
