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

/** Compact people counts: 950, 12K, 41M, 1.2B (one decimal under 10). */
export function formatPeople(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v < 1000) return String(v);
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (v < size) continue;
    const x = v / size;
    if (x < 10)
      return `${(Math.floor(x * 10) / 10).toFixed(1).replace(".0", "")}${suffix}`;
    return `${Math.floor(x)}${suffix}`;
  }
  return String(v);
}
