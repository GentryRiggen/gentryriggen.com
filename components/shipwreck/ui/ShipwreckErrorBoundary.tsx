"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import { PRIMARY } from "./styles";

interface ShipwreckErrorBoundaryProps {
  children: ReactNode;
  /** Starts the game again (a page reload by default). */
  onRestart?: () => void;
}

interface ShipwreckErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches a crash in the 3D stage or the game (a WebGL context that cannot
 * be made or does not come back, a model build that throws) and shows a
 * calm night panel with one big button, instead of a blank page in a
 * home-screen app that has no reload button. A class: React only catches
 * render errors in a class component.
 */
export default class ShipwreckErrorBoundary extends Component<
  ShipwreckErrorBoundaryProps,
  ShipwreckErrorBoundaryState
> {
  state: ShipwreckErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ShipwreckErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Shipwreck stopped:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const restart = this.props.onRestart ?? (() => window.location.reload());
    return (
      <div
        role="alert"
        data-testid="shipwreck-crash"
        className={`fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-[#05080f] px-6 text-center text-slate-100 ${SAFE_INSETS}`}
      >
        <p className="max-w-md text-2xl font-semibold text-slate-50">
          Something went wrong with the ship.
        </p>
        <button
          type="button"
          data-testid="shipwreck-crash-restart"
          onClick={restart}
          className={PRIMARY}
        >
          Tap to start again
        </button>
      </div>
    );
  }
}
