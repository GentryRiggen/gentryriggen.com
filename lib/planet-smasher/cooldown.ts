import type { ToolId } from "./tools";
import { TOOLS } from "./tools";

interface Window {
  start: number;
  end: number;
}

const windows = new Map<ToolId, Window>();
const listeners = new Set<() => void>();

const nowMs = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();

/** Returns true and starts the cooldown, or false while the tool is cooling. */
export function tryFire(toolId: ToolId, now = nowMs()): boolean {
  const w = windows.get(toolId);
  if (w && now < w.end) return false;
  const ms = TOOLS[toolId].cooldownMs;
  if (ms > 0) {
    windows.set(toolId, { start: now, end: now + ms });
    listeners.forEach((l) => l());
  }
  return true;
}

/** 0..1 of the cooldown left (1 right after a shot), or 0 when ready. */
export function cooldownLeft(toolId: ToolId, now = nowMs()): number {
  const w = windows.get(toolId);
  if (!w || now >= w.end) return 0;
  return (w.end - now) / (w.end - w.start);
}

export function subscribeCooldown(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function resetCooldowns(): void {
  windows.clear();
}
