import { PART_TYPES, type PartType } from "@/lib/ship-builder/model/types";
import { specForPart, type PartSpec } from "./partSpecs";

export const STUDIO_TIMES = ["Day", "Sunset", "Night"] as const;
export type StudioTime = (typeof STUDIO_TIMES)[number];

/** The view used when a part has no spec yet (measuring). */
export const DEFAULT_VIEW = "three-quarter";

export interface StudioParams {
  /** The `part` query value (a Ship Builder part id or a spec id). */
  part: string;
  /** The Ship Builder part drawn through PartMesh. */
  type: PartType;
  /** The spec variant (its glb is `<spec id>/<variant>.glb`); the part id when there is no spec. */
  variant: string;
  /** True for a detail-kit piece (KitStudio draws it; `type` is a placeholder). */
  kit: boolean;
  build: "old" | "new";
  view: string;
  time: StudioTime;
}

function isPartType(value: string): value is PartType {
  return (PART_TYPES as readonly string[]).includes(value);
}

interface Resolved {
  type: PartType;
  spec: PartSpec | null;
  variant: string;
}

/**
 * Works out which game part and spec variant a query names. `part` is a part
 * id (`funnel-large`) or a spec id (`funnel`); `variant` picks one of a
 * spec's variants and, when it is itself a part id, the part drawn. For a
 * single-variant part the variant is the part id.
 */
function resolve(part: string, variantParam: string | null): Resolved | string {
  const found = specForPart(part);
  const spec = found?.spec ?? null;
  const variant = variantParam ?? found?.variant ?? part;
  if (spec?.kit) {
    if (variant !== spec.id) return `Unknown variant "${variant}" for ${part}`;
    // A kit piece is no game part: `type` is never read for it.
    return { type: "deck-1x1", spec, variant };
  }
  if (spec) {
    if (!spec.variants.some((v) => v.name === variant)) {
      return `Unknown variant "${variant}" for ${part}`;
    }
    const type = isPartType(variant) ? variant : isPartType(part) ? part : null;
    if (!type) return `No Ship Builder part for "${part}" / "${variant}"`;
    return { type, spec, variant };
  }
  if (!isPartType(part)) return `Unknown part "${part}"`;
  if (variant !== part) return `Unknown variant "${variant}" for ${part}`;
  return { type: part, spec: null, variant };
}

/**
 * Reads `?part=&variant=&build=&view=&time=`; an unknown value is an error.
 * `variant` defaults to the spec's scoring variant, or the part id for a part
 * with no spec yet; `view` to the spec's first view named three-quarter.
 */
export function parseStudioParams(
  search: string
): StudioParams | { error: string } {
  const query = new URLSearchParams(search);
  const part = query.get("part") ?? "";
  const resolved = resolve(part, query.get("variant"));
  if (typeof resolved === "string") return { error: resolved };

  const view = query.get("view") ?? DEFAULT_VIEW;
  if (resolved.spec && !resolved.spec.views.some((v) => v.name === view)) {
    return { error: `Unknown view "${view}" for ${part}` };
  }
  if (!resolved.spec && view !== DEFAULT_VIEW) {
    return { error: `Unknown view "${view}" for ${part} (no spec yet)` };
  }
  const build = query.get("build") ?? "";
  if (build !== "old" && build !== "new") {
    return { error: `Unknown build "${build}" (old or new)` };
  }
  const time = query.get("time") ?? "Day";
  if (!(STUDIO_TIMES as readonly string[]).includes(time)) {
    return { error: `Unknown time "${time}"` };
  }
  return {
    part,
    kit: resolved.spec?.kit === true,
    type: resolved.type,
    variant: resolved.variant,
    build,
    view,
    time: time as StudioTime,
  };
}
