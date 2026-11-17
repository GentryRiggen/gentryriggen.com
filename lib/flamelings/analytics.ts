import { trackGame } from "@/lib/analytics/trackGame";
import { parseUnlockKey } from "./catalog";
import { visitWindow } from "./progress";
import type { PetEvent, PlayGame } from "./types";

/**
 * Anonymous stats for the dashboard. Only closed enums and small whole
 * numbers ever leave the device: never a pet's name or anything typed.
 */

export function trackVisit(pets: number, nowMs: number): void {
  trackGame("fl_visit", {
    window: visitWindow(nowMs),
    pets: Math.max(0, Math.min(8, Math.floor(pets))),
  });
}

export function trackHatch(): void {
  trackGame("fl_hatch", {});
}

export function trackPlayEnd(game: PlayGame, score: number): void {
  trackGame("fl_play_end", {
    game,
    score: Math.max(0, Math.min(99, Math.floor(score))),
  });
}

/** Reports what an action or a stretch of time did. */
export function trackEvents(events: readonly PetEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case "care":
        trackGame("fl_care", { action: event.action });
        break;
      case "levelUp":
        trackGame("fl_level", {
          level: Math.max(2, Math.min(99, event.level)),
          stage: event.stage,
        });
        break;
      case "state":
        trackGame("fl_state", { to: event.to });
        break;
      case "unlock": {
        const parsed = parseUnlockKey(event.key);
        if (parsed && parsed.kind !== "decor") {
          trackGame("fl_unlock", { kind: parsed.kind, via: event.via });
        }
        break;
      }
      case "buy": {
        const parsed = parseUnlockKey(event.key);
        if (
          parsed &&
          (parsed.kind === "hat" ||
            parsed.kind === "face" ||
            parsed.kind === "neck" ||
            parsed.kind === "decor")
        ) {
          trackGame("fl_buy", {
            kind: parsed.kind,
            price: Math.max(
              0,
              Math.min(1000, Math.floor(event.price / 10) * 10)
            ),
          });
        }
        break;
      }
      case "happening":
        trackGame("fl_happening", {
          kind: event.kind,
          done: event.done ? 1 : 0,
        });
        break;
      case "evolve":
        trackGame("fl_form", { form: event.form });
        break;
      default:
        break;
    }
  }
}
