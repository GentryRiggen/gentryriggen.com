import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
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
      if (info.isDry) parts.push("thirsty soil");
      return parts.join(" · ");
    }
    case "farm":
      return [
        `${CROP_LABELS[info.crop]} in ${plural(info.fields, "field")}`,
        ...(info.helpers > 0 ? [plural(info.helpers, "scarecrow")] : []),
        ...(info.townFed >= 0.8 ? ["the towns are happy"] : []),
        ...(info.isDry ? ["thirsty fields"] : []),
      ].join(" · ");
    case "world":
      return info.helpers > 0
        ? `The world, greening · ${plural(info.helpers, "windbreak")}`
        : "The world, with bare spots";
    default:
      return `One small pot · ${info.growth}% grown`;
  }
}

/** The label a screen reader gets for each phase's picture. */
export const SCENE_LABELS: Readonly<Record<GrowSceneInfo["phase"], string>> = {
  yard: "A backyard seen through a window, with garden beds, a fence and a window box on the sill",
  farm: "A farm with rows of crops in fields, a barn, and a town on the horizon",
  world: "A round globe with green patches spreading across it",
  seed: "One small pot with a shoot growing out of it",
};
