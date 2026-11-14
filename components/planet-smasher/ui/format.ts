/** 1204883.4 -> "1,204,883" */
export function formatInt(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("en-US");
}
