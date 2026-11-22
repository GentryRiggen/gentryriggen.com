import { QUALITY_TIERS, type PlaybackStore } from "@/lib/shipwreck/playback";

/**
 * The frame-rate monitor's steps between quality tiers. A step down is
 * ignored while the sim runner is still computing the run in the browser
 * (it shares the frame: her storm takes three times the Titanic's night),
 * so that start-up cost never locks a touch device (which never steps
 * back up) at a lower tier for the whole run.
 */
export function stepQuality(store: PlaybackStore, by: 1 | -1): void {
  const s = store.getState();
  if (by > 0 && !s.done) return;
  const i = QUALITY_TIERS.indexOf(s.quality);
  const next = QUALITY_TIERS[Math.max(0, Math.min(2, i + by))];
  if (next !== s.quality) s.setQuality(next);
}
