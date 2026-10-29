"use client";

import {
  Component,
  Fragment,
  Suspense,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import { AO_OCCLUDER } from "./aoLayer";
import { trackGlbPart, type GlbLoadStatus } from "./glbLoadStatus";
import { slotMeshesOf, type GlbSlotLook } from "./glbSlots";
import Spinner from "./Spinner";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

interface GlbSlotPartProps {
  /** A same-origin .glb whose meshes are each named by slot. */
  url: string;
  /** How each slot is drawn; a mesh named anything else is an error. */
  slots: Readonly<Record<string, GlbSlotLook>>;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Drawn while the file loads, and for good if it fails. */
  fallback: ReactNode;
  /** Tilt about Z, applied to the loaded model and `children` (not the fallback). */
  rakeRadians?: number;
  /** Drawn with the loaded model only (e.g. decals fitted to its surface). */
  children?: ReactNode;
}

interface TrackedProps {
  state: keyof GlbLoadStatus;
  children: ReactNode;
}

/** Counts a mounted part for the `__shipBuilderModels` test hook. */
function Tracked({ state, children }: TrackedProps) {
  useEffect(() => trackGlbPart(state), [state]);
  return children;
}

interface FallbackBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Draws the fallback instead of anything its children throw (a failed load,
 * a bad file), so a model problem never blanks the part or the scene.
 */
class FallbackBoundary extends Component<FallbackBoundaryProps> {
  state = { hasFailed: false };

  static getDerivedStateFromError(): { hasFailed: boolean } {
    return { hasFailed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn("glb part fell back:", error.message, info.componentStack);
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

type SlotMeshesProps = Omit<GlbSlotPartProps, "fallback">;

function SlotMeshes({
  url,
  slots,
  tint,
  emphasis,
  rakeRadians,
  children,
}: SlotMeshesProps) {
  // No Draco or meshopt: the files use neither, and Draco would fetch its
  // decoder from a CDN (breaking offline play).
  const { scene } = useGLTF(url, false, false);
  const meshes = slotMeshesOf(scene, Object.keys(slots), url);
  const isGhost = tint === "ghost-ok" || tint === "ghost-bad";
  const content = (
    <>
      {meshes.map(({ slot, geometry, matrix, baked }, index) => {
        const look = slots[slot];
        const drawn = (
          <mesh
            {...(look.aoOccluder ? AO_OCCLUDER : {})}
            geometry={geometry}
            castShadow={look.castShadow ?? false}
            {...(matrix ? { matrix, matrixAutoUpdate: false } : {})}
          >
            <Surface
              color={look.color}
              finish={look.finish}
              vertexColors={baked}
              tint={tint}
              emphasis={emphasis}
            />
          </mesh>
        );
        return look.spin ? (
          <Spinner key={`${slot}-${index}`} enabled={!isGhost}>
            {drawn}
          </Spinner>
        ) : (
          <Fragment key={`${slot}-${index}`}>{drawn}</Fragment>
        );
      })}
      {children}
    </>
  );
  return (
    <Tracked state="loaded">
      {rakeRadians ? (
        <group rotation={[0, 0, rakeRadians]}>{content}</group>
      ) : (
        content
      )}
    </Tracked>
  );
}

/**
 * A part drawn from a Blender-made .glb: each mesh is named by a paint slot
 * and painted through `Surface`, so ghosts, removal tints and the hover glow
 * work as on any other part. The loader's geometry is shared by every
 * instance (no clone per part). While the file loads, or if it fails, the
 * `fallback` (the old procedural part) is drawn instead.
 */
export default function GlbSlotPart({ fallback, ...props }: GlbSlotPartProps) {
  const standIn = <Tracked state="pending">{fallback}</Tracked>;
  return (
    <FallbackBoundary key={props.url} fallback={fallback}>
      <Suspense fallback={standIn}>
        <SlotMeshes {...props} />
      </Suspense>
    </FallbackBoundary>
  );
}
