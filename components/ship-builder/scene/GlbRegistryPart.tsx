import { createContext, useContext, type ReactNode } from "react";
import GlbSlotPart from "./GlbSlotPart";
import type { GlbPartContext, GlbPartEntry } from "./glbRegistry";
import { GLB_PARTS } from "./glbRegistry";
import { shipModelUrl } from "./shipModels";
import type { PartEmphasis, PartTint } from "./Surface";

/**
 * Where the registry draws from. The game uses the default (every entry, its
 * committed glb). The asset studio swaps it to draw the old procedural look,
 * a work-in-progress glb, or a part that has no entry yet.
 */
export interface GlbSource {
  /** Never draw a model: always the procedural part. */
  procedural?: boolean;
  /** Entries for parts the registry does not list (or to replace one). */
  entries?: Partial<Record<string, GlbPartEntry>>;
  /** Where an entry's file is served from; default is the shipped model. */
  urlFor?: (entry: GlbPartEntry) => string;
}

export const GlbSourceContext = createContext<GlbSource>({});

interface GlbRegistryPartProps {
  type: string;
  context: GlbPartContext;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** The procedural part: drawn while the model loads, if it fails, and for
   * any part with no registry entry. */
  children: ReactNode;
}

/**
 * Draws a part from its registry entry (see glbRegistry.tsx), or `children`
 * (the procedural mesh) when it has none.
 */
export default function GlbRegistryPart({
  type,
  context,
  tint,
  emphasis,
  children,
}: GlbRegistryPartProps) {
  const source = useContext(GlbSourceContext);
  const entry = source.procedural
    ? undefined
    : (source.entries?.[type] ?? GLB_PARTS[type as keyof typeof GLB_PARTS]);
  if (!entry) return children;
  const url = source.urlFor
    ? source.urlFor(entry)
    : shipModelUrl(entry.model, entry.variant);
  return (
    <GlbSlotPart
      url={url}
      slots={entry.slots(context)}
      tint={tint}
      emphasis={emphasis}
      rakeRadians={entry.rakeRadians}
      fallback={children}
    >
      {entry.subParts?.(context)}
    </GlbSlotPart>
  );
}
