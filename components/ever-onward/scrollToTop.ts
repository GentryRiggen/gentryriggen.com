/**
 * Jumps to the top of the page at once. The page has smooth scrolling, so the
 * jump asks for "instant"; a browser that rejects the options form gets the
 * plain call.
 */
export default function scrollToTop(): void {
  try {
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, 0);
  }
}
