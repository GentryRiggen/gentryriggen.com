"use client";

import {
  Component,
  createContext,
  Suspense,
  useContext,
  useEffect,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Group } from "three";
import usePrefersReducedMotion from "@/components/ship-builder/hooks/usePrefersReducedMotion";
import {
  trackGlbPart,
  type GlbLoadStatus,
} from "@/components/ship-builder/scene/glbLoadStatus";
import { slotMeshesOf } from "@/components/ship-builder/scene/glbSlots";
import {
  PLANE_UNITS,
  planeModelUrl,
  type PlaneUnitEntry,
} from "./planeGlbRegistry";
import { MATERIAL_KEYS, type PlaneMaterials } from "./planeMaterials";

/**
 * Where plane units draw from. The game uses the default (the committed
 * glbs). The asset studio swaps it to the old procedural look or to a
 * work-in-progress glb.
 */
export interface PlaneGlbSource {
  /** Never draw a model: always the procedural unit. */
  procedural?: boolean;
  urlFor?: (entry: PlaneUnitEntry) => string;
}

export const PlaneGlbSourceContext = createContext<PlaneGlbSource>({});

/** True in the asset studio, where propellers hold still for screenshots. */
export const PlaneFreezeContext = createContext(false);

export const PROPELLER_SPEED = 30;

interface PlaneSpinProps {
  children: ReactNode;
}

/** Turns its children about local X (a propeller's shaft). */
export function PlaneSpin({ children }: PlaneSpinProps) {
  const spinner = useRef<Group>(null);
  const isReduced = usePrefersReducedMotion();
  const isFrozen = useContext(PlaneFreezeContext);
  useFrame((_, delta) => {
    if (isReduced || isFrozen || !spinner.current) return;
    spinner.current.rotation.x += Math.min(delta, 0.1) * PROPELLER_SPEED;
  });
  return <group ref={spinner}>{children}</group>;
}

interface TrackedProps {
  state: keyof GlbLoadStatus;
  children: ReactNode;
}

/** Counts a mounted unit for the `__shipBuilderModels` test hook. */
function Tracked({ state, children }: TrackedProps) {
  useEffect(() => trackGlbPart(state), [state]);
  return children;
}

interface FallbackBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Draws the fallback instead of anything its children throw. */
class FallbackBoundary extends Component<FallbackBoundaryProps> {
  state = { hasFailed: false };

  static getDerivedStateFromError(): { hasFailed: boolean } {
    return { hasFailed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn("plane glb fell back:", error.message, info.componentStack);
    }
  }

  render(): ReactNode {
    return this.state.hasFailed ? (
      <Tracked state="failed">{this.props.fallback}</Tracked>
    ) : (
      this.props.children
    );
  }
}

interface ModelProps {
  url: string;
  spin: boolean;
  materials: PlaneMaterials;
}

function Model({ url, spin, materials }: ModelProps) {
  // No Draco or meshopt: the files use neither (and Draco would fetch its
  // decoder from a CDN).
  const { scene } = useGLTF(url, false, false);
  const meshes = slotMeshesOf(scene, MATERIAL_KEYS, url);
  const content = (
    <>
      {meshes.map(({ slot, geometry, matrix, baked }, index) => {
        const key = slot as (typeof MATERIAL_KEYS)[number];
        return (
          <mesh
            key={`${slot}-${index}`}
            geometry={geometry}
            material={baked ? materials.baked[key] : materials[key]}
            castShadow
            {...(matrix ? { matrix, matrixAutoUpdate: false } : {})}
          />
        );
      })}
    </>
  );
  return (
    <Tracked state="loaded">
      {spin ? <PlaneSpin>{content}</PlaneSpin> : content}
    </Tracked>
  );
}

interface PlaneGlbUnitProps {
  unit: string;
  materials: PlaneMaterials;
  /** The procedural unit: drawn while the model loads and if it fails. */
  children: ReactNode;
}

/**
 * One plane piece from its glb: each mesh is named by a paint (`body`,
 * `trim`, `dark`, ...) and drawn with the plane's own materials, so level
 * palettes, gold and glow trims apply. Baked ambient occlusion (COLOR_0) is
 * multiplied in. While the file loads, or if it fails, `children` (the old
 * procedural unit) draws instead.
 */
export default function PlaneGlbUnit({
  unit,
  materials,
  children,
}: PlaneGlbUnitProps) {
  const source = useContext(PlaneGlbSourceContext);
  const entry = PLANE_UNITS[unit];
  if (!entry || source.procedural) return children;
  const url = source.urlFor
    ? source.urlFor(entry)
    : planeModelUrl(entry.model, entry.unit);
  const standIn = <Tracked state="pending">{children}</Tracked>;
  return (
    <FallbackBoundary key={url} fallback={children}>
      <Suspense fallback={standIn}>
        <Model url={url} spin={entry.spin} materials={materials} />
      </Suspense>
    </FallbackBoundary>
  );
}
