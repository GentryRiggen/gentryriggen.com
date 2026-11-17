/**
 * Helpers for APIs the oldest iPad we support (Safari 15.0) lacks. ESLint bans
 * the originals in shipped code (eslint.config.mjs); use these instead.
 */

/** `Object.hasOwn` (Safari 15.4). */
export function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** `array.at(index)` (Safari 15.4): negative indexes count from the end. */
export function at<T>(array: ArrayLike<T>, index: number): T | undefined {
  const i = index < 0 ? array.length + index : index;
  return i >= 0 && i < array.length ? array[i] : undefined;
}

/** `array.findLast` (Safari 15.4). */
export function findLast<T>(
  array: readonly T[],
  test: (item: T, index: number) => boolean
): T | undefined {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (test(array[i], i)) return array[i];
  }
  return undefined;
}

/** `array.findLastIndex` (Safari 15.4). */
export function findLastIndex<T>(
  array: readonly T[],
  test: (item: T, index: number) => boolean
): number {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (test(array[i], i)) return i;
  }
  return -1;
}

/** `array.toSorted` (Safari 16): a sorted copy. */
export function sorted<T>(
  array: readonly T[],
  compare?: (a: T, b: T) => number
): T[] {
  return [...array].sort(compare);
}
