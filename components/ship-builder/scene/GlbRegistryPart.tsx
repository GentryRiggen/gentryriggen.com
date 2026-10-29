"use client";

import { createContext, useContext, type ReactNode } from "react";
import GlbSlotPart from "./GlbSlotPart";
import type { GlbPartContext, GlbPartEntry } from "./glbRegistry";
import { GLB_PARTS } from "./glbRegistry";
import { facingYaw } from "./facingYaw";
import { shipModelUrl } from "./shipModels";

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
  /** The part's paint, tint, emphasis and placement (see GlbPartContext). */
  context: GlbPartContext;
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
  // A port fitting that faces outward turns a half turn; a decor part turns
  // with the player's rotation. The fallback already faces itself, so it is
  // turned back by the same angle.
  const yaw =
    (entry.faceOutward && context.side === "port" ? Math.PI : 0) +
    (entry.facing ? facingYaw(context.rotation) : 0) +
    (entry.plainYaw ? (context.rotation * Math.PI) / 180 : 0);
  const part = (
    <GlbSlotPart
      url={url}
      slots={entry.slots(context)}
      tint={context.tint}
      emphasis={context.emphasis}
      rakeRadians={entry.rakeRadians}
      fallback={
        yaw ? <group rotation={[0, -yaw, 0]}>{children}</group> : children
      }
    >
      {entry.subParts?.(context)}
    </GlbSlotPart>
  );
  return yaw ? <group rotation={[0, yaw, 0]}>{part}</group> : part;
}
