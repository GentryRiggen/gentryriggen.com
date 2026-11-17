/**
 * Log Stack rules: a simple, forgiving stacker with no physics. Positions are
 * percentages of the hearth's width. A dropped log keeps only the part that
 * rests on the log below (the overhang falls off), snaps when it is almost
 * dead on, and ends the round when it misses the tower completely.
 */

export interface Log {
  /** Left edge and width, in percent of the field. */
  left: number;
  width: number;
}

export const LOG_START_WIDTH = 42;
/** A log never gets thinner than this, so the tower stays playable. */
export const LOG_MIN_WIDTH = 14;
/** A drop this close to the log below lands exactly on it (no overhang). */
export const SNAP = 3;
export const MAX_LOGS = 12;

export type DropResult =
  | {
      kind: "land";
      log: Log;
      /** True when it snapped: no overhang at all. */
      perfect: boolean;
      /** The pieces that hung over and fall away. */
      cutOff: Log[];
    }
  | { kind: "miss" };

/** The base log, centred on the hearth. */
export function baseLog(): Log {
  return { left: (100 - LOG_START_WIDTH) / 2, width: LOG_START_WIDTH };
}

/** Where a dropped log lands on `below`. */
export function dropLog(below: Log, dropped: Log): DropResult {
  const left = Math.max(below.left, dropped.left);
  const right = Math.min(
    below.left + below.width,
    dropped.left + dropped.width
  );
  const overlap = right - left;
  if (overlap <= 0) return { kind: "miss" };
  if (Math.abs(dropped.left - below.left) <= SNAP) {
    return {
      kind: "land",
      log: { left: below.left, width: dropped.width },
      perfect: true,
      cutOff: [],
    };
  }
  const width = Math.max(LOG_MIN_WIDTH, overlap);
  const centre = left + overlap / 2;
  const kept: Log = {
    left: Math.min(100 - width, Math.max(0, centre - width / 2)),
    width,
  };
  const cutOff: Log[] = [];
  if (dropped.left < kept.left) {
    cutOff.push({ left: dropped.left, width: kept.left - dropped.left });
  }
  const droppedRight = dropped.left + dropped.width;
  const keptRight = kept.left + kept.width;
  if (droppedRight > keptRight) {
    cutOff.push({ left: keptRight, width: droppedRight - keptRight });
  }
  return { kind: "land", log: kept, perfect: false, cutOff };
}

/** How fast the swinging log moves (percent of the field per second). */
export function swingSpeed(logsStacked: number): number {
  return Math.min(70, 34 + logsStacked * 3);
}

/**
 * Moves a swinging log along the field and bounces it off both sides.
 * `x` is its left edge; `dir` is 1 (right) or -1 (left).
 */
export function swing(
  x: number,
  dir: 1 | -1,
  width: number,
  speed: number,
  seconds: number
): { x: number; dir: 1 | -1 } {
  const max = 100 - width;
  let nextX = x + dir * speed * seconds;
  let nextDir = dir;
  if (nextX > max) {
    nextX = max - (nextX - max);
    nextDir = -1;
  } else if (nextX < 0) {
    nextX = -nextX;
    nextDir = 1;
  }
  return { x: Math.min(max, Math.max(0, nextX)), dir: nextDir };
}
