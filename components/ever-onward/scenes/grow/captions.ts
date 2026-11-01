import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";

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
      return info.helpers > 0
        ? `Rows of green · ${info.helpers} scarecrows`
        : "A small field, waiting";
    case "world":
      return info.helpers > 0
        ? `The world, greening · ${info.helpers} windbreaks`
        : "The world, with bare spots";
    default:
      return `One small pot · ${info.growth}% grown`;
  }
}

/** The label a screen reader gets for each phase's picture. */
export const SCENE_LABELS: Readonly<Record<GrowSceneInfo["phase"], string>> = {
  yard: "A seed in a pot on a windowsill, with a window box beside it",
  farm: "A field of green rows under a wide sky",
  world: "A round globe with green patches spreading across it",
  seed: "One small pot with a shoot growing out of it",
};
