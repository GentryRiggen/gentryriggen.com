"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { scheduleChunkWarmup } from "./endings/chunkWarmup";

/** Prepares the shatter in idle time, so the first ending does not hitch. */
export default function ChunkWarmup() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => scheduleChunkWarmup(gl, camera), [gl, camera]);
  return null;
}
