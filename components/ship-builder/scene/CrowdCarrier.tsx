"use client";

import { useCallback } from "react";
import type { Group } from "three";
import type { Carrier } from "./crowdView";

/**
 * The groups that carry people aboard: the whole ship's bobbing group, and
 * each half once she breaks. The crowd is drawn in world space as a few
 * instanced meshes, so it reads where these are each frame instead of being
 * mounted inside them.
 */
export const crowdCarriers: Record<Carrier, Group | null> = {
  whole: null,
  bow: null,
  stern: null,
};

interface CrowdCarrierProps {
  carrier: Carrier;
}

/** An empty group marking where a carrier's deck frame is. */
export default function CrowdCarrier({ carrier }: CrowdCarrierProps) {
  const ref = useCallback(
    (group: Group | null) => {
      if (group) {
        crowdCarriers[carrier] = group;
        return () => {
          if (crowdCarriers[carrier] === group) crowdCarriers[carrier] = null;
        };
      }
    },
    [carrier]
  );
  return <group ref={ref} />;
}
