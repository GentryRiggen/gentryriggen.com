/** How long a part must be held before it is deleted. */
export const LONG_PRESS_MS = 600;

/**
 * Pointer travel (in CSS pixels) that turns a hold into an orbit
 * drag and cancels it.
 */
export const MOVE_CANCEL_PX = 8;

export type PressEnd = "idle" | "cancelled" | "fired";

export interface LongPressOptions {
  onFire: (partId: string) => void;
  /** A started press stopped before firing; hide its feedback. */
  onCancel: () => void;
}

export interface LongPress {
  /** Every pointerdown, so a second finger can cancel a hold. */
  pointerDown(pointerId: number, isPrimary: boolean): void;
  /**
   * A press on a part. Returns false (and does nothing) while another pointer
   * is down, since two fingers mean a pinch or pan.
   */
  start(partId: string, pointerId: number, x: number, y: number): boolean;
  move(pointerId: number, x: number, y: number): void;
  /** pointerup: whether the press, if any, fired or was cut short. */
  end(pointerId: number): PressEnd;
  /** pointercancel. */
  cancel(pointerId: number): void;
  /** Stops any pending press without calling back. */
  dispose(): void;
}

interface ActivePress {
  partId: string;
  pointerId: number;
  x: number;
  y: number;
  fired: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * The press-and-hold state machine. It has no DOM or React dependencies: the
 * caller feeds it pointer events and it calls back when a hold fires.
 */
export function createLongPress({
  onFire,
  onCancel,
}: LongPressOptions): LongPress {
  const down = new Set<number>();
  let active: ActivePress | null = null;

  function clear(): ActivePress | null {
    const previous = active;
    if (previous?.timer) clearTimeout(previous.timer);
    active = null;
    return previous;
  }

  function abort(): void {
    const previous = clear();
    if (previous && !previous.fired) onCancel();
  }

  return {
    pointerDown(pointerId, isPrimary) {
      // A primary pointer means no other pointer of its kind is down, so any
      // ids left over from lost pointerups are stale.
      if (isPrimary) down.clear();
      down.add(pointerId);
      if (active && active.pointerId !== pointerId) abort();
    },

    start(partId, pointerId, x, y) {
      for (const id of down) {
        if (id !== pointerId) return false;
      }
      clear();
      const press: ActivePress = {
        partId,
        pointerId,
        x,
        y,
        fired: false,
        timer: null,
      };
      press.timer = setTimeout(() => {
        press.fired = true;
        press.timer = null;
        onFire(partId);
      }, LONG_PRESS_MS);
      active = press;
      return true;
    },

    move(pointerId, x, y) {
      if (!active || active.fired || active.pointerId !== pointerId) return;
      const distance = Math.hypot(x - active.x, y - active.y);
      if (distance > MOVE_CANCEL_PX) abort();
    },

    end(pointerId) {
      down.delete(pointerId);
      if (!active || active.pointerId !== pointerId) return "idle";
      if (active.fired) {
        clear();
        return "fired";
      }
      abort();
      return "cancelled";
    },

    cancel(pointerId) {
      down.delete(pointerId);
      if (active?.pointerId === pointerId) abort();
    },

    dispose() {
      clear();
      down.clear();
    },
  };
}
