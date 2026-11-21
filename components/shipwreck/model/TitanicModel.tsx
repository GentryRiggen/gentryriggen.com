"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useMemo, type Ref } from "react";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { ModelQuality } from "./buildShip";
import {
  createTitanicModel,
  type TitanicHandles,
  type TitanicModel as Model,
} from "./shipModel";

const pendingDispose = new Map<Model, ReturnType<typeof setTimeout>>();

interface TitanicModelProps {
  /** The ship's data (the hull's offsets, decks and funnels). */
  spec?: ShipSpec;
  /** Null: one piece. A number: built as bow and stern torn apart at this x. */
  breakX?: number | null;
  quality?: ModelQuality;
  /** The handles the scene drives each frame (see README.md). */
  ref?: Ref<TitanicHandles | null>;
  onReady?: (handles: TitanicHandles) => void;
}

/**
 * The procedural Titanic. Rebuilt only when the ship, the quality or the
 * break changes; everything that moves each frame goes through the handles
 * (pose the parts, light the windows, lower the boats, topple a funnel), so
 * there is no React render per frame.
 */
export default function TitanicModel({
  spec = titanic,
  breakX = null,
  quality = "high",
  ref,
  onReady,
}: TitanicModelProps) {
  const model = useMemo(
    () => createTitanicModel(spec, { quality, breakX }),
    [spec, quality, breakX]
  );
  // StrictMode runs effects twice (mount, cleanup, mount) on the same memo:
  // the cleanup only schedules the dispose and a re-mount cancels it, so a
  // model is freed once, when it is really gone.
  useEffect(() => {
    const pending = pendingDispose.get(model);
    if (pending !== undefined) {
      clearTimeout(pending);
      pendingDispose.delete(model);
    }
    return () => {
      pendingDispose.set(
        model,
        setTimeout(() => {
          pendingDispose.delete(model);
          model.dispose();
        }, 0)
      );
    };
  }, [model]);
  useImperativeHandle(ref, () => model.handles, [model]);
  useEffect(() => {
    onReady?.(model.handles);
  }, [model, onReady]);
  useFrame((state) => {
    model.handles.setTime(state.clock.elapsedTime);
  });
  return <primitive object={model.handles.root} dispose={null} />;
}
