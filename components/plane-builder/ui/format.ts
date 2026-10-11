export function formatCoins(coins: number): string {
  return Math.round(coins).toLocaleString("en-US");
}

/** Whole percent of the way to the finish, 0 to 100. */
export function percentOf(distance: number, finish: number): number {
  if (finish <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((distance / finish) * 100)));
}
