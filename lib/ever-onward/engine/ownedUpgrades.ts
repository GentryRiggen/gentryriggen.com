import type {
  PrestigeUpgradeDef,
  RunState,
  UniverseDef,
  UniverseSave,
  UpgradeDef,
} from "./types";

export interface OwnedRunUpgrade {
  upgrade: UpgradeDef;
  level: number;
  /** Null for a one-off (it has no levels to count). */
  maxLevel: number | null;
}

export interface OwnedPhaseGroup {
  /** Phase id, or null for upgrades that work in every part. */
  phaseId: string | null;
  title: string;
  items: OwnedRunUpgrade[];
}

export interface OwnedPrestige {
  upgrade: PrestigeUpgradeDef;
  level: number;
}

/** Prestige upgrades the player has bought at least once, in shop order. */
export function ownedPrestigeUpgrades(
  def: UniverseDef,
  universe: UniverseSave
): OwnedPrestige[] {
  return def.prestige.upgrades.flatMap((upgrade) => {
    const level = universe.prestigeUpgrades[upgrade.id] ?? 0;
    return level > 0 ? [{ upgrade, level }] : [];
  });
}

/**
 * Run upgrades owned right now, grouped by the part they belong to (the first
 * part they can be bought in), newest part first. Upgrades that work in every
 * part come last.
 */
export function ownedRunUpgradesByPhase(
  def: UniverseDef,
  run: RunState
): OwnedPhaseGroup[] {
  const groups = new Map<string | null, OwnedRunUpgrade[]>();
  for (const upgrade of def.upgrades) {
    const level = run.owned[upgrade.id] ?? 0;
    if (level <= 0) continue;
    const phaseId = upgrade.phases?.[0] ?? null;
    const maxLevel = upgrade.maxLevel === undefined ? null : upgrade.maxLevel;
    const list = groups.get(phaseId) ?? [];
    list.push({ upgrade, level, maxLevel });
    groups.set(phaseId, list);
  }
  const result: OwnedPhaseGroup[] = [];
  for (let i = def.phases.length - 1; i >= 0; i -= 1) {
    const phase = def.phases[i];
    const items = groups.get(phase.id);
    if (items) result.push({ phaseId: phase.id, title: phase.title, items });
  }
  const anyPhase = groups.get(null);
  if (anyPhase)
    result.push({ phaseId: null, title: "Every part", items: anyPhase });
  return result;
}

/** True once there is anything to show in the "Your upgrades" view. */
export function hasAnyUpgrade(def: UniverseDef, universe: UniverseSave) {
  return (
    ownedPrestigeUpgrades(def, universe).length > 0 ||
    def.upgrades.some((u) => (universe.run.owned[u.id] ?? 0) > 0)
  );
}

/** Changes only when something is bought, so views can memoise on it. */
export function ownedSignature(def: UniverseDef, universe: UniverseSave) {
  const run = universe.run.owned;
  const parts = def.upgrades.map((u) => run[u.id] ?? 0).join(",");
  const perm = def.prestige.upgrades
    .map((u) => universe.prestigeUpgrades[u.id] ?? 0)
    .join(",");
  return `${parts}|${perm}`;
}

const ARROW = /\s*(?:→|->)\s*/;

/**
 * Turns an `effectPreview` line ("Coins/sec 12 → 17 · Per tap 2 → 3") into
 * the value as it is now ("Coins/sec 12 · Per tap 2"). A one-off keeps the
 * after side instead ("Probes: 1, and they copy themselves"), because it is
 * already bought.
 */
export function currentEffectText(
  preview: string | null,
  isOneOff: boolean
): string | null {
  if (!preview) return null;
  return preview
    .split(" · ")
    .map((segment) => {
      const [before, ...rest] = segment.split(ARROW);
      if (rest.length === 0) return segment;
      if (!isOneOff) return before;
      const afterSide = rest.join(" ");
      const label = before.match(/^(.*?)(?:\s+\S*\d\S*)?$/)?.[1] ?? "";
      // "Probes: 0 → 1, and ..." keeps the label; "Probes 0 → 1" does too.
      return before === label ? afterSide : `${label} ${afterSide}`.trim();
    })
    .join(" · ");
}
