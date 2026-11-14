import { buildOccupancy } from "../model/grid";
import type { Ship } from "../model/types";
import { blastPiecesOf } from "./blast";
import { trialFunnelsOf } from "./trialFunnels";
import type { BombHit, TrialInput } from "./types";

/** Seconds a bomb falls between the tap and the bang. */
export const BOMB_FALL_S = 0.6;
/** Most bombs one Boom! trial takes; later taps do nothing. */
export const MAX_BOMBS = 40;
/** Cells either side of a bomb that parts may be blown off. */
export const BOMB_REACH = 2.5;
/** Most parts one bomb blows off. */
export const BOMB_MAX_THROWN = 10;
/** Most parts all the bombs of a trial blow off together (each one is drawn). */
export const MAX_THROWN_TOTAL = 160;

/** Where a bomb lands: on the ship (model frame) and in the world. */
export interface BombDrop {
  /** Sim seconds it goes off. */
  at: number;
  /** Cells from the bow. */
  impactX: number;
  /** Deck level of the spot it hit (below 0 on the hull's side). */
  level: number;
  /** Cells across the beam. */
  z: number;
  /** World position of the spot. */
  point: { x: number; y: number; z: number };
}

/** Every part a bomb at or before `at` has thrown. */
function thrownBy(bombs: readonly BombHit[], at: number): Set<string> {
  const gone = new Set<string>();
  for (const bomb of bombs) {
    if (bomb.at > at) continue;
    for (const id of bomb.thrown ?? []) gone.add(id);
  }
  return gone;
}

/**
 * The input with one more bomb: kept in time order, with the parts it blows
 * off (never one an earlier bomb took, nor `fallen`, a funnel that has already
 * snapped off), and her funnels less every one a bomb throws (those fly with
 * the blast, so they cannot also snap off in the sinking). A later bomb gives
 * up any part this one now takes. Unchanged if it is not a Boom! trial or it
 * already has `MAX_BOMBS`.
 */
export function withBomb(
  input: TrialInput,
  ship: Ship,
  drop: BombDrop,
  fallen: ReadonlySet<string> = new Set()
): TrialInput {
  const { boom } = input;
  if (!boom || boom.bombs.length >= MAX_BOMBS) return input;
  const gone = thrownBy(boom.bombs, drop.at);
  for (const id of fallen) gone.add(id);
  const total = boom.bombs.reduce((n, b) => n + (b.thrown?.length ?? 0), 0);
  const room = Math.max(0, Math.min(BOMB_MAX_THROWN, MAX_THROWN_TOTAL - total));
  const left: Ship = {
    ...ship,
    parts: ship.parts.filter((part) => !gone.has(part.id)),
  };
  const thrown =
    room === 0
      ? []
      : blastPiecesOf(left, drop.impactX, buildOccupancy(left), {
          reach: BOMB_REACH,
          max: room,
          near: { level: drop.level, z: drop.z },
        }).map((piece) => piece.partId);
  const taken = new Set(thrown);
  const bomb: BombHit = {
    at: drop.at,
    impactX: drop.impactX,
    point: drop.point,
    thrown,
  };
  const bombs = [
    ...boom.bombs
      .filter((b) => b.at <= drop.at)
      .concat(bomb)
      .concat(
        boom.bombs
          .filter((b) => b.at > drop.at)
          .map((b) => ({
            ...b,
            thrown: (b.thrown ?? []).filter((id) => !taken.has(id)),
          }))
      ),
  ];
  const allThrown = thrownBy(bombs, Infinity);
  return {
    ...input,
    funnels: trialFunnelsOf(ship).filter((f) => !allThrown.has(f.id)),
    boom: { ...boom, bombs },
  };
}

/** The parts the bombs have blown off by `time` (sim seconds). */
export function thrownByTime(input: TrialInput, time: number): Set<string> {
  return thrownBy(input.boom?.bombs ?? [], time);
}
