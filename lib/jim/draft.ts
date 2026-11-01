/**
 * The composer's unsent text, kept across the "Update ready" reload only:
 * written at the tap, read once on load, and removed again at once (and on
 * send, New chat and sign-out), so it never lingers. sessionStorage, so it
 * ends with the tab; every access is guarded.
 */

const keyFor = (uid: string) => `jim:draft:${uid}`;

export function saveDraft(uid: string, text: string): void {
  try {
    if (text) window.sessionStorage.setItem(keyFor(uid), text);
    else window.sessionStorage.removeItem(keyFor(uid));
  } catch {
    // Storage blocked: the reload may drop the draft, nothing worse.
  }
}

export function loadDraft(uid: string): string {
  try {
    return window.sessionStorage.getItem(keyFor(uid)) ?? "";
  } catch {
    return "";
  }
}

export function clearDraft(uid: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(uid));
  } catch {
    // Nothing to clear.
  }
}
