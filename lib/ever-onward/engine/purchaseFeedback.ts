import { formatNumber } from "./format";

/** Lead with the change a purchase makes, followed by the resulting output. */
export function rateEffect(
  before: number,
  after: number,
  unit: string
): string {
  const delta = after - before;
  const detail = `${unit} ${formatNumber(before)} → ${formatNumber(after)}`;
  if (delta === 0) return detail;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNumber(delta)} ${unit}\n${detail}`;
}
