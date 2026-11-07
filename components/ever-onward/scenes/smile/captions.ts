import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile";

const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

const PRICE_NAMES = ["free", "cheap", "fair", "dear", "pricey"] as const;

/** The town's headline: the day first, then the stand. */
function townLine(info: SmileSceneInfo): string {
  if (info.price < 0) return "The town, out on the street";
  const day = info.day.startsWith("rain")
    ? "Rain on a street"
    : info.day.startsWith("party")
      ? "A street party"
      : info.day === "hot"
        ? "A hot day"
        : "The town, out on the street";
  return `${day} · lemonade is ${PRICE_NAMES[info.price]}`;
}

/** The one line that says what the picture is showing. */
export function captionFor(info: SmileSceneInfo): string {
  switch (info.phase) {
    case "friend":
      return [
        info.face === "frown" && info.a === 0 && info.b === 0
          ? "One sad friend on a step"
          : "A friend on a step, a little less sad",
        ...(info.a > 0 ? [plural(info.a, "balloon bunch")] : []),
        ...(info.b > 0 ? [plural(info.b, "puppy")] : []),
        ...(info.hint >= 0
          ? [
              ["telling jokes", "playing a game", "listening"][info.doing],
              ...(info.lit ? ["they lit up"] : []),
              ...(info.sigh ? ["a little sigh"] : []),
            ]
          : []),
      ].join(" · ");
    case "town":
      return [
        townLine(info),
        ...(info.a > 0 ? [plural(info.a, "clown")] : []),
        ...(info.c > 0 ? [plural(info.c, "smile factory")] : []),
        ...(info.moods.includes("0") ? ["a street is grumpy"] : []),
      ].join(" · ");
    case "world":
      return [
        info.parade
          ? "The cheer broadcast is on"
          : "Smiling posters everywhere",
        ...(info.a > 0 ? [plural(info.a, "poster")] : []),
        ...(info.b > 0 ? [plural(info.b, "loudspeaker")] : []),
        ...(info.real <= 4
          ? ["most smiles are painted on"]
          : info.real <= 8
            ? ["some smiles are painted on"]
            : []),
      ].join(" · ");
    default:
      return info.visitorHere
        ? "One small, real smile"
        : `Two on a bench · ${info.trust}% trust${info.wanting ? " · the friend wants something" : ""}`;
  }
}

/** The label a screen reader gets for the picture, from what it draws. */
export function sceneLabelFor(info: SmileSceneInfo): string {
  switch (info.phase) {
    case "friend":
      return "A robot sitting on a step beside a sad friend, with balloons, a puppy and a lemonade stand";
    case "town":
      return "A town street with a lemonade stand, parade floats on four streets, clowns, a band and a smile factory";
    case "world":
      return "A street covered with smiling posters and loudspeakers, and a crowd of smiling faces";
    default:
      return [
        "A robot and a friend on a bench at dusk",
        info.visitorHere ? ", and the friend is smiling" : "",
      ].join("");
  }
}
