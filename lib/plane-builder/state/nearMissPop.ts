export interface NearMissPop {
  id: number;
  /** Combo multiplier, 1 and up. */
  multiplier: number;
  coins: number;
}

/** The words on the pop: "Close call!" and, from the second in a row, "×3". */
export function nearMissText(multiplier: number): string {
  return multiplier > 1 ? `Close call! ×${multiplier}` : "Close call!";
}

/**
 * The latest near miss for the flight HUD's pop. Like the toasts, the
 * component times it out; the store only holds it. Each push gets a new id.
 */
let current: NearMissPop | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const nearMissPop = {
  get: () => current,
  push(multiplier: number, coins: number) {
    current = { id: nextId, multiplier, coins };
    nextId += 1;
    notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function clearNearMissPop() {
  current = null;
  nearMissKick.remaining = 0;
  notify();
}

/** Seconds of camera lens kick left. FlightRunner arms it; ChaseCamera spends it. */
export const nearMissKick = { remaining: 0 };

export const KICK_SECONDS = 0.35;
