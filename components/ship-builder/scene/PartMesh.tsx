"use client";

import { memo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { gridLength, type Occupancy } from "@/lib/ship-builder/model/grid";
import type { PartCandidate } from "@/lib/ship-builder/model/placement";
import type {
  GridPartDef,
  PartType,
  Ship,
  Side,
} from "@/lib/ship-builder/model/types";
import { footprintBase, LEVEL_HEIGHT, modelToWorld } from "./coords";
import { PALETTE } from "./palette";

export type PartTint = keyof typeof PALETTE.tint | null;
export type PartEmphasis = keyof typeof PALETTE.emphasis | null;

interface PartMeshProps {
  ship: Ship;
  part: PartCandidate;
  /**
   * Tags the group's `userData.partId`, so one shared set of handlers can tell
   * which part an event hit via `event.eventObject`.
   */
  partId?: string;
  /** The ship's occupancy, shared across parts so each doesn't rebuild it. */
  occupancy?: Occupancy;
  tint?: PartTint;
  emphasis?: PartEmphasis;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

interface SurfaceProps {
  color: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Surface({ color, tint, emphasis }: SurfaceProps) {
  const ghost = tint === "ghost-ok" || tint === "ghost-bad";
  return (
    <meshStandardMaterial
      color={tint ? PALETTE.tint[tint] : color}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
      emissive={emphasis ? PALETTE.emphasis[emphasis] : "#000000"}
      emissiveIntensity={emphasis ? 0.4 : 0}
    />
  );
}

const BRIDGE_HEIGHT = 0.8;

interface BlockProps {
  def: GridPartDef;
  size: { x: number; z: number };
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Block({ def, size, tint, emphasis }: BlockProps) {
  const surface = { tint, emphasis };
  // Blocks fill their level so stacks sit flush and fittings rest on top; the
  // 0.96 footprint inset keeps a visible seam between neighbours. The bridge
  // is a lower wheelhouse: nothing stacks or attaches on it.
  const height = def.role === "bridge" ? BRIDGE_HEIGHT : LEVEL_HEIGHT;
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size.x * 0.96, height, size.z * 0.96]} />
        <Surface color={PALETTE.superstructure} {...surface} />
      </mesh>
      {def.passengers && (
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[size.x * 0.98, 0.12, size.z * 0.98]} />
          <Surface
            color={PALETTE.cabin[def.passengers.cabinClass]}
            {...surface}
          />
        </mesh>
      )}
      {def.role === "bridge" && (
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[size.x * 0.98, 0.15, size.z * 0.98]} />
          <Surface color={PALETTE.bridgeWindows} {...surface} />
        </mesh>
      )}
    </group>
  );
}

interface FittingProps {
  type: PartType;
  side?: Side;
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Fitting({ type, side, tint, emphasis }: FittingProps) {
  const surface = { tint, emphasis };
  // Starboard is world +Z (see coords.ts), so outboard is +Z there.
  const outward = side === "starboard" ? 1 : -1;
  switch (type) {
    case "funnel":
      return (
        <group>
          <mesh position={[0, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.42, 2.6, 16]} />
            <Surface color={PALETTE.funnel} {...surface} />
          </mesh>
          <mesh position={[0, 2.9, 0]} castShadow>
            <cylinderGeometry args={[0.39, 0.39, 0.6, 16]} />
            <Surface color={PALETTE.funnelTop} {...surface} />
          </mesh>
        </group>
      );
    case "mast-fore":
    case "mast-aft":
      return (
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 7, 8]} />
          <Surface color={PALETTE.mast} {...surface} />
        </mesh>
      );
    case "davit":
      return (
        <group>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.08, 0.8, 0.08]} />
            <Surface color={PALETTE.davit} {...surface} />
          </mesh>
          <mesh position={[0, 0.8, outward * 0.3]}>
            <boxGeometry args={[0.08, 0.08, 0.6]} />
            <Surface color={PALETTE.davit} {...surface} />
          </mesh>
        </group>
      );
    case "lifeboat-standard":
    case "lifeboat-collapsible": {
      const collapsible = type === "lifeboat-collapsible";
      const height = collapsible ? 0.2 : 0.3;
      return (
        <mesh position={[0, -0.1 - height / 2, 0]} castShadow>
          <boxGeometry args={[0.9, height, 0.35]} />
          <Surface
            color={collapsible ? PALETTE.collapsible : PALETTE.lifeboat}
            {...surface}
          />
        </mesh>
      );
    }
    default:
      return null;
  }
}

function PartMesh({
  ship,
  part,
  partId,
  occupancy,
  tint = null,
  emphasis = null,
  onPointerOver,
  onPointerOut,
  onPointerDown,
  onClick,
}: PartMeshProps) {
  const def = getPartDef(part.type);
  const length = gridLength(ship);
  const handlers = {
    onPointerOver,
    onPointerOut,
    onPointerDown,
    onClick,
    userData: { partId },
  };

  if (def.placement === "grid") {
    if (part.anchor.kind !== "grid") return null;
    const { center, size } = footprintBase(def, part.anchor, part.rotation);
    return (
      <group position={modelToWorld(length, center)} {...handlers}>
        <Block def={def} size={size} tint={tint} emphasis={emphasis} />
      </group>
    );
  }

  if (part.anchor.kind !== "attach") return null;
  const point = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!point) return null;
  return (
    <group position={modelToWorld(length, point.position)} {...handlers}>
      <Fitting
        type={part.type}
        side={point.side}
        tint={tint}
        emphasis={emphasis}
      />
    </group>
  );
}

// Not `export default function` like the other components: memo() wraps it.
export default memo(PartMesh);
