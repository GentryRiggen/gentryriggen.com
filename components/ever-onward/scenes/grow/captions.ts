import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import { BIOME_LABELS } from "@/lib/ever-onward/universes/grow/biomes";
import { CROP_LABELS } from "@/lib/ever-onward/universes/grow/market";

const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

/** The one line that says what the picture is showing. */
export function captionFor(info: GrowSceneInfo): string {
  switch (info.phase) {
    case "yard": {
      const season = info.season[0].toUpperCase() + info.season.slice(1);
      const parts = [`${season} in the yard`, plural(info.beds, "bed")];
      if (info.bees > 0) parts.push(plural(info.bees, "hive"));
      if (info.dry) parts.push("thirsty soil");
      return parts.join(" · ");
    }
    case "farm":
      return [
        `${CROP_LABELS[info.crop]} in ${plural(info.fields, "field")}`,
        ...(info.helpers > 0 ? [plural(info.helpers, "scarecrow")] : []),
        ...(info.townFed >= 0.8 ? ["the towns are happy"] : []),
        ...(info.dry ? ["thirsty fields"] : []),
      ].join(" · ");
    case "world": {
      const percent = Math.round(info.greenFraction * 100);
      return [
        percent > 0
          ? `${BIOME_LABELS[info.biome]} spreading · the world is ${percent}% green`
          : "The world, with bare spots",
        ...(info.helpers > 0 ? [plural(info.helpers, "windbreak")] : []),
        ...(info.dry ? ["thirsty land"] : []),
      ].join(" · ");
    }
    default:
      return `One small pot · ${info.growth}% grown`;
  }
}

/** The label a screen reader gets for each phase's picture. */
export const SCENE_LABELS: Readonly<Record<GrowSceneInfo["phase"], string>> = {
  yard: "A backyard garden with raised beds, a fence, a greenhouse and bees",
  farm: "A farm with rows of crops in fields, a barn, and a town on the horizon",
  world:
    "A round globe seen from far away, with green spreading across it as the old roads and towns turn to meadow and woods",
  seed: "One small pot with a shoot growing out of it",
};
