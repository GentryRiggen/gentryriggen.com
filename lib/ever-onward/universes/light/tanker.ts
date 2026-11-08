import type { RunState } from "../../engine/types";
import { drawHarbor } from "./toll";
import { TUNING } from "./tuning";

/**
 * Oil tankers: the coast's market you time. The oil price drifts all the
 * time (see `driftOilPrice` in tick.ts). Now and then a tanker ties up at
 * the quay and sells cheap oil for a while, and then sails on. Fill the
 * tanks while it is in and the lamp burns cheap for a long time; miss it and
 * you buy at the market, or run dry and the harbor goes dark.
 *
 * The visits come from the harbor world's own random stream, so nothing the
 * player does moves them.
 */

const T = TUNING.coast.tanker;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;

/** True while a tanker is tied up (a save from before them has none). */
export const isTankerIn = (run: RunState): boolean =>
  run.phase === 0 && res(run, "tkLeft") > 0;

/** Seconds until the tanker sails on (0 when none is in). */
export const tankerSecondsLeft = (run: RunState): number =>
  isTankerIn(run) ? res(run, "tkLeft") : 0;

/** What the tanker sells at, as a share of the market price (1 when none is in). */
export const tankerDeal = (run: RunState): number =>
  isTankerIn(run) ? res(run, "tkDeal") : 1;

/** Tankers that have come so far. */
export const tankerVisits = (run: RunState): number => res(run, "tkVisits");

/** Oil bought while a tanker was in, in barrels, and the times lamps went dark. */
export const tankerBuys = (run: RunState): number => res(run, "tkBuys");
export const darkSpells = (run: RunState): number => res(run, "lampDarks");

/** Seconds the barrels keep rolling into the tanks after a buy. */
export const barrelsRolling = (run: RunState): boolean =>
  res(run, "barrelLeft") > 0;

/** The lamp is out of oil. */
export const isLampDark = (run: RunState): boolean =>
  run.phase === 0 && res(run, "oil") <= 0;

/** "DARK!" shows for the first few seconds of a dry spell. */
export const isDarkBanner = (run: RunState): boolean =>
  isLampDark(run) && res(run, "lampDarkFor") <= T.darkBannerSeconds;

/** The beam bursts for a few seconds after the lamp is lit again. */
export const isRelit = (run: RunState): boolean => res(run, "lampRelit") > 0;

/**
 * Starts the barrels rolling (a buy calls this), and the beam bursting if the
 * lamp was dark when the oil came (`wasDark`, read before the oil is added).
 */
export function noteBuy(run: RunState, wasDark: boolean): void {
  run.resources.barrelLeft = T.barrelSeconds;
  if (wasDark) {
    run.resources.lampDarkFor = 0;
    run.resources.lampRelit = T.relitSeconds;
  }
  if (isTankerIn(run)) run.resources.tkBuys = tankerBuys(run) + 1;
}

/**
 * Runs the tankers and the lamp's moments for `dt` seconds. The first tanker
 * comes `firstSeconds` after the keepers light the lamp panel.
 */
export function tickTanker(run: RunState, dt: number, isOpen: boolean): void {
  const r = run.resources;
  r.barrelLeft = Math.max(0, res(run, "barrelLeft") - dt);
  r.lampRelit = Math.max(0, res(run, "lampRelit") - dt);
  // The lamp running dry, and being lit again.
  if (r.oil <= 0) {
    if (res(run, "lampDarkFor") <= 0) r.lampDarks = darkSpells(run) + 1;
    r.lampDarkFor = Math.max(res(run, "lampDarkFor"), 0) + dt;
  } else if (res(run, "lampDarkFor") > 0) {
    r.lampDarkFor = 0;
    r.lampRelit = T.relitSeconds;
  }
  if (!isOpen) return;
  if (r.tkLeft > 0) {
    r.tkLeft = Math.max(0, r.tkLeft - dt);
    return;
  }
  if (!(r.tkCooldown > 0)) r.tkCooldown = T.firstSeconds;
  r.tkCooldown -= dt;
  if (r.tkCooldown > 0) return;
  r.tkLeft = T.staySeconds;
  r.tkDeal = T.dealMin + drawHarbor(run) * (T.dealMax - T.dealMin);
  r.tkVisits = tankerVisits(run) + 1;
  r.tkCooldown = T.gapMin + drawHarbor(run) * T.gapSpread;
}

/** The running log's line for a tanker (read when the count rises). */
export const tankerLine = (run: RunState): string | null =>
  isTankerIn(run)
    ? `A tanker is in with cheap oil, ${Math.round((1 - tankerDeal(run)) * 100)}% off. It sails on soon.`
    : null;

/**
 * A big moment is on in the picture (a tanker at the quay, the lamp dark or
 * just lit again), so pop-ups over the scene wait.
 */
export const isCoastMomentBusy = (run: RunState): boolean =>
  run.phase === 0 && (isTankerIn(run) || isLampDark(run) || isRelit(run));
