"use client";

import { memo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  beamOf,
  gridLength,
  type Occupancy,
} from "@/lib/ship-builder/model/grid";
import type { PartCandidate } from "@/lib/ship-builder/model/placement";
import type {
  GridPartDef,
  PartType,
  Ship,
  Side,
} from "@/lib/ship-builder/model/types";
import { footprintBase, LEVEL_HEIGHT, modelToWorld } from "./coords";
import BlockDetails from "./BlockDetails";
import DavitMesh from "./DavitMesh";
import FunnelMesh from "./FunnelMesh";
import LifeboatMesh from "./LifeboatMesh";
import { PALETTE } from "./palette";
import Spinner from "./Spinner";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

export type { PartEmphasis, PartTint };

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
      <BlockDetails
        def={def}
        size={size}
        height={height}
        tint={tint}
        emphasis={emphasis}
      />
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
        <FunnelMesh
          baseRadius={0.42}
          topRadius={0.38}
          bodyHeight={2.6}
          capHeight={0.6}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "funnel-large":
      // Centred on its point (the 2x2's centre, on top): body 3.4 + top 0.8.
      return (
        <FunnelMesh
          baseRadius={0.71}
          topRadius={0.65}
          bodyHeight={3.4}
          capHeight={0.8}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "propeller": {
      // Shaft along world X (the ship's length); blades spread around it.
      const isGhost = tint === "ghost-ok" || tint === "ghost-bad";
      return (
        <Spinner enabled={!isGhost}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.4, 12]} />
            <Surface color={PALETTE.propeller} {...surface} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[(i * 2 * Math.PI) / 3, 0, 0]}>
              <mesh position={[0, 0.32, 0]} castShadow>
                <boxGeometry args={[0.06, 0.5, 0.16]} />
                <Surface color={PALETTE.propeller} {...surface} />
              </mesh>
            </group>
          ))}
        </Spinner>
      );
    }
    case "mast":
      return (
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 7, 8]} />
          <Surface color={PALETTE.mast} {...surface} />
        </mesh>
      );
    case "davit":
      return <DavitMesh outward={outward} tint={tint} emphasis={emphasis} />;
    case "lifeboat-large":
      return (
        <LifeboatMesh
          length={1.9}
          width={0.45}
          depth={0.35}
          hullColor={PALETTE.lifeboat}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "lifeboat-standard":
    case "lifeboat-collapsible": {
      const collapsible = type === "lifeboat-collapsible";
      return (
        <LifeboatMesh
          length={0.9}
          width={0.35}
          depth={collapsible ? 0.2 : 0.3}
          hullColor={collapsible ? PALETTE.collapsible : PALETTE.lifeboat}
          tint={tint}
          emphasis={emphasis}
        />
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
  const beam = beamOf(ship);
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
      <group position={modelToWorld(length, beam, center)} {...handlers}>
        <Block def={def} size={size} tint={tint} emphasis={emphasis} />
      </group>
    );
  }

  if (part.anchor.kind !== "attach") return null;
  const point = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!point) return null;
  return (
    <group position={modelToWorld(length, beam, point.position)} {...handlers}>
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
