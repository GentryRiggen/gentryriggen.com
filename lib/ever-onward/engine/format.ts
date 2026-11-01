const SUFFIXES = [
  "K",
  "M",
  "B",
  "T",
  "Qa",
  "Qi",
  "Sx",
  "Sp",
  "Oc",
  "No",
  "Dc",
] as const;

/** Three significant-ish digits: 1.23, 12.3, 123. */
function sig(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** 999, 1.50K, 12.3M, ... 123Dc, then 1.23e36. Whole numbers below 1000. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : value < 0 ? "-∞" : "0";
  if (value < 0) return `-${formatNumber(-value)}`;
  if (value < 1000) {
    if (Number.isInteger(value)) return String(value);
    return value < 10 ? value.toFixed(1) : String(Math.floor(value));
  }
  const group = Math.floor(Math.log10(value) / 3);
  if (group > SUFFIXES.length) {
    const exp = Math.floor(Math.log10(value));
    return `${(value / 10 ** exp).toFixed(2)}e${exp}`;
  }
  let scaled = value / 1000 ** group;
  let index = group;
  // 999.9K rounds to 1000K; roll over to 1.00M instead.
  if (Number(sig(scaled)) >= 1000) {
    scaled /= 1000;
    index += 1;
    if (index > SUFFIXES.length) return formatNumber(value);
  }
  return `${sig(scaled)}${SUFFIXES[index - 1]}`;
}

/** 45s, 3m 05s, 2h 14m, 1d 3h. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  if (total < 3600) return `${m}m ${String(total % 60).padStart(2, "0")}s`;
  const h = Math.floor(total / 3600);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
