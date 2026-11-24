import type { Opening, ShipSpec, StormSpec, WaveGroup } from "../ships/types";
import { GRAV } from "./constants";

export { CAPSIZED_DEG } from "./constants";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { max, sqrt } = Math;

/**
 * The rogue wave (`ShipSpec.wave`, the Poseidon): a rule, not physics, for
 * her roll. Its group joins her storm (`stormOf`); from its time her roll
 * eases (smoothstep, no kick at either end) from where it is to the
 * rule's peak over `rollS` real seconds, while heave, pitch, flooding,
 * trapped air and the girder are physics around it; then it lets go with
 * her roll rate zeroed and physics owns her roll (sim README, "The wave").
 * The What-if variants: the real wave, a smaller one (its own height and
 * peak) and one from ahead (no rule: she rides over it).
 */

export type WaveVariant = "real" | "smaller" | "ahead";

const TWO_PI = 2 * Math.PI;
const FWHM_SIGMAS = 2 * sqrt(2 * Math.LN2);
/** Envelope widths past which a group adds nothing (as `waves.ts`). */
const GROUP_CUTOFF = 8;

/** The wave group of a variant as it joins her storm. */
export function waveGroupOf(spec: ShipSpec, variant: WaveVariant): WaveGroup {
  const wave = spec.wave as NonNullable<ShipSpec["wave"]>;
  const g = wave.group;
  if (variant === "ahead") {
    // In her ride: she pitches up and over it (kinematic, as the
    // Fitzgerald's seas).
    const ahead: WaveGroup = { ...g, dirDeg: wave.ahead.dirDeg };
    delete ahead.ride;
    return ahead;
  }
  if (variant === "smaller")
    return { ...g, heightM: wave.smaller.heightM, ride: false };
  return { ...g, ride: false };
}

/** Her storm with the wave's group appended (a wave ship), as given. */
export function withWave(
  storm: StormSpec | undefined,
  spec: ShipSpec,
  variant: WaveVariant
): StormSpec | undefined {
  if (!spec.wave) return storm;
  const g = waveGroupOf(spec, variant);
  if (!storm) return { components: [], hsM: 0, groups: [g], windKn: 0 };
  return { ...storm, groups: [...(storm.groups ?? []), g] };
}

/** The rule's peak (degrees) for a variant; null: no rule (from ahead). */
export function rulePeakDeg(
  spec: ShipSpec,
  variant: WaveVariant
): number | null {
  const wave = spec.wave;
  if (!wave || variant === "ahead") return null;
  return variant === "smaller" ? wave.smaller.peakDeg : wave.peakDeg;
}

/** Smoothstep on [0, 1]: 3u² − 2u³ (zero slope at both ends). */
export function smoothstep(u: number): number {
  const v = u <= 0 ? 0 : u >= 1 ? 1 : u;
  return v * v * (3 - 2 * v);
}

/** Its slope (per unit u). */
function smoothstepRate(u: number): number {
  return u <= 0 || u >= 1 ? 0 : 6 * u * (1 - u);
}

/**
 * The rule's roll (rad) and rate (rad/s) at real time t, from `roll0` at
 * `t0` to `peak` (rad) over `rollS`; writes [roll, rate] into out.
 */
export function ruleRoll(
  roll0: number,
  peak: number,
  t0: number,
  rollS: number,
  t: number,
  out: [number, number]
): [number, number] {
  const u = (t - t0) / rollS;
  out[0] = roll0 + (peak - roll0) * smoothstep(u);
  out[1] = ((peak - roll0) * smoothstepRate(u)) / rollS;
  return out;
}

/** The storm's group left out of her ride (her rogue wave), or null. */
export function rogueGroup(
  storm: StormSpec | null | undefined
): WaveGroup | null {
  const groups = storm?.groups;
  if (!groups) return null;
  for (let i = 0; i < groups.length; i += 1)
    if (groups[i].ride === false) return groups[i];
  return null;
}

/**
 * When the wave reaches her (real s): its group's time as locked on her
 * (`lockGroups`), never before the first event (the sim starts there).
 */
export function waveStartT(g: WaveGroup): number {
  return max(0, g.t);
}

/**
 * The share of the swell's ride she keeps at real time t (`waveRide`'s
 * component weight): 1 before her rogue wave, easing to 0 over `rollS`
 * from it (her ride is for a ship right way up; the rule owns her roll),
 * 0 after. 1 for any ship without one, and from ahead (the group is in
 * her ride). The sim and the scene both call this.
 */
export function swellFade(
  spec: ShipSpec,
  storm: StormSpec | null | undefined,
  t: number
): number {
  const wave = spec.wave;
  if (!wave) return 1;
  const g = rogueGroup(storm);
  if (!g) return 1;
  return 1 - smoothstep((t - waveStartT(g)) / wave.rollS);
}

/**
 * Has the group passed her by real time t? Its envelope is GROUP_CUTOFF
 * widths past her (at its group speed g/2ω), as `waves.ts` cuts it off.
 */
export function groupPassed(g: WaveGroup, t: number): boolean {
  const w = TWO_PI / g.periodS;
  const k = (w * w) / GRAV;
  const len = (g.count * (TWO_PI / k)) / FWHM_SIGMAS;
  return t > g.t + (GROUP_CUTOFF * len) / (GRAV / (2 * w));
}

/** The What-if spots of a wave ship: `wave.spots`, aft to forward. */
export function waveSpots(spec: ShipSpec): string[] {
  return (spec.wave?.spots ?? []).map((s) => s.id);
}

/**
 * The openings of the chosen spots, in spot order: the same for the real
 * and the smaller wave; from ahead only the `fwd` spots' (it breaks over
 * her bow).
 */
export function waveOpenings(
  spec: ShipSpec,
  ids: readonly string[],
  variant: WaveVariant = "real"
): Opening[] {
  const chosen = new Set(ids);
  const out: Opening[] = [];
  for (const s of spec.wave?.spots ?? [])
    if (chosen.has(s.id) && (variant !== "ahead" || s.fwd))
      out.push(...s.openings);
  return out;
}
