import type { GlbPartEntry } from "@/components/ship-builder/scene/glbRegistry";
import { GLB_PARTS } from "@/components/ship-builder/scene/glbRegistry";
import type { GlbSource } from "@/components/ship-builder/scene/GlbRegistryPart";
import type { GlbSlotLook } from "@/components/ship-builder/scene/glbSlots";
import { PALETTE } from "@/components/ship-builder/scene/palette";
import type { PartSpec } from "./partSpecs";
import type { StudioParams } from "./studioParams";

/** Where the check-in copies the work-in-progress glbs the studio loads. */
export function studioModelUrl(model: string, variant: string): string {
  return `/asset-studio/${model}/${variant}.glb`;
}

/** A slot's look from its spec colour; a TODO slot is a visible grey. */
function slotLooks(spec: PartSpec): Record<string, GlbSlotLook> {
  const looks: Record<string, GlbSlotLook> = {};
  for (const slot of spec.slots) {
    const found = spec.slotColors?.[slot];
    looks[slot] = {
      color: found?.color ?? PALETTE.superstructure,
      finish: found?.finish,
    };
  }
  return looks;
}

/**
 * What the registry draws from in the studio. `old` never draws a model.
 * `new` draws the WIP glb of the part's spec variant through the part's
 * registry entry (the game's real slot colours) or, for a part not yet
 * registered, through an entry built from the spec's slot colours.
 */
export function studioSource(
  params: StudioParams,
  spec: PartSpec | null
): GlbSource {
  if (params.build === "old") return { procedural: true };
  if (!spec) return { procedural: true };
  const registered = GLB_PARTS[params.type];
  const entry: GlbPartEntry = {
    model: spec.id,
    variant: params.variant,
    rakeRadians: registered?.rakeRadians ?? spec.rakeRadians,
    slots: registered?.slots ?? (() => slotLooks(spec)),
    subParts: registered?.subParts,
  };
  return {
    entries: { [params.type]: entry },
    urlFor: (e) => studioModelUrl(e.model, e.variant),
  };
}
