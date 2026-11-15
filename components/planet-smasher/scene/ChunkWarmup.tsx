"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useGameStore } from "@/lib/planet-smasher/store";
import { scheduleChunkWarmup } from "./endings/chunkWarmup";

/** Prepares the shatter in idle time, so the first ending does not hitch. */
export default function ChunkWarmup() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(
    () =>
      scheduleChunkWarmup(
        gl,
        camera,
        () => useGameStore.getState().progress.planetId
      ),
    [gl, camera]
  );
  return null;
}
