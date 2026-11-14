import { currentPhase } from "./engine";
import { formatNumber } from "./format";
import type { ResourceDef, RunState, UniverseDef } from "./types";

/** The resources the current phase shows the player. */
export function shownResources(def: UniverseDef, run: RunState): ResourceDef[] {
  const phaseId = currentPhase(def, run).id;
  return def.resources.filter(
    (r) => r.phases === undefined || r.phases.includes(phaseId)
  );
}

/** A resource's value as the player reads it. */
export function formatResourceValue(
  resource: ResourceDef | undefined,
  value: number
): string {
  if (resource?.format) return resource.format(value);
  return formatNumber(Math.floor(value));
}

/** A small gain still reads as something: +0.06, not +0.1 or +0. */
export function formatGain(value: number): string {
  const size = Math.abs(value);
  if (size > 0 && size < 1) {
    const text = size < 0.1 ? size.toFixed(2) : size.toFixed(1);
    return value < 0 ? `-${text}` : text;
  }
  return formatNumber(value);
}

const lower = (label: string): string =>
  label.charAt(0).toLowerCase() + label.slice(1);

/**
 * What a tap or a button just changed, in the words the screen uses:
 * "+75 power", "-40 know-how", "Flame 42% → 57%". Only resources the phase
 * shows are named, so hidden bookkeeping never leaks. `first` puts one
 * resource at the front (the tap's own currency). Empty when nothing the
 * player can see moved, or the phase changed under it.
 */
export function describeChanges(
  def: UniverseDef,
  before: RunState,
  after: RunState,
  first?: string
): string[] {
  if (before.phase !== after.phase) return [];
  const lines: { id: string; text: string }[] = [];
  for (const r of shownResources(def, after)) {
    const was = before.resources[r.id] ?? 0;
    const now = after.resources[r.id] ?? 0;
    if (!Number.isFinite(was) || !Number.isFinite(now)) continue;
    const delta = now - was;
    if (Math.abs(delta) < 1e-9) continue;
    // A meter or a share reads best as before → after.
    if (r.format || r.label.includes("(")) {
      const from = formatResourceValue(r, was);
      const to = formatResourceValue(r, now);
      if (from !== to)
        lines.push({ id: r.id, text: `${r.label} ${from} → ${to}` });
      continue;
    }
    const amount = formatGain(delta);
    if (amount === "0" || amount === "-0") continue;
    const sign = delta > 0 ? "+" : "";
    lines.push({ id: r.id, text: `${sign}${amount} ${lower(r.label)}` });
  }
  // The HUD's watched meter (sway, cheer, the flame) may live in hidden
  // numbers: name it too, unless a resource line already said the same.
  const gaugeBefore = def.gauge?.(before);
  const gaugeAfter = def.gauge?.(after);
  if (
    gaugeBefore &&
    gaugeAfter &&
    gaugeBefore.label === gaugeAfter.label &&
    gaugeBefore.display !== undefined &&
    gaugeAfter.display !== undefined &&
    gaugeBefore.display !== gaugeAfter.display
  ) {
    const move = `${gaugeBefore.display} → ${gaugeAfter.display}`;
    if (!lines.some((l) => l.text.endsWith(move))) {
      const label =
        gaugeAfter.label.charAt(0) + gaugeAfter.label.slice(1).toLowerCase();
      lines.push({ id: "gauge", text: `${label} ${move}` });
    }
  }
  if (first)
    lines.sort((a, b) => Number(b.id === first) - Number(a.id === first));
  return lines.map((l) => l.text);
}
