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
      return info.visitorHere
        ? "Someone came back to see the pot"
        : `One small pot · ${info.growth}% grown${info.windowLit ? " · the light is on" : ""}`;
  }
}

/** The label a screen reader gets for the picture, from what it draws. */
export function sceneLabelFor(info: GrowSceneInfo): string {
  switch (info.phase) {
    case "yard": {
      const extras = [
        ...(info.orchard ? ["an orchard"] : []),
        ...(info.greenhouse ? ["a greenhouse"] : []),
        ...(info.bees > 0 ? ["bees"] : []),
      ];
      return [
        "A backyard garden with raised beds and a fence",
        ...(extras.length > 0 ? [` and ${extras.join(", ")}`] : []),
      ].join("");
    }
    case "farm":
      return "A farm with rows of crops in fields, a barn, and a town on the horizon";
    case "world":
      return "A round globe seen from far away, with green spreading across it, with meadows and woods";
    default:
      return [
        info.isNight ? "A window at night" : "A window at dusk",
        " with a small pot on the sill",
        info.windowLit ? ", a light left on" : "",
        info.visitorHere ? ", and someone who came back to see it" : "",
      ].join("");
  }
}
