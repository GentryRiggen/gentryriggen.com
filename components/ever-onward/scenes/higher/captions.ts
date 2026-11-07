import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";

/** "2 teddies", "1 mason": a count with its word. */
const count = (n: number, word: string, many = `${word}s`): string =>
  `${n} ${n === 1 ? word : many}`;

const PACE_WORDS = [
  "building carefully",
  "building",
  "building quickly",
  "rushing",
];

/** The one line that says what the picture is showing. */
export function captionFor(info: HigherSceneInfo): string {
  const own = info.own;
  const lean =
    info.lean >= 3 ? ["wobbling"] : info.lean >= 2 ? ["leaning"] : [];
  switch (info.phase) {
    case "playroom":
      return [
        `A tower of ${3 + info.height} blocks`,
        ...(own.bear ? [count(own.bear, "teddy", "teddies")] : []),
        ...(info.pace !== 1 ? [PACE_WORDS[info.pace]] : []),
        ...(info.streak >= 3 ? [`${info.streak} in a row`] : []),
        ...(info.toddler === 2 ? ["toddler stomping"] : []),
        ...lean,
      ].join(" · ");
    case "town":
      return [
        `A tower of ${4 + info.height * 2} floors`,
        ...(own.mason ? [count(own.mason, "mason")] : []),
        ...lean,
      ].join(" · ");
    case "sky":
      return [
        "Above the clouds",
        ...(own["sky-crew"] ? [count(own["sky-crew"], "crew")] : []),
        ...lean,
      ].join(" · ");
    default:
      return info.visitorHere
        ? "A kid on the grass, with a block"
        : `On the way down · ${info.descent * 5}%`;
  }
}

/** The label a screen reader gets for the picture, from what it draws. */
export function sceneLabelFor(info: HigherSceneInfo): string {
  switch (info.phase) {
    case "playroom":
      return "A playroom with a rug, a tall tower of wooden blocks and toy helpers";
    case "town":
      return "A town square with a tall tower, cranes, scaffolding and a cheering crowd";
    case "sky":
      return "A tower rising out of the clouds, with a small town far below in its shadow";
    default:
      return info.visitorHere
        ? "A small robot on the grass, building a tiny tower with a kid"
        : "A small robot carrying one block down a long staircase";
  }
}
