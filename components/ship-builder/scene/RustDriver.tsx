"use client";

import { useFrame } from "@react-three/fiber";
import { RUST, rustAmount } from "./rust";
import { trialPlayback } from "./trialPlayback";

/**
 * Feeds the shared rust uniform once a frame from the playback every path
 * writes (live, timeline, instant and scrubber), so it follows playback time.
 */
export default function RustDriver() {
  useFrame(() => {
    RUST.value = rustAmount(trialPlayback);
  });
  return null;
}
