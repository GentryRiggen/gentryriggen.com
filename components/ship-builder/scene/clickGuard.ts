/**
 * Swallows the click that follows a press-and-hold delete, so releasing the
 * pointer doesn't select the part (dropping a pending removal) or place a
 * part on whatever was behind the deleted one.
 *
 * It lives in a module rather than the store because it is a scene-only,
 * per-gesture flag that nothing renders.
 */

/**
 * How long after the release the guard waits for its click. Browsers fire it
 * right after pointerup; a long touch may not produce one at all.
 */
export const CLICK_GUARD_RELEASE_MS = 400;

let armed = false;
let expiry: ReturnType<typeof setTimeout> | null = null;

function clearExpiry(): void {
  if (expiry) clearTimeout(expiry);
  expiry = null;
}

/** A hold fired: swallow clicks until shortly after the pointer lifts. */
export function holdClickGuard(): void {
  clearExpiry();
  armed = true;
}

/** The held pointer lifted: give its click a moment to arrive. */
export function releaseClickGuard(): void {
  if (!armed || expiry) return;
  expiry = setTimeout(resetClickGuard, CLICK_GUARD_RELEASE_MS);
}

/**
 * A primary pointerdown starts a new gesture, so any click owed to an earlier
 * hold has already fired (or never will). Clears a guard left armed by a lost
 * pointerup or a hold aborted by a second finger.
 */
export function notePointerDown(isPrimary: boolean): void {
  if (isPrimary) resetClickGuard();
}

/** Click handlers call this first and bail out on true. Consumes the guard. */
export function shouldSwallowClick(): boolean {
  if (!armed) return false;
  resetClickGuard();
  return true;
}

export function resetClickGuard(): void {
  clearExpiry();
  armed = false;
}
