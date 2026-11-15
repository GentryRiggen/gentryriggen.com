/** 1204883.4 -> "1,204,883" */
export function formatInt(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("en-US");
}

/** Compact star counts: 9500 -> "9,500", 12000 -> "12k", 12500 -> "12.5k". */
export function formatStars(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 10000) return v.toLocaleString("en-US");
  const k = Math.floor(v / 100) / 10; // one decimal of thousands
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}
