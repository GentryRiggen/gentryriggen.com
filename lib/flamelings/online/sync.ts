import { sameCard, cardOf } from "./card";
import { updateCard, type OnlineDeps } from "./client";
import type { Pet, PetCard } from "../types";

/** The rules allow a card write every 10 s; keep a margin for clock skew. */
export const MIN_SYNC_INTERVAL_MS = 11_000;

interface Sent {
  /** Null after a failed write, so the next change is sent again. */
  card: PetCard | null;
  at: number;
}

/**
 * Pushes a pet's card to its friends' view when it changes, never faster
 * than once per MIN_SYNC_INTERVAL_MS per code, and only for pets that have a
 * code (a player who never opened Friends sends nothing).
 */
export class CardSync {
  private sent = new Map<string, Sent>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private latest = new Map<string, PetCard>();

  constructor(
    private readonly deps: () => OnlineDeps = () => ({}),
    private readonly clock: () => number = Date.now
  ) {}

  /** Records that the card for `code` was just created with `card`. */
  created(code: string, card: PetCard): void {
    this.sent.set(code, { card, at: this.clock() });
  }

  /** Looks at every pet with a code and queues a write if its card changed. */
  observe(pets: readonly Pet[]): void {
    for (const pet of pets) {
      if (pet.online.code) this.schedule(pet.online.code, cardOf(pet));
    }
  }

  private schedule(code: string, card: PetCard): void {
    this.latest.set(code, card);
    const last = this.sent.get(code);
    if (last?.card && sameCard(last.card, card)) {
      this.clearTimer(code);
      return;
    }
    if (this.timers.has(code)) return;
    const wait = last
      ? Math.max(0, last.at + MIN_SYNC_INTERVAL_MS - this.clock())
      : 0;
    this.timers.set(
      code,
      setTimeout(() => void this.flush(code), wait)
    );
  }

  private clearTimer(code: string): void {
    const timer = this.timers.get(code);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(code);
  }

  private async flush(code: string): Promise<void> {
    this.timers.delete(code);
    const card = this.latest.get(code);
    if (!card) return;
    this.sent.set(code, { card, at: this.clock() });
    const result = await updateCard(code, card, this.deps());
    if (result === "ok") return;
    // Not delivered: try again at the next change, after the minimum wait.
    this.sent.set(code, { card: null, at: this.clock() });
  }

  /** Stops any waiting write (the page is going away). */
  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
