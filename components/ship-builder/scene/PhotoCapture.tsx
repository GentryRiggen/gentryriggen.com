"use client";

import { addAfterEffect, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { registerSnapshotter } from "./photoSnapshot";

type Resolver = (canvas: HTMLCanvasElement) => void;

/**
 * Lets the page take a picture of the scene. The picture is copied from the
 * drawing buffer in the same turn the frame is drawn, which is the only time
 * the buffer is still filled (no need to keep it around between frames).
 */
export default function PhotoCapture() {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    let waiting: Resolver[] = [];

    const stopWatching = addAfterEffect(() => {
      if (waiting.length === 0) return;
      const source = gl.domElement;
      const copy = document.createElement("canvas");
      copy.width = source.width;
      copy.height = source.height;
      copy.getContext("2d")?.drawImage(source, 0, 0);
      const resolvers = waiting;
      waiting = [];
      for (const resolve of resolvers) resolve(copy);
    });

    const unregister = registerSnapshotter((onFrame) => {
      waiting.push(onFrame);
      return () => {
        waiting = waiting.filter((resolve) => resolve !== onFrame);
      };
    });

    return () => {
      stopWatching();
      unregister();
      waiting = [];
    };
  }, [gl]);

  return null;
}
