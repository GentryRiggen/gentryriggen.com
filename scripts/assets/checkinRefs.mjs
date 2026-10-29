/**
 * The references a family check-in row shows: every manifest entry for the
 * part (masked or not; an unmasked or uncropped one shows the whole image),
 * the ones for the row's view first, then the general ones, then the rest, up
 * to `limit`.
 */
export function pickFamilyRefs(entries, view, limit = 3) {
  const own = entries.filter((e) => e.view === view);
  const general = entries.filter((e) => !e.view);
  const other = entries.filter((e) => e.view && e.view !== view);
  return [...own, ...general, ...other].slice(0, limit);
}
