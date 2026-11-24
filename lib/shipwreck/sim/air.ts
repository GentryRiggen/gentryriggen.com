import { AIR_DENSITY, CD_OPENING, GRAV, P_ATM } from "./constants";
import type { Cell } from "./flooding";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { sqrt } = Math;

/**
 * Trapped air (`ShipSpec.trappedAir`, sim README "Trapped air"): physics.
 *
 * A space whose air touches no opening above the sea is sealed: its air
 * (a mass in atmosphere·m³, the volume it would fill at the sea's surface)
 * is squeezed by the water coming in, isothermally (Boyle: p·V = const),
 * and its pressure holds the water below the sea's level. The air leaves
 * only through openings under the sea where its pressure beats the sea's
 * (the orifice law for a gas) and through her stated leaks; it never comes
 * back in under water. Everything here is pure and allocation-free.
 */

/**
 * The gauge head (m of the water she floats in) of `massAtmM3` of air in
 * `volM3`: h = p_atm/(ρg)·(m/V − 1). 0 at the sea's pressure; negative
 * (below the atmosphere's) when the pocket has grown past its air.
 */
export function airHeadM(
  massAtmM3: number,
  volM3: number,
  rho: number
): number {
  return (P_ATM / (rho * GRAV)) * (massAtmM3 / volM3 - 1);
}

/**
 * Air out through an opening (atmosphere·m³/s): the orifice law for a gas,
 * Q = Cd·A·√(2·Δp/ρ_air), with ρ_air the pocket's density at its absolute
 * pressure `pAbsPa` (isothermal: ρ_air = ρ_0·p/p_atm), counted back to the
 * atmosphere (·p/p_atm). Incompressible: past a pressure ratio of about
 * 0.53 the real flow chokes, which this does not model (README, limits).
 * 0 when the air's pressure does not beat the outside's (`dpPa` ≤ 0).
 */
export function gasOutflow(
  areaM2: number,
  dpPa: number,
  pAbsPa: number
): number {
  if (!(dpPa > 0) || !(areaM2 > 0) || !(pAbsPa > 0)) return 0;
  const rhoAir = (AIR_DENSITY * pAbsPa) / P_ATM;
  return CD_OPENING * areaM2 * sqrt((2 * dpPa) / rhoAir) * (pAbsPa / P_ATM);
}

/**
 * The two vertices of section `i` of a cell where it floods over its edge
 * (`side` 0 and 1), as indices into the slice's `ys`/`zs`. A hull cell's
 * deck edge (port top nv/2 − 1, starboard top nv/2). A box with trapped
 * air: its lowest edge at the pose (the two lowest of its four corners:
 * upright its lower corners, keel up its roof's edges, on its side the wall
 * underneath). Any other box: its ship-frame lower corners (1.0).
 */
export function edgeVertex(
  c: Cell,
  i: number,
  side: number,
  ny: number,
  nz: number,
  trapped: boolean
): number {
  const s = c.slice;
  const nv = s.nv;
  const base = i * nv;
  if (!c.box) return base + (side === 0 ? nv / 2 - 1 : nv / 2);
  if (!trapped) return base + (side === 0 ? 0 : nv - 1);
  // The lowest and the next lowest corner (ties: the first).
  let lo = -1;
  let lo2 = -1;
  let zLo = Infinity;
  let zLo2 = Infinity;
  for (let k = 0; k < nv; k += 1) {
    const z = ny * s.ys[base + k] + nz * s.zs[base + k];
    if (z < zLo) {
      lo2 = lo;
      zLo2 = zLo;
      lo = k;
      zLo = z;
    } else if (z < zLo2) {
      lo2 = k;
      zLo2 = z;
    }
  }
  // Port side first, as the 1.0 corners (0 is the port one).
  const a = lo < lo2 ? lo : lo2;
  const b = lo < lo2 ? lo2 : lo;
  return base + (side === 0 ? a : b);
}

/** Is the section's edge a flood path (a wing takes none; 1.0)? */
export function edgeFloods(c: Cell): boolean {
  const span = c.slice.span;
  return span === undefined || span.side === "centre";
}

/**
 * Is the cell's air sealed at the pose (earth z = z0 + n·p)? Sealed unless
 * some way out of it touches its air (above its water's surface) and is
 * above the sea: an opening's strip, its deck edge or lower edge, an open
 * deck opening. An empty cell's air touches all of them; so, for a full
 * one, does the air that would come in as its water left (a full space
 * with a way out above the sea drains as before; one with every way out
 * under the sea holds its water, an upturned glass).
 */
export function cellSealed(
  c: Cell,
  nx: number,
  ny: number,
  nz: number,
  z0: number
): boolean {
  const surface = c.water > 0 && c.water < c.cap ? c.level : -Infinity;
  const top = surface > 0 ? surface : 0;
  for (const o of c.openings) {
    for (let k = 0; k < 4; k += 1) {
      const z = o.zLow + ((o.zHigh - o.zLow) * (k + 0.5)) / 4;
      if (z0 + nx * o.x + ny * o.y + nz * z > top) return false;
    }
  }
  for (const d of c.deck)
    if (d.area > 0 && z0 + nx * d.x + ny * d.y + nz * d.z > top) return false;
  if (!edgeFloods(c)) return true;
  const s = c.slice;
  const edge = s.span && s.span.side === "centre" ? s.edgeHb : undefined;
  for (let i = 0; i < s.n; i += 1) {
    if (s.fullA[i] <= 0) continue;
    const base = z0 + nx * s.xs[i];
    for (let side = 0; side < 2; side += 1) {
      const v = edgeVertex(c, i, side, ny, nz, true);
      const y = edge ? (side === 0 ? edge[i] : -edge[i]) : s.ys[v];
      if (base + ny * y + nz * s.zs[v] > top) return false;
    }
  }
  return true;
}
