import { PART_SPECS } from "./partSpecs";

export const STUDIO_TIMES = ["Day", "Sunset", "Night"] as const;
export type StudioTime = (typeof STUDIO_TIMES)[number];

export interface StudioParams {
  part: string;
  variant: string;
  build: "old" | "new";
  view: string;
  time: StudioTime;
}

/** Reads `?part=&variant=&build=&view=&time=`; an unknown value is an error. */
export function parseStudioParams(
  search: string
): StudioParams | { error: string } {
  const query = new URLSearchParams(search);
  const part = query.get("part") ?? "";
  const spec = Object.hasOwn(PART_SPECS, part) ? PART_SPECS[part] : undefined;
  if (!spec) return { error: `Unknown part "${part}"` };

  const variant = query.get("variant") ?? spec.scoreVariant;
  if (!spec.variants.some((v) => v.name === variant)) {
    return { error: `Unknown variant "${variant}" for ${part}` };
  }
  const view = query.get("view") ?? "";
  if (!spec.views.some((v) => v.name === view)) {
    return { error: `Unknown view "${view}" for ${part}` };
  }
  const build = query.get("build") ?? "";
  if (build !== "old" && build !== "new") {
    return { error: `Unknown build "${build}" (old or new)` };
  }
  const time = query.get("time") ?? "Day";
  if (!(STUDIO_TIMES as readonly string[]).includes(time)) {
    return { error: `Unknown time "${time}"` };
  }
  return { part, variant, build, view, time: time as StudioTime };
}
