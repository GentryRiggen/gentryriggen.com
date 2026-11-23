import type { Compartment, Opening, ShipSpec } from "../ships/types";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { max, min } = Math;

const X_EPS = 1e-6;
/** Seconds between a mine ship's blasts (several chosen spots), as torpedoes. */
const STAGGER_S = 3;

/**
 * A mine What-if (1.4, the Britannic). The spots are her main spaces aft
 * to forward (not the double-skin voids), as a torpedo ship's. Her real
 * spot (the compartment of her real hole, `realNight[0]`) gives her real
 * damage exactly: the hole, and the run's torn bulkheads (the ship's
 * `kind: "damage"` doors) come with it (`holdsRealMine`). Any other spot
 * gets one hole of the same total area and heights at its middle, in the
 * side shell: into its starboard double-skin void if it has one (a mine
 * there fills only the void), else into the space. Several spots are
 * several mines, aft first, `STAGGER_S` apart (one mine: at 0).
 */
export function mineOpenings(
  spec: ShipSpec,
  spots: readonly string[],
  ids: readonly string[]
): Opening[] {
  const real = spec.realNight;
  if (real.length === 0) return [];
  const realSpot = real[0].compartmentId;
  const area = real.reduce((a, o) => a + o.areaM2, 0);
  const zLow = min(...real.map((o) => o.zLow));
  const zHigh = max(...real.map((o) => o.zHigh));
  const comps = spec.compartments;
  const hits: { x: number; open: Opening[] }[] = [];
  for (const id of spots) {
    if (!ids.includes(id)) continue;
    if (id === realSpot) {
      hits.push({ x: real[0].x, open: real.map((o) => o) });
      continue;
    }
    const main = comps.find((c) => c.id === id) as Compartment;
    const wing = comps.find(
      (c) =>
        c.span?.side === "starboard" &&
        c.fromX < main.toX - X_EPS &&
        c.toX > main.fromX + X_EPS
    );
    const into = wing ?? main;
    const x = (max(into.fromX, main.fromX) + min(into.toX, main.toX)) / 2;
    hits.push({
      x,
      open: [
        {
          compartmentId: into.id,
          areaM2: area,
          zLow,
          zHigh,
          x,
          side: "starboard",
        },
      ],
    });
  }
  const xs = hits.map((h) => h.x).sort((a, b) => a - b);
  const out: Opening[] = [];
  for (const h of hits) {
    const lag = xs.length > 1 ? xs.indexOf(h.x) * STAGGER_S : 0;
    for (const o of h.open)
      out.push(lag > 0 ? { ...o, t: (o.t ?? 0) + lag } : o);
  }
  return out;
}

/**
 * Does a run hold the ship's real mine (her real hole, at any time)? Its
 * torn bulkheads (`kind: "damage"` doors) come only with it. They open from
 * the start of the run even when the real hole is staggered (several mines:
 * hers lands a few seconds after the first): the tears let water through
 * only once her hole has filled the spaces either side, so opening them
 * those seconds early changes nothing a run can show.
 */
export function holdsRealMine(
  spec: ShipSpec,
  openings: readonly Opening[]
): boolean {
  const hole = spec.realNight[0];
  if (!hole) return false;
  return openings.some(
    (o) =>
      o.compartmentId === hole.compartmentId &&
      o.x === hole.x &&
      o.areaM2 === hole.areaM2 &&
      o.zLow === hole.zLow &&
      o.zHigh === hole.zHigh &&
      o.side === hole.side
  );
}
