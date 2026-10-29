"use client";

import type { ReactNode } from "react";
import { envModelUrl } from "./envModels";
import GlbSlotPart from "./GlbSlotPart";
import type { GlbSlotLook } from "./glbSlots";

interface EnvGlbProps {
  /** The spec id's directory under public/ship-builder/models/. */
  model: string;
  variant: string;
  slots: Readonly<Record<string, GlbSlotLook>>;
  /** The procedural look: drawn while the file loads and if it fails. */
  fallback: ReactNode;
  /** Procedural extras drawn with the model only (a buoy's glowing lamp). */
  children?: ReactNode;
}

/** One sea-environment object from its Blender glb, with a procedural fallback. */
export default function EnvGlb({
  model,
  variant,
  slots,
  fallback,
  children,
}: EnvGlbProps) {
  return (
    <GlbSlotPart
      url={envModelUrl(model, variant)}
      slots={slots}
      tint={null}
      emphasis={null}
      fallback={fallback}
    >
      {children}
    </GlbSlotPart>
  );
}
