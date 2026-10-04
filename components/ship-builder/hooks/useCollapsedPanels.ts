"use client";

import { useCallback } from "react";
import { createStoredSetting } from "./createStoredSetting";

export type PanelSide = "left" | "right";

interface CollapsedPanels {
  left: boolean;
  right: boolean;
  toggle: (side: PanelSide) => void;
}

/** Value is a primitive string ("l", "r", "lr" or "") so React can compare. */
const EXPANDED = "";

function parseCollapsed(raw: string | null): string {
  if (raw === null) return EXPANDED;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EXPANDED;
    const { left, right } = parsed as Record<string, unknown>;
    return `${left === true ? "l" : ""}${right === true ? "r" : ""}`;
  } catch {
    return EXPANDED;
  }
}

const collapsedSetting = createStoredSetting<string>({
  key: "ship-builder:ui:collapsed",
  parse: parseCollapsed,
  serialize: (value) =>
    JSON.stringify({ left: value.includes("l"), right: value.includes("r") }),
  fallback: EXPANDED,
});

/** Per-side collapsed state of the side panels, persisted across visits. */
export default function useCollapsedPanels(): CollapsedPanels {
  const snapshot = collapsedSetting.useValue();

  const toggle = useCallback((side: PanelSide) => {
    const flag = side === "left" ? "l" : "r";
    const current = collapsedSetting.get();
    const next = current.includes(flag)
      ? current.replace(flag, "")
      : // Keep a stable "lr" order whichever side was collapsed first.
        ["l", "r"].filter((f) => f === flag || current.includes(f)).join("");
    collapsedSetting.set(next);
  }, []);

  return {
    left: snapshot.includes("l"),
    right: snapshot.includes("r"),
    toggle,
  };
}
