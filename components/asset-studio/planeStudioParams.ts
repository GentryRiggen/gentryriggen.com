import { PLANE_UNITS } from "@/components/plane-builder/scene/planeGlbRegistry";
import { DEFAULT_VIEW, STUDIO_TIMES } from "./studioParams";
import { PART_SPECS } from "./partSpecs";

export interface PlaneStudioParams {
  game: "plane";
  /** The spec id (`plane-wing`). */
  part: string;
  /** The unit drawn (`wing-straight`): the spec variant and the glb name. */
  variant: string;
  build: "old" | "new";
  view: string;
}

/**
 * Reads `?game=plane&part=<piece>&variant=<unit>&build=old|new&view=`.
 * `part` is a piece (`wing`), a spec id (`plane-wing`) or a unit name;
 * `variant` defaults to the spec's scoring unit, or the piece's first.
 */
export function parsePlaneStudioParams(
  search: string
): PlaneStudioParams | { error: string } {
  const query = new URLSearchParams(search);
  const part = query.get("part") ?? "";
  const asUnit = PLANE_UNITS[part];
  const model = asUnit
    ? asUnit.model
    : part.startsWith("plane-")
      ? part
      : `plane-${part}`;
  const units = Object.values(PLANE_UNITS).filter((u) => u.model === model);
  if (units.length === 0) return { error: `Unknown plane piece "${part}"` };
  const spec = PART_SPECS[model] ?? null;
  const variant =
    query.get("variant") ??
    (asUnit ? asUnit.unit : (spec?.scoreVariant ?? units[0].unit));
  if (!units.some((u) => u.unit === variant)) {
    return { error: `Unknown unit "${variant}" for ${model}` };
  }
  const view = query.get("view") ?? DEFAULT_VIEW;
  if (spec && !spec.views.some((v) => v.name === view)) {
    return { error: `Unknown view "${view}" for ${model}` };
  }
  if (!spec && view !== DEFAULT_VIEW) {
    return { error: `Unknown view "${view}" for ${model} (no spec yet)` };
  }
  const build = query.get("build") ?? "";
  if (build !== "old" && build !== "new") {
    return { error: `Unknown build "${build}" (old or new)` };
  }
  const time = query.get("time") ?? "Day";
  if (!(STUDIO_TIMES as readonly string[]).includes(time)) {
    return { error: `Unknown time "${time}"` };
  }
  return { game: "plane", part: model, variant, build, view };
}
