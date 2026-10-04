const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Wraps Tab / Shift+Tab focus between the first and last focusable child. */
export default function trapTab(container: HTMLElement, event: KeyboardEvent) {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const isInside = active instanceof Node && container.contains(active);
  if (event.shiftKey && (active === first || !isInside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !isInside)) {
    event.preventDefault();
    first.focus();
  }
}
