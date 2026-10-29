"use client";

import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import type { BufferGeometry } from "three";
import {
  trackGlbPart,
  type GlbLoadStatus,
} from "@/components/ship-builder/scene/glbLoadStatus";
import type { LevelPalette } from "@/lib/plane-builder/levels/types";
import { obstacleGeometryFromScene } from "./obstacleModels";
import { propUrl, type PropName } from "./propModels";

interface TrackedProps {
  state: keyof GlbLoadStatus;
  children: ReactNode;
}

/** Counts a mounted batch for the `__shipBuilderModels` test hook. */
export function Tracked({ state, children }: TrackedProps) {
  useEffect(() => trackGlbPart(state), [state]);
  return children;
}

interface FallbackBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Draws the fallback instead of anything its children throw. */
export class FallbackBoundary extends Component<FallbackBoundaryProps> {
  state = { hasFailed: false };

  static getDerivedStateFromError(): { hasFailed: boolean } {
    return { hasFailed: true };
  }

  componentDidCatch(error: Error): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn("glb fell back:", error.message);
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

interface LoadedProps {
  name: PropName;
  palette: LevelPalette;
  children: (geometry: BufferGeometry) => ReactNode;
}

function Loaded({ name, palette, children }: LoadedProps) {
  const url = propUrl(name);
  // No Draco or meshopt: the files use neither.
  const { scene } = useGLTF(url, false, false);
  const geometry = useMemo(
    () => obstacleGeometryFromScene(scene, palette, url),
    [scene, palette, url]
  );
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return <Tracked state="loaded">{children(geometry)}</Tracked>;
}

interface PropGlbProps extends Omit<LoadedProps, "children"> {
  /** What shows while the model loads, or for good if it fails. */
  fallback: ReactNode;
  /** Draws the loaded geometry (one merged, vertex-coloured geometry). */
  children: (geometry: BufferGeometry) => ReactNode;
}

/** A course prop's glb as a vertex-coloured geometry, with a procedural stand-in. */
export default function PropGlb({
  name,
  palette,
  fallback,
  children,
}: PropGlbProps) {
  return (
    <FallbackBoundary fallback={fallback}>
      <Suspense fallback={<Tracked state="pending">{fallback}</Tracked>}>
        <Loaded name={name} palette={palette}>
          {children}
        </Loaded>
      </Suspense>
    </FallbackBoundary>
  );
}
