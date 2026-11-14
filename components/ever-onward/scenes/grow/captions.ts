import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import { BIOMES, BIOME_LABELS } from "@/lib/ever-onward/universes/grow/biomes";
import { CROP_LABELS } from "@/lib/ever-onward/universes/grow/market";
import {
  LEAF_WORDS,
  SKY_WORDS,
} from "@/lib/ever-onward/universes/grow/windowbox";

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
        info.cropStage > 0
          ? `${CROP_LABELS[info.crop]} growing in ${plural(info.fields, "field")}`
          : `${plural(info.fields, "empty field")}, waiting to be planted`,
        ...(info.helpers > 0 ? [plural(info.helpers, "scarecrow")] : []),
        ...(info.townFed >= 0.8 ? ["the towns are happy"] : []),
        ...(info.dry ? ["thirsty fields"] : []),
      ].join(" · ");
    case "world": {
      const percent = Math.round(info.greenFraction * 100);
      const rot = info.blight.split("|").map(Number);
      const sick = BIOMES.find((_, i) => (rot[i] ?? 0) >= 1);
      return [
        sick
          ? `Blight in the ${BIOME_LABELS[sick].toLowerCase()} · the world is ${percent}% green`
          : info.healed
            ? `Healed · the world is ${percent}% green`
            : percent > 0
              ? `The world is ${percent}% green`
              : "The world, with bare spots",
        ...(info.helpers > 0 ? [plural(info.helpers, "windbreak")] : []),
        ...(info.dry ? ["thirsty land"] : []),
      ].join(" · ");
    }
    default:
      return info.visitorHere
        ? "Someone came back to see the pot"
        : `One small pot · ${info.growth}% grown · ${SKY_WORDS[info.sky].toLowerCase()} · leaves: ${LEAF_WORDS[info.leaf].toLowerCase()}`;
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
        `A window with ${SKY_WORDS[info.sky].toLowerCase()} weather outside`,
        " with a small pot on the sill",
        info.windowLit ? ", a light left on" : "",
        info.visitorHere ? ", and someone who came back to see it" : "",
      ].join("");
  }
}
