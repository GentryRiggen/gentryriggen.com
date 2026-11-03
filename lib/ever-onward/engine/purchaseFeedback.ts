import { formatNumber } from "./format";

/**
 * Lead with the change a purchase makes, followed by the resulting output:
 * "+3 blocks/sec" then "Blocks/sec 12 → 15". `unit` names what you get
 * ("blocks/sec", "smiles per tap"), never just "per second".
 */
export function rateEffect(
  before: number,
  after: number,
  unit: string
): string {
  const delta = after - before;
  const label = unit.charAt(0).toUpperCase() + unit.slice(1);
  const detail = `${label} ${formatNumber(before)} → ${formatNumber(after)}`;
  if (delta === 0) return detail;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNumber(delta)} ${unit}\n${detail}`;
}
