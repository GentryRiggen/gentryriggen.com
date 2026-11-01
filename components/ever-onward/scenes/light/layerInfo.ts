import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";

/**
 * Numbers only the caption reads, or that the layers see in a quantized form
 * (`townsLit`, `starsFraction`, `probes`). They change every tick, so the
 * heavy layers must not re-render for them.
 */
export const CAPTION_ONLY: ReadonlySet<string> = new Set([
  "ships",
  "starsRemaining",
  "cities",
  "citiesProgress",
  "lightsRemaining",
  "lightsFraction",
  "coastProgress",
]);

/** True when a layer would draw the same picture from both infos. */
export const isSameLayerInfo = (
  a: { info: LightSceneInfo },
  b: { info: LightSceneInfo }
): boolean =>
  (Object.keys(a.info) as (keyof LightSceneInfo)[]).every(
    (k) => CAPTION_ONLY.has(k) || a.info[k] === b.info[k]
  );
